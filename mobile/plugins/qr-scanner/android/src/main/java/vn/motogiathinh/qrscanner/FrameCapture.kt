package vn.motogiathinh.qrscanner

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.ImageProxy
import java.io.ByteArrayOutputStream

/** Converts a locked CameraX [ImageProxy] (YUV_420_888) into an upright JPEG. */
object FrameCapture {

    data class Jpeg(val bytes: ByteArray, val width: Int, val height: Int)

    fun toJpeg(proxy: ImageProxy, quality: Int, rotationDegrees: Int): Jpeg {
        val nv21 = yuv420ToNv21(proxy)
        val yuv = YuvImage(nv21, ImageFormat.NV21, proxy.width, proxy.height, null)
        val out = ByteArrayOutputStream()
        yuv.compressToJpeg(Rect(0, 0, proxy.width, proxy.height), quality.coerceIn(40, 100), out)
        var bytes = out.toByteArray()
        var w = proxy.width
        var h = proxy.height
        if (rotationDegrees != 0) {
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            val m = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
            val rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            val out2 = ByteArrayOutputStream()
            rotated.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(40, 100), out2)
            bytes = out2.toByteArray()
            w = rotated.width
            h = rotated.height
            if (rotated != bmp) bmp.recycle()
            rotated.recycle()
        }
        return Jpeg(bytes, w, h)
    }

    /** Robust YUV_420_888 → NV21, honouring row/pixel strides. */
    private fun yuv420ToNv21(image: ImageProxy): ByteArray {
        val width = image.width
        val height = image.height
        val ySize = width * height
        val nv21 = ByteArray(ySize + ySize / 2)

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        // Y
        val yBuffer = yPlane.buffer
        val yRowStride = yPlane.rowStride
        var pos = 0
        if (yRowStride == width) {
            yBuffer.get(nv21, 0, ySize)
            pos = ySize
        } else {
            val row = ByteArray(yRowStride)
            for (r in 0 until height) {
                yBuffer.position(r * yRowStride)
                yBuffer.get(row, 0, minOf(yRowStride, row.size))
                System.arraycopy(row, 0, nv21, pos, width)
                pos += width
            }
        }

        // VU interleaved (NV21 = Y plane + V,U,V,U...)
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer
        val uRowStride = uPlane.rowStride
        val uPixelStride = uPlane.pixelStride
        val vRowStride = vPlane.rowStride
        val vPixelStride = vPlane.pixelStride
        val chromaHeight = height / 2
        val chromaWidth = width / 2
        for (r in 0 until chromaHeight) {
            var uIdx = r * uRowStride
            var vIdx = r * vRowStride
            for (c in 0 until chromaWidth) {
                nv21[pos++] = vBuffer.get(vIdx)
                nv21[pos++] = uBuffer.get(uIdx)
                uIdx += uPixelStride
                vIdx += vPixelStride
            }
        }
        return nv21
    }
}

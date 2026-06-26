package vn.motogiathinh.qrscanner

import android.annotation.SuppressLint
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraInfo
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

/**
 * Drives the bundled ML Kit QR model over CameraX frames. Auto-zooms toward a
 * small/distant code, then locks once a large-enough code is stable for a couple
 * of frames and hands the locked frame (as JPEG) back to the Activity.
 */
class QrAnalyzer(
    private val autoZoom: Boolean,
    private val quality: Int,
    private val onLock: (String, FrameCapture.Jpeg) -> Unit
) : ImageAnalysis.Analyzer {

    var cameraControl: CameraControl? = null
    var cameraInfo: CameraInfo? = null

    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )
    private var stable = 0
    @Volatile private var locked = false

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (media == null || locked) { proxy.close(); return }
        val rotation = proxy.imageInfo.rotationDegrees
        val input = InputImage.fromMediaImage(media, rotation)
        scanner.process(input)
            .addOnSuccessListener listener@{ codes ->
                if (locked) return@listener
                val bc = codes.firstOrNull { it.format == Barcode.FORMAT_QR_CODE && !it.rawValue.isNullOrEmpty() }
                if (bc == null) { stable = 0; return@listener }
                val uprightW = if (rotation == 90 || rotation == 270) proxy.height else proxy.width
                val frac = bc.boundingBox?.let { it.width().toFloat() / uprightW.toFloat() } ?: 1f
                if (autoZoom && frac < 0.45f) {
                    rampZoom(frac)
                    stable = 0
                    return@listener
                }
                if (++stable < 2) return@listener
                // Lock: convert THIS frame to JPEG while the proxy is still open.
                locked = true
                val jpeg = FrameCapture.toJpeg(proxy, quality, rotation)
                onLock(bc.rawValue!!, jpeg)
            }
            .addOnCompleteListener {
                proxy.close()
            }
    }

    private fun rampZoom(frac: Float) {
        val info = cameraInfo ?: return
        val control = cameraControl ?: return
        val z = info.zoomState.value ?: return
        val target = (z.zoomRatio * (0.55f / frac.coerceAtLeast(0.05f)))
            .coerceIn(1f, minOf(z.maxZoomRatio, 4f))
        if (target > z.zoomRatio + 0.05f) control.setZoomRatio(target)
    }
}

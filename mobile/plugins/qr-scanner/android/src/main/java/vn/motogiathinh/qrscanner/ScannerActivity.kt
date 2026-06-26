package vn.motogiathinh.qrscanner

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Size
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ScannerActivity : ComponentActivity() {

    private lateinit var previewView: PreviewView
    private val analyzerExecutor = Executors.newSingleThreadExecutor()
    private var camera: Camera? = null
    private var finished = false
    private var torchOn = false

    private var imageReturn = "file"
    private var imageQuality = 85
    private var autoZoom = true
    private var torchButton = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        imageReturn = intent.getStringExtra("imageReturn") ?: "file"
        imageQuality = intent.getIntExtra("imageQuality", 85)
        autoZoom = intent.getBooleanExtra("autoZoom", true)
        torchButton = intent.getBooleanExtra("torchButton", true)
        setContentView(buildUi())
        startCamera()
    }

    private fun buildUi(): View {
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        previewView = PreviewView(this)
        previewView.scaleType = PreviewView.ScaleType.FILL_CENTER
        root.addView(previewView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        root.addView(ReticleView(this), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))

        val hint = TextView(this).apply {
            text = intent.getStringExtra("hint")?.takeIf { it.isNotEmpty() }
                ?: "Đưa mã QR trên CCCD vào khung"
            setTextColor(Color.WHITE)
            textSize = 15f
            setShadowLayer(6f, 0f, 1f, Color.BLACK)
        }
        root.addView(hint, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.CENTER_HORIZONTAL or Gravity.TOP).apply { topMargin = dp(72) })

        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(14), dp(16), dp(28))
        }
        val cancel = Button(this).apply {
            text = intent.getStringExtra("cancel")?.takeIf { it.isNotEmpty() } ?: "Hủy"
            setOnClickListener { finishCancel() }
        }
        bar.addView(cancel, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        if (torchButton) {
            val torch = Button(this).apply {
                text = "Đèn"
                setOnClickListener { toggleTorch() }
            }
            bar.addView(torch, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { leftMargin = dp(10) })
        }
        root.addView(bar, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))

        previewView.setOnTouchListener { _, e ->
            if (e.action == android.view.MotionEvent.ACTION_UP) focusAt(e.x, e.y)
            true
        }
        return root
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            try {
                bindUseCases(future.get())
            } catch (e: Exception) {
                finishCancel()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindUseCases(provider: ProcessCameraProvider) {
        val preview = Preview.Builder()
            .setTargetResolution(Size(1080, 1920))
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }

        val analysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(1080, 1920))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        val analyzer = QrAnalyzer(autoZoom, imageQuality) { raw, jpeg ->
            runOnUiThread { onLock(raw, jpeg) }
        }
        analysis.setAnalyzer(analyzerExecutor, analyzer)

        provider.unbindAll()
        val cam = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        camera = cam
        analyzer.cameraControl = cam.cameraControl
        analyzer.cameraInfo = cam.cameraInfo
        previewView.post { focusAt(previewView.width / 2f, previewView.height / 2f) }
    }

    private fun focusAt(x: Float, y: Float) {
        val cam = camera ?: return
        try {
            val point = previewView.meteringPointFactory.createPoint(x, y)
            val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE)
                .setAutoCancelDuration(3, TimeUnit.SECONDS)
                .build()
            cam.cameraControl.startFocusAndMetering(action)
        } catch (e: Exception) { /* ignore */ }
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        torchOn = !torchOn
        try { cam.cameraControl.enableTorch(torchOn) } catch (e: Exception) {}
    }

    private fun onLock(raw: String, jpeg: FrameCapture.Jpeg) {
        if (finished) return
        finished = true
        val data = Intent()
        data.putExtra("raw", raw)
        data.putExtra("imageWidth", jpeg.width)
        data.putExtra("imageHeight", jpeg.height)
        when (imageReturn) {
            "base64" -> data.putExtra("imageBase64", Base64.encodeToString(jpeg.bytes, Base64.NO_WRAP))
            "none" -> { /* raw only */ }
            else -> {
                val f = File(cacheDir, "cccd-qr-" + System.currentTimeMillis() + ".jpg")
                f.writeBytes(jpeg.bytes)
                data.putExtra("savedUri", Uri.fromFile(f).toString())
            }
        }
        setResult(RESULT_OK, data)
        finish()
    }

    private fun finishCancel() {
        if (finished) return
        finished = true
        setResult(RESULT_CANCELED)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        analyzerExecutor.shutdown()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    /** Dim mask with a clear, cyan-bordered rounded square in the center. */
    private class ReticleView(context: Context) : View(context) {
        private val dim = Paint().apply { color = Color.parseColor("#73000000") }
        private val clear = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR) }
        private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 6f
            color = Color.parseColor("#19D2E6")
        }
        init { setLayerType(LAYER_TYPE_SOFTWARE, null) }
        override fun onDraw(canvas: Canvas) {
            val side = minOf(width, height) * 0.7f
            val left = (width - side) / 2f
            val top = (height - side) / 2.3f
            val rect = RectF(left, top, left + side, top + side)
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), dim)
            canvas.drawRoundRect(rect, 24f, 24f, clear)
            canvas.drawRoundRect(rect, 24f, 24f, stroke)
        }
    }
}

package vn.motogiathinh.qrscanner

import android.Manifest
import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "MgtQrScanner",
    permissions = [Permission(strings = [Manifest.permission.CAMERA], alias = "camera")]
)
class MgtQrScannerPlugin : Plugin() {

    @PluginMethod
    fun scan(call: PluginCall) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermsCallback")
            return
        }
        launchScanner(call)
    }

    @PermissionCallback
    fun cameraPermsCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            launchScanner(call)
        } else {
            call.reject("Camera permission denied", "denied")
        }
    }

    private fun launchScanner(call: PluginCall) {
        val intent = Intent(context, ScannerActivity::class.java).apply {
            putExtra("imageReturn", call.getString("imageReturn", "file"))
            putExtra("imageQuality", call.getInt("imageQuality", 85)!!)
            putExtra("autoZoom", call.getBoolean("autoZoom", true)!!)
            putExtra("torchButton", call.getBoolean("torchButton", true)!!)
            call.getObject("strings")?.let { s ->
                putExtra("hint", s.optString("hint", ""))
                putExtra("cancel", s.optString("cancel", ""))
            }
        }
        startActivityForResult(call, intent, "scanActivityResult")
    }

    @ActivityCallback
    fun scanActivityResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null && data.getStringExtra("raw") != null) {
            val ret = JSObject()
            ret.put("raw", data.getStringExtra("raw"))
            ret.put("format", "QR_CODE")
            ret.put("engine", "mlkit-camerax")
            data.getStringExtra("savedUri")?.let { ret.put("savedUri", it) }
            data.getStringExtra("imageBase64")?.let { ret.put("imageBase64", it) }
            if (data.hasExtra("imageWidth")) ret.put("imageWidth", data.getIntExtra("imageWidth", 0))
            if (data.hasExtra("imageHeight")) ret.put("imageHeight", data.getIntExtra("imageHeight", 0))
            call.resolve(ret)
        } else {
            call.reject("cancelled", "cancelled")
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        // The scanner Activity owns its own lifecycle (user taps Hủy / back).
        call.resolve()
    }
}

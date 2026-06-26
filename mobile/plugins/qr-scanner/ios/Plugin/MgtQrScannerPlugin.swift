import Foundation
import AVFoundation
import Capacitor

/**
 * Native CCCD QR scanner. On iOS 16+ uses Apple VisionKit (DataScannerViewController,
 * the Camera-app engine); otherwise an AVFoundation AVCaptureMetadataOutput scanner.
 * Both return the decoded payload plus the locked frame as an image.
 */
@objc(MgtQrScannerPlugin)
public class MgtQrScannerPlugin: CAPPlugin {

    private weak var presentedVC: UIViewController?

    @objc func scan(_ call: CAPPluginCall) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            presentScanner(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    self.presentScanner(call)
                } else {
                    call.reject("Camera permission denied", "denied")
                }
            }
        default:
            call.reject("Camera permission denied", "denied")
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        dismissPresented()
        call.resolve()
    }

    private func presentScanner(_ call: CAPPluginCall) {
        let imageReturn = call.getString("imageReturn") ?? "file"
        let quality = call.getInt("imageQuality") ?? 85
        let autoZoom = call.getBool("autoZoom") ?? true
        let torchButton = call.getBool("torchButton") ?? true
        let strings = call.getObject("strings")
        let hint = (strings?["hint"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Đưa mã QR trên CCCD vào khung"
        let cancelText = (strings?["cancel"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Hủy"

        let onResult: (QrScanOutcome) -> Void = { [weak self] outcome in
            guard let self = self else { return }
            self.dismissPresented()
            switch outcome {
            case .success(let raw, let jpeg, let width, let height, let engine):
                var ret = JSObject()
                ret["raw"] = raw
                ret["format"] = "QR_CODE"
                ret["engine"] = engine
                ret["imageWidth"] = width
                ret["imageHeight"] = height
                if let jpeg = jpeg {
                    if imageReturn == "base64" {
                        ret["imageBase64"] = jpeg.base64EncodedString()
                    } else if imageReturn == "file", let uri = self.writeTemp(jpeg) {
                        ret["savedUri"] = uri
                    }
                }
                call.resolve(ret)
            case .cancelled:
                call.reject("cancelled", "cancelled")
            case .failure(let message):
                call.reject(message, "error")
            }
        }

        DispatchQueue.main.async {
            let vc: UIViewController
            if #available(iOS 16.0, *), DataScannerScanner.isAvailable() {
                vc = DataScannerScanner(quality: quality, hint: hint, cancelText: cancelText, onResult: onResult)
            } else {
                vc = QRScannerViewController(quality: quality, autoZoom: autoZoom, torchButton: torchButton,
                                            hint: hint, cancelText: cancelText, onResult: onResult)
            }
            vc.modalPresentationStyle = .fullScreen
            self.presentedVC = vc
            self.bridge?.viewController?.present(vc, animated: true, completion: nil)
        }
    }

    private func dismissPresented() {
        DispatchQueue.main.async {
            self.presentedVC?.dismiss(animated: true, completion: nil)
            self.presentedVC = nil
        }
    }

    private func writeTemp(_ data: Data) -> String? {
        let name = "cccd-qr-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try data.write(to: url)
            return url.absoluteString
        } catch {
            return nil
        }
    }
}

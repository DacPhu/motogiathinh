import UIKit
import AVFoundation

/// AVFoundation live QR scanner (iOS 13+). Uses Apple's AVCaptureMetadataOutput
/// detector at 1080p with near-range continuous autofocus and auto-zoom, then
/// captures the locked frame via AVCapturePhotoOutput as the upload image.
class QRScannerViewController: UIViewController,
    AVCaptureMetadataOutputObjectsDelegate, AVCapturePhotoCaptureDelegate {

    private let quality: Int
    private let autoZoom: Bool
    private let torchButton: Bool
    private let hint: String
    private let cancelText: String
    private let onResult: (QrScanOutcome) -> Void

    private let session = AVCaptureSession()
    private var device: AVCaptureDevice?
    private let metadataOutput = AVCaptureMetadataOutput()
    private let photoOutput = AVCapturePhotoOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let sessionQueue = DispatchQueue(label: "vn.motogiathinh.qr.session")

    private var locked = false
    private var stable = 0
    private var lockedRaw: String?
    private var torchOn = false
    private var reticleView: UIView?
    private var resolved = false

    init(quality: Int, autoZoom: Bool, torchButton: Bool, hint: String, cancelText: String,
         onResult: @escaping (QrScanOutcome) -> Void) {
        self.quality = quality
        self.autoZoom = autoZoom
        self.torchButton = torchButton
        self.hint = hint
        self.cancelText = cancelText
        self.onResult = onResult
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("not supported") }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
    override var prefersStatusBarHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureSession()
        addChrome()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        sessionQueue.async { if !self.session.isRunning { self.session.startRunning() } }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionQueue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func configureSession() {
        session.beginConfiguration()
        if session.canSetSessionPreset(.hd1920x1080) {
            session.sessionPreset = .hd1920x1080
        }
        guard let dev = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: dev),
              session.canAddInput(input) else {
            session.commitConfiguration()
            finish(.failure("No camera available"))
            return
        }
        session.addInput(input)
        device = dev

        if session.canAddOutput(metadataOutput) {
            session.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
            metadataOutput.metadataObjectTypes =
                metadataOutput.availableMetadataObjectTypes.contains(.qr) ? [.qr] : metadataOutput.availableMetadataObjectTypes
        }
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
        }
        session.commitConfiguration()
        configureFocus(dev)

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        layer.connection?.videoOrientation = .portrait
        view.layer.addSublayer(layer)
        previewLayer = layer
    }

    private func configureFocus(_ dev: AVCaptureDevice) {
        do {
            try dev.lockForConfiguration()
            if dev.isFocusModeSupported(.continuousAutoFocus) { dev.focusMode = .continuousAutoFocus }
            if dev.isAutoFocusRangeRestrictionSupported { dev.autoFocusRangeRestriction = .near }
            if dev.isSmoothAutoFocusSupported { dev.isSmoothAutoFocusEnabled = true }
            dev.unlockForConfiguration()
        } catch { /* ignore */ }
    }

    // MARK: - Chrome (reticle, hint, buttons)

    private func addChrome() {
        let side = min(view.bounds.width, view.bounds.height) * 0.7
        let reticle = UIView(frame: CGRect(x: (view.bounds.width - side) / 2,
                                           y: (view.bounds.height - side) / 2.3,
                                           width: side, height: side))
        reticle.backgroundColor = .clear
        reticle.layer.borderColor = UIColor(red: 0.098, green: 0.823, blue: 0.902, alpha: 1).cgColor
        reticle.layer.borderWidth = 3
        reticle.layer.cornerRadius = 16
        reticle.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin]
        view.addSubview(reticle)
        reticleView = reticle

        let label = UILabel()
        label.text = hint
        label.textColor = .white
        label.font = .systemFont(ofSize: 15, weight: .semibold)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.frame = CGRect(x: 24, y: view.safeAreaInsets.top + 60, width: view.bounds.width - 48, height: 50)
        label.autoresizingMask = [.flexibleWidth, .flexibleBottomMargin]
        view.addSubview(label)

        let cancel = makeButton(cancelText)
        cancel.addTarget(self, action: #selector(onCancel), for: .touchUpInside)
        let barY = view.bounds.height - 96
        if torchButton {
            cancel.frame = CGRect(x: 16, y: barY, width: (view.bounds.width - 42) / 2, height: 52)
            let torch = makeButton("Đèn")
            torch.addTarget(self, action: #selector(toggleTorch), for: .touchUpInside)
            torch.frame = CGRect(x: view.bounds.width / 2 + 5, y: barY, width: (view.bounds.width - 42) / 2, height: 52)
            torch.autoresizingMask = [.flexibleTopMargin, .flexibleLeftMargin]
            view.addSubview(torch)
            cancel.autoresizingMask = [.flexibleTopMargin, .flexibleRightMargin]
        } else {
            cancel.frame = CGRect(x: 16, y: barY, width: view.bounds.width - 32, height: 52)
            cancel.autoresizingMask = [.flexibleTopMargin, .flexibleWidth]
        }
        view.addSubview(cancel)
    }

    private func makeButton(_ title: String) -> UIButton {
        let b = UIButton(type: .system)
        b.setTitle(title, for: .normal)
        b.setTitleColor(.white, for: .normal)
        b.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        b.backgroundColor = UIColor(white: 0.12, alpha: 0.92)
        b.layer.cornerRadius = 12
        return b
    }

    @objc private func onCancel() {
        finish(.cancelled)
    }

    @objc private func toggleTorch() {
        guard let dev = device, dev.hasTorch else { return }
        do {
            try dev.lockForConfiguration()
            torchOn.toggle()
            dev.torchMode = torchOn ? .on : .off
            dev.unlockForConfiguration()
        } catch { /* ignore */ }
    }

    // MARK: - Detection

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        if locked { return }
        guard let obj = metadataObjects.first(where: { $0.type == .qr }) as? AVMetadataMachineReadableCodeObject,
              let raw = obj.stringValue, !raw.isEmpty else { return }

        var frac: CGFloat = 1.0
        if let transformed = previewLayer?.transformedMetadataObject(for: obj) {
            frac = transformed.bounds.width / max(view.bounds.width, 1)
        }
        if autoZoom && frac < 0.45 {
            rampZoom(frac)
            stable = 0
            return
        }
        stable += 1
        if stable < 2 { return }

        locked = true
        lockedRaw = raw
        let settings = AVCapturePhotoSettings()
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    private func rampZoom(_ frac: CGFloat) {
        guard let dev = device else { return }
        do {
            try dev.lockForConfiguration()
            let maxZoom = min(dev.activeFormat.videoMaxZoomFactor, 4.0)
            let target = min(max(dev.videoZoomFactor * (0.55 / max(frac, 0.05)), 1.0), maxZoom)
            if target > dev.videoZoomFactor + 0.05 {
                dev.ramp(toVideoZoomFactor: target, withRate: 4.0)
            }
            dev.unlockForConfiguration()
        } catch { /* ignore */ }
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        let raw = lockedRaw ?? ""
        guard error == nil, let data = photo.fileDataRepresentation() else {
            finish(.success(raw: raw, jpeg: nil, width: 0, height: 0, engine: "avfoundation"))
            return
        }
        var w = 0, h = 0
        if let img = UIImage(data: data) {
            w = Int(img.size.width * img.scale)
            h = Int(img.size.height * img.scale)
        }
        finish(.success(raw: raw, jpeg: data, width: w, height: h, engine: "avfoundation"))
    }

    private func finish(_ outcome: QrScanOutcome) {
        if resolved { return }
        resolved = true
        DispatchQueue.main.async { self.onResult(outcome) }
    }
}

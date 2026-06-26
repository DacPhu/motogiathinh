import UIKit
import VisionKit

/// VisionKit-based scanner (iOS 16+) — the same engine as the iPhone Camera app,
/// with built-in distance guidance. Falls back to QRScannerViewController when
/// unavailable (older devices, simulator, restricted locales).
@available(iOS 16.0, *)
class DataScannerScanner: UIViewController, DataScannerViewControllerDelegate {

    static func isAvailable() -> Bool {
        return DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    private let quality: Int
    private let hint: String
    private let cancelText: String
    private let onResult: (QrScanOutcome) -> Void
    private var scanner: DataScannerViewController?
    private var done = false
    private var resolved = false

    init(quality: Int, hint: String, cancelText: String, onResult: @escaping (QrScanOutcome) -> Void) {
        self.quality = quality
        self.hint = hint
        self.cancelText = cancelText
        self.onResult = onResult
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("not supported") }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let s = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .accurate,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: true,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        s.delegate = self
        addChild(s)
        s.view.frame = view.bounds
        s.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(s.view)
        s.didMove(toParent: self)
        scanner = s

        addChrome()
        try? s.startScanning()
    }

    private func addChrome() {
        let label = UILabel()
        label.text = hint
        label.textColor = .white
        label.font = .systemFont(ofSize: 15, weight: .semibold)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.frame = CGRect(x: 24, y: view.safeAreaInsets.top + 60, width: view.bounds.width - 48, height: 50)
        label.autoresizingMask = [.flexibleWidth, .flexibleBottomMargin]
        view.addSubview(label)

        let cancel = UIButton(type: .system)
        cancel.setTitle(cancelText, for: .normal)
        cancel.setTitleColor(.white, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        cancel.backgroundColor = UIColor(white: 0.12, alpha: 0.92)
        cancel.layer.cornerRadius = 12
        cancel.frame = CGRect(x: 16, y: view.bounds.height - 96, width: view.bounds.width - 32, height: 52)
        cancel.autoresizingMask = [.flexibleTopMargin, .flexibleWidth]
        cancel.addTarget(self, action: #selector(onCancel), for: .touchUpInside)
        view.addSubview(cancel)
    }

    @objc private func onCancel() {
        finish(.cancelled)
    }

    func dataScanner(_ dataScanner: DataScannerViewController,
                     didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        handle(addedItems)
    }

    func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
        handle([item])
    }

    private func handle(_ items: [RecognizedItem]) {
        if done { return }
        for case let .barcode(barcode) in items {
            guard let raw = barcode.payloadStringValue, !raw.isEmpty else { continue }
            done = true
            let q = CGFloat(quality) / 100.0
            Task { [weak self] in
                guard let self = self else { return }
                var jpeg: Data?
                var w = 0, h = 0
                if let image = try? await self.scanner?.capturePhoto() {
                    jpeg = image.jpegData(compressionQuality: q)
                    w = Int(image.size.width * image.scale)
                    h = Int(image.size.height * image.scale)
                }
                self.finish(.success(raw: raw, jpeg: jpeg, width: w, height: h, engine: "visionkit"))
            }
            break
        }
    }

    private func finish(_ outcome: QrScanOutcome) {
        if resolved { return }
        resolved = true
        DispatchQueue.main.async {
            self.scanner?.stopScanning()
            self.onResult(outcome)
        }
    }
}

import Foundation

/// Result handed back from a scanner view controller to the plugin.
enum QrScanOutcome {
    case success(raw: String, jpeg: Data?, width: Int, height: Int, engine: String)
    case cancelled
    case failure(String)
}

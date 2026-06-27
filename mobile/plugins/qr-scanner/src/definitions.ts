export interface ScanOptions {
  /** Barcode formats to detect. Defaults to ['QR_CODE']. */
  formats?: ('QR_CODE')[];
  /**
   * How the captured still (the locked frame) is returned:
   *  - 'file'   → a `file://` path in the app cache (default; cheap over the bridge)
   *  - 'base64' → a bare base64 JPEG string (no `data:` prefix)
   *  - 'none'   → no image (raw only)
   */
  imageReturn?: 'file' | 'base64' | 'none';
  /** JPEG quality 0..100 for the returned still. Default 85. */
  imageQuality?: number;
  /** Ramp optical/digital zoom toward the code when it is small/distant. Default true. */
  autoZoom?: boolean;
  /** Show a torch (flashlight) toggle in the scanner UI. Default true. */
  torchButton?: boolean;
  /** Localized UI strings. */
  strings?: {
    title?: string;
    hint?: string;
    cancel?: string;
  };
}

export interface ScanResult {
  /** The decoded payload (for CCCD: the pipe-delimited string). */
  raw: string;
  format: string;
  /** Present when imageReturn==='file'. A `file://` URI (use Capacitor.convertFileSrc). */
  savedUri?: string;
  /** Present when imageReturn==='base64'. Bare base64 JPEG (no data: prefix). */
  imageBase64?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Which native engine produced the result. */
  engine?: 'visionkit' | 'avfoundation' | 'mlkit-camerax';
}

export interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'limited';
}

export interface MgtQrScannerPlugin {
  /**
   * Open a full-screen live scanner. Resolves with the decoded value + the
   * locked frame as an image on a successful lock. REJECTS with code
   * `'cancelled'` if the user backs out, or `'unavailable'` on the web.
   */
  scan(options?: ScanOptions): Promise<ScanResult>;
  /** Dismiss an in-flight scanner (no-op if none open). */
  cancel(): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
}

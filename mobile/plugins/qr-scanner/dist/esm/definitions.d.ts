export interface ScanOptions {
  formats?: ('QR_CODE')[];
  imageReturn?: 'file' | 'base64' | 'none';
  imageQuality?: number;
  autoZoom?: boolean;
  torchButton?: boolean;
  strings?: {
    title?: string;
    hint?: string;
    cancel?: string;
  };
}
export interface ScanResult {
  raw: string;
  format: string;
  savedUri?: string;
  imageBase64?: string;
  imageWidth?: number;
  imageHeight?: number;
  engine?: 'visionkit' | 'avfoundation' | 'mlkit-camerax';
}
export interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'limited';
}
export interface MgtQrScannerPlugin {
  scan(options?: ScanOptions): Promise<ScanResult>;
  cancel(): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
}

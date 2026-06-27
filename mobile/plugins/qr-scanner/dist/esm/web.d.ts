import { WebPlugin } from '@capacitor/core';
import type { MgtQrScannerPlugin, PermissionStatus, ScanResult } from './definitions';
export declare class MgtQrScannerWeb extends WebPlugin implements MgtQrScannerPlugin {
  scan(): Promise<ScanResult>;
  cancel(): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
}

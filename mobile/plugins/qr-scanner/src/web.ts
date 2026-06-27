import { WebPlugin } from '@capacitor/core';

import type {
  MgtQrScannerPlugin,
  PermissionStatus,
  ScanResult,
} from './definitions';

/**
 * Web stub. The portal also runs as a website; on web `native-bridge.js`
 * returns early and never calls this, but the module must still load.
 */
export class MgtQrScannerWeb extends WebPlugin implements MgtQrScannerPlugin {
  async scan(): Promise<ScanResult> {
    throw this.unavailable('MgtQrScanner is only available on a native device.');
  }
  async cancel(): Promise<void> {
    /* no-op on web */
  }
  async checkPermissions(): Promise<PermissionStatus> {
    return { camera: 'prompt' };
  }
  async requestPermissions(): Promise<PermissionStatus> {
    return { camera: 'prompt' };
  }
}

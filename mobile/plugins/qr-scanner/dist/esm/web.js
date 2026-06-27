import { WebPlugin } from '@capacitor/core';
export class MgtQrScannerWeb extends WebPlugin {
    async scan() {
        throw this.unavailable('MgtQrScanner is only available on a native device.');
    }
    async cancel() { }
    async checkPermissions() {
        return { camera: 'prompt' };
    }
    async requestPermissions() {
        return { camera: 'prompt' };
    }
}

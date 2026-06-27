import { registerPlugin } from '@capacitor/core';
const MgtQrScanner = registerPlugin('MgtQrScanner', {
    web: () => import('./web').then((m) => new m.MgtQrScannerWeb()),
});
export * from './definitions';
export { MgtQrScanner };

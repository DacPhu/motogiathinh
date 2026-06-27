import { registerPlugin } from '@capacitor/core';

import type { MgtQrScannerPlugin } from './definitions';

const MgtQrScanner = registerPlugin<MgtQrScannerPlugin>('MgtQrScanner', {
  web: () => import('./web').then((m) => new m.MgtQrScannerWeb()),
});

export * from './definitions';
export { MgtQrScanner };

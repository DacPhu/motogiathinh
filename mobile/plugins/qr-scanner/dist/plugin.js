var mgtQrScanner = (function (exports, core) {
    'use strict';

    const MgtQrScanner = core.registerPlugin('MgtQrScanner', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.MgtQrScannerWeb()),
    });

    class MgtQrScannerWeb extends core.WebPlugin {
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

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        MgtQrScannerWeb: MgtQrScannerWeb
    });

    exports.MgtQrScanner = MgtQrScanner;
    exports.MgtQrScannerWeb = MgtQrScannerWeb;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({}, capacitorExports);

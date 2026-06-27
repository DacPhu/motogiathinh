#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register the plugin + its callable methods with the Capacitor bridge.
CAP_PLUGIN(MgtQrScannerPlugin, "MgtQrScanner",
           CAP_PLUGIN_METHOD(scan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancel, CAPPluginReturnPromise);
)

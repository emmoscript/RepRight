/**
 * react-native-fast-tflite@1.6.x fixes for Expo SDK 52 / RN 0.76:
 *
 * 1. JS: TurboModuleRegistry.getEnforcing('Tflite') fails when the native
 *    TurboModule path is broken; fall back to NativeModules without crashing
 *    at import time.
 * 2. iOS: Use legacy RCTBridgeModule + RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD
 *    (v1.4-style). The v1.6 TurboModule getTurboModule path is unreliable on
 *    iOS production builds; legacy registration works via RN interop.
 *
 * Applied on every npm install (including EAS Build).
 */
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..', 'node_modules', 'react-native-fast-tflite');

const NATIVE_RN_TFLITE = `import type { TurboModule } from 'react-native'
import { NativeModules, TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  install(): boolean
}

/** Prefer TurboModule; fall back to legacy NativeModules.Tflite (Old Arch / interop). */
const linked = TurboModuleRegistry.get<Spec>('Tflite') ?? (NativeModules.Tflite as Spec | undefined)

const unlinked: Spec = {
  install: () => false,
}

export default (linked ?? unlinked) as Spec
`;

const TFLITE_H = `#import <React/RCTBridgeModule.h>

@interface Tflite : NSObject <RCTBridgeModule>
@end
`;

const TFLITE_MM = `#import "Tflite.h"
#import "../cpp/TensorflowPlugin.h"
#import <React-callinvoker/ReactCommon/CallInvoker.h>
#import <React/RCTBridge+Private.h>
#import <jsi/jsi.h>
#import <string>

@interface RCTBridge (RCTTurboModule)
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;
@end

using namespace facebook;

@implementation Tflite
RCT_EXPORT_MODULE(Tflite)

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  RCTBridge* bridge = [RCTBridge currentBridge];
  RCTCxxBridge* cxxBridge = (RCTCxxBridge*)bridge;
  if (!cxxBridge.runtime) {
    return @(false);
  }
  jsi::Runtime& runtime = *(jsi::Runtime*)cxxBridge.runtime;

  auto fetchByteDataFromUrl = [](std::string url) {
    NSString* string = [NSString stringWithUTF8String:url.c_str()];
    NSLog(@"Fetching %@...", string);
    NSURL* nsURL = [NSURL URLWithString:string];
    NSData* contents = [NSData dataWithContentsOfURL:nsURL];

    void* data = malloc(contents.length * sizeof(uint8_t));
    memcpy(data, contents.bytes, contents.length);
    return Buffer{.data = data, .size = contents.length};
  };

  try {
    TensorflowPlugin::installToRuntime(runtime, [bridge jsCallInvoker], fetchByteDataFromUrl);
  } catch (std::exception& exc) {
    NSLog(@"Failed to install TensorFlow Lite plugin to Runtime! %s", exc.what());
    return @(false);
  }

  return @(true);
}

@end
`;

function writeIfChanged(filePath, content, label) {
  if (!fs.existsSync(path.dirname(filePath))) return false;
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current === content) {
    console.log(`[patch-fast-tflite] ${label} already applied`);
    return false;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-fast-tflite] ${label} applied`);
  return true;
}

function main() {
  if (!fs.existsSync(pkgRoot)) {
    console.log('[patch-fast-tflite] react-native-fast-tflite not installed — skip');
    return;
  }

  writeIfChanged(
    path.join(pkgRoot, 'spec', 'NativeRNTflite.ts'),
    NATIVE_RN_TFLITE,
    'spec/NativeRNTflite.ts',
  );
  writeIfChanged(path.join(pkgRoot, 'ios', 'Tflite.h'), TFLITE_H, 'ios/Tflite.h');
  writeIfChanged(path.join(pkgRoot, 'ios', 'Tflite.mm'), TFLITE_MM, 'ios/Tflite.mm');
}

main();

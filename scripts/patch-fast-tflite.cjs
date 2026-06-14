/**
 * react-native-fast-tflite@1.6.x calls TurboModuleRegistry.getEnforcing('Tflite'),
 * which fails when New Architecture is disabled (Old Arch uses NativeModules.Tflite).
 * Applied on every npm install (including EAS Build).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-fast-tflite',
  'spec',
  'NativeRNTflite.ts',
);

const PATCHED = `import type { TurboModule } from 'react-native'
import { NativeModules, TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  install(): boolean
}

/** Old Architecture registers \`Tflite\` via RCT_EXPORT_MODULE, not TurboModuleRegistry. */
const module = TurboModuleRegistry.get<Spec>('Tflite') ?? NativeModules.Tflite

if (module == null) {
  throw new Error(
    "The 'Tflite' native module is not linked. Rebuild the iOS/Android app after installing react-native-fast-tflite.",
  )
}

export default module as Spec
`;

function main() {
  if (!fs.existsSync(target)) {
    console.log('[patch-fast-tflite] react-native-fast-tflite not installed — skip');
    return;
  }

  const current = fs.readFileSync(target, 'utf8');
  if (current.includes('NativeModules.Tflite')) {
    console.log('[patch-fast-tflite] already applied');
    return;
  }

  fs.writeFileSync(target, PATCHED, 'utf8');
  console.log('[patch-fast-tflite] applied NativeModules.Tflite fallback');
}

main();

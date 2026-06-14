const { spawnSync } = require('child_process');

const patchPackage = spawnSync('npx', ['patch-package'], {
  stdio: 'inherit',
  shell: true,
});

if (patchPackage.status !== 0) {
  console.warn(
    `[postinstall] patch-package exited with code ${patchPackage.status ?? 'unknown'} — continuing`,
  );
}

require('./patch-fast-tflite.cjs');

/**
 * iOS App Store requires exactly 1024×1024 PNG (no alpha). Canva exports are often 1000×1000.
 * Usage: node scripts/prepare-app-icon.cjs [source.png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const source = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'assets', 'icon.png');
const outAssets = path.join(root, 'assets', 'icon.png');
const outIos = path.join(
  root,
  'ios',
  'RepRight',
  'Images.xcassets',
  'AppIcon.appiconset',
  'App-Icon-1024x1024@1x.png',
);

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Source icon not found:', source);
    process.exit(1);
  }

  const buf = await sharp(source)
    .resize(1024, 1024, { fit: 'fill' })
    .flatten({ background: '#0D0D0D' })
    .png({ compressionLevel: 9, force: true })
    .toBuffer();

  const meta = await sharp(buf).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`Expected 1024×1024, got ${meta.width}×${meta.height}`);
  }
  if (meta.hasAlpha) {
    throw new Error('App Store icon must not have alpha channel');
  }

  fs.writeFileSync(outAssets, buf);
  fs.writeFileSync(outIos, buf);
  console.log(`[prepare-app-icon] wrote 1024×1024 RGB PNG → assets/icon.png + iOS AppIcon`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

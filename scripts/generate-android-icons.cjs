/**
 * One-off helper: resize assets/icon.png into Android mipmap webp launchers.
 * Usage: node scripts/generate-android-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const source = path.join(root, 'assets', 'icon.png');
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Missing assets/icon.png');
    process.exit(1);
  }

  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(resRoot, folder);
    const buf = await sharp(source).resize(size, size).webp({ quality: 92 }).toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.webp'), buf);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.webp'), buf);
    console.log(`wrote ${folder} ${size}px`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

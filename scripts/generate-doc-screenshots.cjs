/**
 * Generates academic doc screenshots (390×844) from static HTML mocks.
 * Run: node scripts/generate-doc-screenshots.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots', 'academic');
const TEMPLATES_DIR = path.join(ROOT, 'docs', 'screenshots', 'templates');

const SCREENS = [
  { id: '01-onboarding', file: '01-onboarding.html', title: 'Onboarding' },
  { id: '02-home', file: '02-home.html', title: 'Home' },
  { id: '03-configure-session', file: '03-configure-session.html', title: 'Configure Session' },
  { id: '04-live-session', file: '04-live-session.html', title: 'Live Session' },
  { id: '05-session-complete', file: '05-session-complete.html', title: 'Session Complete' },
  { id: '06-paywall', file: '06-paywall.html', title: 'Paywall' },
  { id: '07-stats-free', file: '07-stats-free.html', title: 'Stats (Free)' },
  { id: '08-profile-subscription', file: '08-profile-subscription.html', title: 'Profile + Subscription' },
  { id: '09-welcome', file: '09-welcome.html', title: 'Welcome / Auth' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.log('Installing puppeteer (one-time)...');
    require('child_process').execSync('npm install --no-save puppeteer@23', {
      cwd: ROOT,
      stdio: 'inherit',
    });
    puppeteer = require('puppeteer');
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  for (const screen of SCREENS) {
    const htmlPath = path.join(TEMPLATES_DIR, screen.file);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`Skip ${screen.id}: missing ${htmlPath}`);
      continue;
    }
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');
    const outPath = path.join(OUT_DIR, `${screen.id}.png`);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`✓ ${screen.id}.png — ${screen.title}`);
  }

  await browser.close();
  console.log(`\nSaved ${SCREENS.length} screenshots to docs/screenshots/academic/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

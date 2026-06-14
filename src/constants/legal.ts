/** Public legal URLs — enable GitHub Pages on /docs or host elsewhere and update here. */
const GITHUB_PAGES_BASE =
  (process.env.EXPO_PUBLIC_LEGAL_BASE_URL ?? 'https://emmoscript.github.io/RepRight').replace(
    /\/$/,
    '',
  );

export const LEGAL_URLS = {
  privacy: `${GITHUB_PAGES_BASE}/legal/privacy.html`,
  terms: `${GITHUB_PAGES_BASE}/legal/terms.html`,
} as const;

export const SUPPORT_EMAIL =
  (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'hello.repright@yahoo.com').trim();

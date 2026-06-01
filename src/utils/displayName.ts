import i18n from '@/i18n';

/** Title-case each whitespace-delimited word (email local-part friendly). */
function capitalizeWords(raw: string): string {
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveDisplayName(opts: {
  displayName?: string | null;
  email?: string | null;
  isGuest?: boolean;
}): string {
  const trimmed = opts.displayName?.trim();
  if (trimmed) return trimmed;
  if (opts.isGuest) return i18n.t('common.guest');
  const local = opts.email?.split('@')[0]?.trim();
  if (local) return capitalizeWords(local);
  return i18n.t('common.athlete');
}

export class EmailNotConfirmedError extends Error {
  readonly code = 'EMAIL_NOT_CONFIRMED' as const;

  constructor(message = 'Please confirm your email before signing in.') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}

export class OAuthCancelledError extends Error {
  readonly code = 'OAUTH_CANCELLED' as const;

  constructor(message = 'Sign in cancelled.') {
    super(message);
    this.name = 'OAuthCancelledError';
  }
}

export function isEmailNotConfirmedError(err: unknown): err is EmailNotConfirmedError {
  return err instanceof EmailNotConfirmedError;
}

export function isOAuthCancelledError(err: unknown): err is OAuthCancelledError {
  return err instanceof OAuthCancelledError;
}

export function isSupabaseEmailNotConfirmedMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('email not confirmed') ||
    m.includes('email link is invalid or has expired') ||
    m.includes('email_not_confirmed')
  );
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Map fetch / Supabase transport errors to a user-facing message. */
export function formatAuthErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return 'Could not reach the server. Check your internet connection, Supabase URL in .env, and restart Metro after changing .env.';
  }

  if (lower.includes('database error saving new user')) {
    return 'Database error creating your account. Usually the user_profiles signup trigger or auth_provider constraint — run supabase/fix_signup.sql in the Supabase SQL Editor.';
  }

  if (code === 'over_email_send_rate_limit' || lower.includes('email rate limit')) {
    return 'Too many verification emails were sent from this project. Wait about an hour and try again, or ask the project owner to adjust Supabase Auth email limits.';
  }

  if (
    code === 'invalid_credentials' ||
    code === 'invalid_login_credentials' ||
    lower.includes('invalid login credentials')
  ) {
    return 'Incorrect password for this email. Tap Forgot password to get a reset link, or ask the project owner to send one from Supabase → Authentication → Users.';
  }

  if (!message.trim()) return 'Authentication failed';
  return message;
}

export class EmailNotConfirmedError extends Error {
  readonly code = 'EMAIL_NOT_CONFIRMED' as const;

  constructor(message = 'Please confirm your email before signing in.') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}

export function isEmailNotConfirmedError(err: unknown): err is EmailNotConfirmedError {
  return err instanceof EmailNotConfirmedError;
}

export function isSupabaseEmailNotConfirmedMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('email not confirmed') || m.includes('email link is invalid or has expired');
}

import { formFeedbackLiveForError } from '@/utils/formFeedbackLive';

describe('formFeedbackLiveForError — ERR_003 (bar close)', () => {
  it('does not cue bar drift before standing baseline exists', () => {
    expect(
      formFeedbackLiveForError('ERR_003', 'need_setup', 0.52, null, 0, 'mid_pull'),
    ).toBe(false);
  });

  it('does not cue bar drift while standing idle', () => {
    expect(
      formFeedbackLiveForError('ERR_003', 'need_setup', 0.44, 0.44, 0, 'setup'),
    ).toBe(false);
  });

  it('cues bar drift at hinged setup, not only mid-pull', () => {
    expect(
      formFeedbackLiveForError('ERR_003', 'need_setup', 0.54, 0.50, 0, 'setup'),
    ).toBe(true);
  });

  it('cues bar drift during the pull', () => {
    expect(
      formFeedbackLiveForError('ERR_003', 'need_lockout', 0.50, 0.44, 0.52, 'mid_pull'),
    ).toBe(true);
  });

  it('does not cue bar drift during lockout phase', () => {
    expect(
      formFeedbackLiveForError('ERR_003', 'need_lockout', 0.48, 0.50, 0.55, 'lockout'),
    ).toBe(false);
  });

  it('does not cue rounding before standing baseline exists', () => {
    expect(
      formFeedbackLiveForError('ERR_001', 'need_lockout', 0.52, null, 0.55, 'pull_initiation'),
    ).toBe(false);
  });
});

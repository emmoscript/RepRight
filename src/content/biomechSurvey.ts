/** Bump when questions or scoring change — one submission per owner per version. */
export const BIOMECH_SURVEY_VERSION = '2026-06-v1';

export const BIOMECH_SURVEY_MAX_SCORE = 10;

export type SurveyOptionId = 'a' | 'b' | 'c';

export type BiomechQuestionDef = {
  id: string;
  correctOptionId: SurveyOptionId;
};

export const BIOMECH_QUESTIONS: BiomechQuestionDef[] = [
  { id: 'q1', correctOptionId: 'a' },
  { id: 'q2', correctOptionId: 'c' },
  { id: 'q3', correctOptionId: 'c' },
  { id: 'q4', correctOptionId: 'a' },
  { id: 'q5', correctOptionId: 'b' },
  { id: 'q6', correctOptionId: 'a' },
  { id: 'q7', correctOptionId: 'a' },
  { id: 'q8', correctOptionId: 'b' },
  { id: 'q9', correctOptionId: 'c' },
  { id: 'q10', correctOptionId: 'b' },
];

export type BiomechSurveyAnswer = {
  questionId: string;
  optionId: SurveyOptionId | '';
  correct: boolean;
};

export function scoreBiomechAnswers(
  answers: Record<string, SurveyOptionId | undefined>,
): { score: number; payload: BiomechSurveyAnswer[] } {
  let score = 0;
  const payload: BiomechSurveyAnswer[] = BIOMECH_QUESTIONS.map((q) => {
    const optionId = answers[q.id] ?? '';
    const correct = optionId === q.correctOptionId;
    if (correct) score += 1;
    return { questionId: q.id, optionId, correct };
  });
  return { score, payload };
}

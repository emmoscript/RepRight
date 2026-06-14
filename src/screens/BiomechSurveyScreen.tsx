import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { UnderlineField } from '@/components/UnderlineField';
import {
  BIOMECH_QUESTIONS,
  BIOMECH_SURVEY_MAX_SCORE,
  type SurveyOptionId,
} from '@/content/biomechSurvey';
import { hasCompletedBiomechSurvey } from '@/constants/researchSurvey';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { isValidEmail, submitBiomechSurvey } from '@/lib/submitBiomechSurvey';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Step = 'intro' | 'quiz' | 'complete';

const OPTION_IDS: SurveyOptionId[] = ['a', 'b', 'c'];

export function BiomechSurveyScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const accountEmail = useAuthStore((s) => s.user?.email ?? '');

  const [step, setStep] = useState<Step>('intro');
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState(accountEmail);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SurveyOptionId | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    void hasCompletedBiomechSurvey().then((done) => {
      if (done) {
        setAlreadyDone(true);
        setStep('complete');
      }
    });
  }, []);

  useEffect(() => {
    if (accountEmail.trim()) setEmail(accountEmail.trim());
  }, [accountEmail]);

  const currentQuestion = BIOMECH_QUESTIONS[questionIndex];
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : undefined;
  const needsEmail = !isLoggedIn || !accountEmail.trim();

  const progressPct = useMemo(() => {
    if (step !== 'quiz') return 0;
    return ((questionIndex + 1) / BIOMECH_QUESTIONS.length) * 100;
  }, [step, questionIndex]);

  const handleBack = useCallback(() => {
    if (step === 'quiz' && questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
      return;
    }
    nav.goBack();
  }, [nav, questionIndex, step]);

  const startQuiz = useCallback(() => {
    if (!consent) return;
    if (needsEmail && !isValidEmail(email)) {
      Alert.alert(t('biomechSurvey.emailRequired'));
      return;
    }
    setQuestionIndex(0);
    setStep('quiz');
  }, [consent, email, needsEmail, t]);

  const selectOption = useCallback((optionId: SurveyOptionId) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  }, [currentQuestion]);

  const goNext = useCallback(async () => {
    if (!currentQuestion || !selectedOption) {
      Alert.alert(t('biomechSurvey.selectAnswer'));
      return;
    }

    if (questionIndex < BIOMECH_QUESTIONS.length - 1) {
      setQuestionIndex((i) => i + 1);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...answers,
        [currentQuestion.id]: selectedOption,
      };
      const result = await submitBiomechSurvey(payload, email);
      if (!result.ok) {
        Alert.alert(t('biomechSurvey.submitError'));
        return;
      }
      setFinalScore(result.score);
      setAlreadyDone(result.alreadySubmitted);
      setStep('complete');
    } finally {
      setSubmitting(false);
    }
  }, [answers, currentQuestion, email, questionIndex, selectedOption, t]);

  const finish = useCallback(() => {
    nav.goBack();
  }, [nav]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
          style={styles.backBtn}
          disabled={submitting}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text_primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('biomechSurvey.screenTitle')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === 'quiz' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 'complete' ? (
          <View style={styles.completeShell}>
            <View style={styles.completeCard}>
              <View style={styles.completeBadge}>
                <Ionicons name="checkmark" size={36} color={colors.primary_green} />
              </View>

              <Text style={styles.completeTitle}>{t('biomechSurvey.completeTitle')}</Text>

              {alreadyDone && finalScore === null ? (
                <Text style={styles.completeBody}>{t('biomechSurvey.alreadyCompleted')}</Text>
              ) : (
                <>
                  <View style={styles.scoreRing}>
                    <Text style={styles.scoreValue}>{finalScore ?? 0}</Text>
                    <Text style={styles.scoreDivider}>/</Text>
                    <Text style={styles.scoreMax}>{BIOMECH_SURVEY_MAX_SCORE}</Text>
                  </View>
                  <Text style={styles.scoreCaption}>{t('biomechSurvey.pointsLabel')}</Text>
                  <Text style={styles.completeBody}>{t('biomechSurvey.completeBody')}</Text>
                </>
              )}
            </View>

            <PrimaryButton
              title={t('biomechSurvey.doneCta')}
              onPress={finish}
              style={styles.completeCta}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'intro' ? (
            <>
              <Text style={styles.kicker}>{t('home.surveyPrompt.kicker')}</Text>
              <Text style={styles.title}>{t('biomechSurvey.introTitle')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introGreeting')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introObjective')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introTime')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introPrivacy')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introVoluntary')}</Text>
              <Text style={styles.paragraph}>{t('biomechSurvey.introScoring')}</Text>
              <Text style={styles.consentNote}>{t('biomechSurvey.introConsent')}</Text>

              {needsEmail ? (
                <UnderlineField
                  label={t('biomechSurvey.emailLabel')}
                  placeholder={t('biomechSurvey.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              ) : (
                <View style={styles.emailBox}>
                  <Text style={styles.emailLabel}>{t('biomechSurvey.accountEmailLabel')}</Text>
                  <Text style={styles.emailValue}>{accountEmail.trim()}</Text>
                </View>
              )}

              <Pressable
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                onPress={() => setConsent((v) => !v)}
              >
                <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                  {consent ? (
                    <Ionicons name="checkmark" size={14} color={colors.text_on_green} />
                  ) : null}
                </View>
                <Text style={styles.consentTxt}>{t('biomechSurvey.consentCheckbox')}</Text>
              </Pressable>

              <PrimaryButton
                title={t('biomechSurvey.startCta')}
                onPress={startQuiz}
                disabled={!consent || (needsEmail && !email.trim())}
                style={styles.primaryCta}
              />
            </>
          ) : null}

          {step === 'quiz' && currentQuestion ? (
            <>
              <Text style={styles.progressLabel}>
                {t('biomechSurvey.progress', {
                  current: questionIndex + 1,
                  total: BIOMECH_QUESTIONS.length,
                })}
              </Text>
              <Text style={styles.questionPrompt}>
                {t(`biomechSurvey.questions.${currentQuestion.id}.prompt`)}
              </Text>

              {OPTION_IDS.map((optionId) => {
                const selected = selectedOption === optionId;
                return (
                  <Pressable
                    key={optionId}
                    style={[styles.option, selected && styles.optionSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => selectOption(optionId)}
                  >
                    <View style={[styles.optionBullet, selected && styles.optionBulletSelected]}>
                      {selected ? <View style={styles.optionBulletInner} /> : null}
                    </View>
                    <Text style={[styles.optionTxt, selected && styles.optionTxtSelected]}>
                      {t(`biomechSurvey.questions.${currentQuestion.id}.options.${optionId}`)}
                    </Text>
                  </Pressable>
                );
              })}

              <PrimaryButton
                title={
                  submitting
                    ? t('biomechSurvey.submitting')
                    : questionIndex === BIOMECH_QUESTIONS.length - 1
                      ? t('biomechSurvey.submit')
                      : t('biomechSurvey.next')
                }
                onPress={() => void goNext()}
                disabled={!selectedOption || submitting}
                style={styles.primaryCta}
              />
            </>
          ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  headerSpacer: { width: 44 },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border_subtle,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary_green,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  kicker: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 24,
    color: colors.text_primary,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  paragraph: {
    marginTop: 12,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text_secondary,
  },
  consentNote: {
    marginTop: 16,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text_primary,
  },
  emailBox: {
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: colors.surface_v3,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  emailLabel: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emailValue: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border_medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: colors.primary_green,
    borderColor: colors.primary_green,
  },
  consentTxt: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text_primary,
  },
  primaryCta: { marginTop: 24 },
  progressLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: colors.text_muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  questionPrompt: {
    marginTop: 12,
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text_primary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface_v3,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  optionSelected: {
    borderColor: colors.primary_green,
    backgroundColor: colors.green_subtle_bg,
  },
  optionBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border_medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  optionBulletSelected: { borderColor: colors.primary_green },
  optionBulletInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary_green,
  },
  optionTxt: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text_secondary,
  },
  optionTxtSelected: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
  },
  completeShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  completeCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface_v3,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: colors.border_subtle,
    shadowColor: colors.primary_green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  completeBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green_subtle_bg,
    borderWidth: 2,
    borderColor: colors.primary_green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    marginTop: 20,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.text_primary,
    textAlign: 'center',
  },
  scoreRing: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: colors.green_subtle_bg,
    borderWidth: 1,
    borderColor: 'rgba(39,195,79,0.35)',
  },
  scoreValue: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 52,
    lineHeight: 52,
    color: colors.primary_green,
    letterSpacing: -1,
  },
  scoreDivider: {
    marginHorizontal: 6,
    marginBottom: 6,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 28,
    color: colors.text_muted,
  },
  scoreMax: {
    marginBottom: 8,
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    color: colors.text_secondary,
  },
  scoreCaption: {
    marginTop: 12,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: colors.text_muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  completeBody: {
    marginTop: 16,
    fontFamily: typography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text_secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  completeCta: {
    marginTop: 28,
    width: '100%',
  },
});

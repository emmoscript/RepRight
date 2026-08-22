import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermission, useCameraDevices } from 'react-native-vision-camera';

import { warmUpCameraEnumeration } from '@/hooks/useResolvedCamera';

import { Icon, ICONS } from '@/components/Icon';
import { GetStartedPanel } from '@/components/onboarding/GetStartedPanel';
import { LanguageCard } from '@/components/onboarding/LanguageCard';
import { OnboardingNavBar } from '@/components/onboarding/OnboardingNavBar';
import { OnboardingProgressBar } from '@/components/onboarding/OnboardingProgressBar';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const DEMO_IMAGE = require('../../assets/images/movenet-demo-image.png');
const GYM_IMAGE = require('../../assets/images/woman-deadlift.jpg');
const APP_ICON = require('../../assets/icon.png');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DemoRoute = RouteProp<RootStackParamList, 'Demo'>;
type TFn = ReturnType<typeof useTranslation>['t'];

const STEP_COUNT = 4;

/** Vertical rhythm — matches mock margin-mobile (20) + section spacing. */
const PAD_H = 20;
const HEADER_TOP = 8;
const PROGRESS_GAP = 16;
const CONTENT_TOP = 24;
const CONTENT_BOTTOM = 32;

export function DemoScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<DemoRoute>();

  const enterAsGuest = useAuthStore((s) => s.enterAsGuest);
  const onboardingCompleted = useUserPreferencesStore((s) => s.onboardingCompleted);
  const language = useUserPreferencesStore((s) => s.language);
  const setLanguage = useUserPreferencesStore((s) => s.setLanguage);
  const completeOnboarding = useUserPreferencesStore((s) => s.completeOnboarding);

  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraDevices = useCameraDevices();
  const [step, setStep] = useState(() => route.params?.docStep ?? 0);

  useEffect(() => {
    if (route.params?.docStep != null) {
      setStep(route.params.docStep);
    }
  }, [route.params?.docStep]);

  const requestCam = useCallback(async () => {
    await requestPermission();
    await warmUpCameraEnumeration();
  }, [requestPermission]);

  useEffect(() => {
    if (step !== 2) return;
    void requestCam();
  }, [step, requestCam]);

  useEffect(() => {
    if (onboardingCompleted) {
      nav.replace('Welcome');
    }
  }, [onboardingCompleted, nav]);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }, []);

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const finishAndNavigate = useCallback(
    async (dest: 'guest' | 'login' | 'signup') => {
      await completeOnboarding();
      if (dest === 'guest') {
        await enterAsGuest();
        nav.navigate('MainTabs', { screen: 'HomeMain' });
      } else if (dest === 'login') {
        nav.navigate('AuthGateway', { mode: 'login' });
      } else {
        nav.navigate('AuthGateway', { mode: 'signup' });
      }
    },
    [completeOnboarding, enterAsGuest, nav],
  );

  const isFirstStep = step === 0;
  const isLastStep = step === STEP_COUNT - 1;
  const isCameraStep = step === 2;
  const progress = (step + 1) / STEP_COUNT;
  const canContinueCamera = hasPermission && cameraDevices.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.progressWrap}>
          <OnboardingProgressBar progress={progress} />
        </View>
        <View style={styles.topBar}>
          <Icon name={ICONS.barbell} size={22} color={colors.primary_green} />
          <Text style={styles.stepLabel}>
            {t('onboarding.stepOf', { current: step + 1, total: STEP_COUNT })}
          </Text>
          <View style={styles.topSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
          {step === 0 ? <WelcomeSlide t={t} /> : null}
          {step === 1 ? (
            <LanguageSlide t={t} language={language} onChange={(lang) => void setLanguage(lang)} />
          ) : null}
          {step === 2 ? (
            <CameraSlide
              t={t}
              hasPermission={hasPermission}
              deviceCount={cameraDevices.length}
              onRequest={requestCam}
            />
          ) : null}
          {step === 3 ? (
            <GetStartedPanel
              onCreate={() => void finishAndNavigate('signup')}
              onLogin={() => void finishAndNavigate('login')}
              onGuest={() => void finishAndNavigate('guest')}
            />
          ) : null}
        </ScrollView>

      <View style={styles.footer}>
        <OnboardingNavBar
          onBack={goPrev}
          onContinue={goNext}
          backDisabled={isFirstStep}
          continueDisabled={isCameraStep && !canContinueCamera}
          showContinue={!isLastStep}
        />
      </View>

      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
    </SafeAreaView>
  );
}

function WelcomeSlide({ t }: { t: TFn }) {
  return (
    <View style={styles.slide}>
      <View style={styles.logoBox}>
        <Image
          source={APP_ICON}
          style={styles.logoIcon}
          resizeMode="cover"
          accessibilityLabel="RepRight"
        />
      </View>

      <Text style={styles.headlineXl}>RepRight</Text>
      <Text style={styles.tagline}>
        {t('onboarding.welcomeTaglineLead')}{' '}
        <Text style={styles.taglineAccent}>{t('onboarding.welcomeTaglineAccent')}</Text>
      </Text>
      <Text style={styles.bodyCenter}>{t('onboarding.welcomeBody')}</Text>

      <View style={styles.heroVideo}>
        <Image source={DEMO_IMAGE} style={styles.heroImg} resizeMode="cover" />
        <View style={styles.heroGradient} />
        <View style={styles.detectFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.detectBadge}>
            <Text style={styles.detectBadgeTxt}>{t('onboarding.formDetected')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function LanguageSlide({
  t,
  language,
  onChange,
}: {
  t: TFn;
  language: 'en' | 'es';
  onChange: (lang: 'en' | 'es') => void;
}) {
  return (
    <View style={styles.slide}>
      <View style={styles.langHeader}>
        <Text style={styles.headlineLg}>{t('onboarding.languageTitleBilingual')}</Text>
        <Text style={styles.bodyLeft}>{t('onboarding.languageSub')}</Text>
      </View>

      <View style={styles.langGrid}>
        <LanguageCard
          flag="🇺🇸"
          label={t('common.english')}
          selected={language === 'en'}
          onPress={() => onChange('en')}
        />
        <LanguageCard
          flag="🇩🇴"
          label={t('common.spanish')}
          selected={language === 'es'}
          onPress={() => onChange('es')}
        />
      </View>

      <View style={styles.atmoImageWrap}>
        <Image source={GYM_IMAGE} style={styles.atmoImage} resizeMode="cover" />
      </View>
    </View>
  );
}

function CameraSlide({
  t,
  hasPermission,
  deviceCount,
  onRequest,
}: {
  t: TFn;
  hasPermission: boolean;
  deviceCount: number;
  onRequest: () => void;
}) {
  const ready = hasPermission && deviceCount > 0;
  const waiting = hasPermission && deviceCount === 0;

  return (
    <View style={[styles.slide, styles.slideCenter]}>
      <View style={styles.camIconWrap}>
        <View style={styles.camGlow} />
        <View style={styles.camCircle}>
          <Ionicons name="camera-outline" size={56} color={colors.primary_green} />
        </View>
      </View>

      <Text style={styles.headlineLgCenter}>{t('onboarding.cameraTitleLong')}</Text>
      <Text style={styles.bodyCenter}>
        {waiting ? t('liveSession.cameraWarmingHint') : t('onboarding.cameraSub')}
      </Text>

      <Pressable
        onPress={() => void onRequest()}
        disabled={ready}
        style={({ pressed }) => [
          styles.camAllowBtn,
          ready && styles.camAllowGranted,
          pressed && !ready && styles.pressed,
        ]}
      >
        <Ionicons
          name={ready ? 'checkmark-circle' : 'videocam-outline'}
          size={22}
          color={ready ? colors.primary_green : colors.text_on_green}
        />
        <Text style={[styles.camAllowTxt, ready && styles.camAllowTxtGranted]}>
          {ready
            ? t('onboarding.cameraGranted')
            : waiting
              ? t('liveSession.openingCamera')
              : t('onboarding.enableCamera')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg_v3,
  },
  header: {
    backgroundColor: colors.bg_v3,
  },
  progressWrap: {
    paddingHorizontal: PAD_H,
    paddingTop: HEADER_TOP,
    paddingBottom: PROGRESS_GAP,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_H,
    paddingBottom: 12,
  },
  stepLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    letterSpacing: 0.3,
  },
  topSpacer: { width: 22 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: PAD_H,
    paddingTop: CONTENT_TOP,
    paddingBottom: CONTENT_BOTTOM,
  },
  slide: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  slideCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
    backgroundColor: colors.bg_v3,
    paddingTop: 4,
  },
  actionStack: {
    marginTop: 24,
    gap: 12,
  },
  guestBlock: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  guestLink: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    letterSpacing: 0.3,
  },
  guestHint: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.text_muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: '18%',
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(39,195,79,0.06)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: '22%',
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(39,195,79,0.05)',
  },

  logoBox: {
    alignSelf: 'center',
    width: 112,
    height: 112,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132,149,133,0.25)',
  },
  logoIcon: {
    width: '100%',
    height: '100%',
  },
  headlineXl: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.on_surface,
    marginBottom: 8,
  },
  headlineLg: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: colors.on_surface,
    marginBottom: 8,
  },
  headlineLgCenter: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.on_surface,
    marginBottom: 12,
    maxWidth: 320,
  },
  tagline: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.titleSm,
    lineHeight: 32,
    color: colors.text_secondary,
    marginBottom: 12,
  },
  taglineAccent: {
    color: colors.on_surface,
  },
  bodyCenter: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
    color: colors.text_secondary,
    maxWidth: 340,
    alignSelf: 'center',
  },
  bodyLeft: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
    color: colors.text_secondary,
  },
  heroVideo: {
    marginTop: 32,
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface_container,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132,149,133,0.3)',
  },
  heroImg: { width: '100%', height: '100%', opacity: 0.55 },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'rgba(13,13,13,0.75)',
  },
  heroGradientStrong: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.55)',
  },
  detectFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(39,195,79,0.55)',
  },
  cornerTL: { top: '22%', left: '22%', borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: '22%', right: '22%', borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: '22%', left: '22%', borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: '22%', right: '22%', borderBottomWidth: 2, borderRightWidth: 2 },
  detectBadge: {
    position: 'absolute',
    top: '26%',
    left: '26%',
    backgroundColor: colors.primary_green,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  detectBadgeTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: colors.text_on_green,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  langHeader: { marginBottom: 32 },
  langGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  atmoImageWrap: {
    marginTop: 32,
    borderRadius: 12,
    overflow: 'hidden',
    height: 120,
    opacity: 0.45,
  },
  atmoImage: {
    width: '100%',
    height: '100%',
  },

  camIconWrap: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(39,195,79,0.12)',
  },
  camCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: colors.outline_variant,
    backgroundColor: colors.surface_container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camAllowBtn: {
    marginTop: 32,
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary_green,
    borderRadius: 8,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  camAllowGranted: {
    backgroundColor: colors.surface_container_high,
    borderWidth: 1,
    borderColor: colors.secondary_green,
  },
  camAllowTxt: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_on_green,
    letterSpacing: 0.3,
  },
  camAllowTxtGranted: {
    color: colors.primary_green,
  },

  getStartedHero: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface_container,
    marginBottom: 24,
  },
  getStartedCopy: {
    gap: 12,
    alignItems: 'center',
  },

  pill: {
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  pillPrimary: {
    backgroundColor: colors.primary_green,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
  pillLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: 0.3,
  },
  pillLabelPrimary: {
    color: colors.text_on_green,
  },
  pillLabelOutline: {
    color: colors.on_surface,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

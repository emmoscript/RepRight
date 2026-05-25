import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SvgArrowForwardIcon, SvgBoltIcon, SvgCameraIcon, SvgInfoOutlineIcon } from '@/components/icons/SvgUiIcons';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const DEMO_IMAGE = require('../../assets/images/movenet-demo-image.png');

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HOW_STEPS = [
  {
    num: '01',
    title: 'Position Device',
    body: 'Place your phone 5–7 feet away with a full-body view from the side.',
  },
  {
    num: '02',
    title: 'Perform Reps',
    body: 'Execute your set as normal. The AI detects start and end points automatically.',
  },
  {
    num: '03',
    title: 'Get Analysis',
    body: 'Receive instant feedback on depth, pathing, and tempo.',
  },
] as const;

export function DemoScreen() {
  const nav = useNavigation<Nav>();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <SafeAreaView style={styles.topNavSafe} edges={['top']}>
        <View style={styles.topNav} collapsable={false}>
          <SvgBoltIcon color={colors.primary_green} size={26} />
          <Text style={styles.topNavWord}>RepRight</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        contentContainerStyle={styles.scrollInner}
        style={styles.scroll}
      >
        <Text style={styles.title}>Demo mode</Text>
        <Text style={styles.subtitle}>
          Explore the full app and test AI analysis without starting a persisted workout log.
        </Text>

        <View style={styles.featureOuter}>
          <View style={styles.visCard}>
            <Image source={DEMO_IMAGE} style={styles.demoImageFull} resizeMode="cover" />
          </View>

          <View style={styles.featureBodyPad}>
            <View style={styles.featureRow}>
              <View style={styles.featureIconCirc} collapsable={false}>
                <SvgCameraIcon color={colors.primary_green} size={28} />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Real-time computer vision</Text>
                <Text style={styles.featureBody}>
                  MoveNet Lightning tracks pose keypoints from the camera for instant form cues on each rep — no extra
                  wearables required.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.howTitle}>How it works</Text>
        <View style={styles.howCard}>
          {HOW_STEPS.map((step, idx) => (
            <View key={step.num} style={[styles.howStep, idx < HOW_STEPS.length - 1 && styles.howStepSep]}>
              <Text style={styles.stepNum}>{step.num}</Text>
              <View style={styles.howTxtCol}>
                <Text style={styles.howStepTitle}>{step.title}</Text>
                <Text style={styles.howStepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoNote}>
          <View style={styles.infoIconWrap}>
            <SvgInfoOutlineIcon color={colors.text_secondary} size={22} />
          </View>
          <Text style={styles.infoNoteTxt}>
            Sign in to save sessions and see them in Stats. Demo browsing does not persist history on this device.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <PrimaryButton
          title="START DEMO"
          trailing={<SvgArrowForwardIcon size={22} color={colors.text_on_green} />}
          style={styles.ctaPrimary}
          onPress={() => nav.navigate('MainTabs', { screen: 'HomeMain' })}
        />
        <PrimaryButton title="BACK" variant="ghost" onPress={() => nav.navigate('AuthGateway')} style={styles.ctaGhost} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg_surface_alt },

  scroll: { flex: 1 },
  scrollInner: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  topNavSafe: {
    backgroundColor: colors.bg_surface_alt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: colors.bg_surface_alt,
  },
  topNavWord: {
    marginLeft: 8,
    fontFamily: typography.fontFamily.display,
    color: colors.primary_green,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
  },

  title: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.cardHeading,
    fontWeight: '700',
    color: colors.text_primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    color: colors.text_secondary,
    lineHeight: 24,
  },

  featureOuter: {
    marginTop: 28,
    borderRadius: 14,
    backgroundColor: colors.surface_low,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  visCard: {
    width: '100%',
    height: 268,
    backgroundColor: colors.bg_high,
    marginBottom: 0,
  },
  demoImageFull: {
    width: '100%',
    height: '100%',
  },
  featureBodyPad: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  featureIconCirc: {
    marginRight: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg_high,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(39,195,79,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: { flex: 1, minWidth: 0 },
  featureTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
    marginBottom: 4,
  },
  featureBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    lineHeight: 21,
  },

  howTitle: {
    marginTop: 36,
    marginBottom: 16,
    fontFamily: typography.fontFamily.display,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    color: colors.primary_green,
  },
  howCard: {
    borderRadius: 14,
    backgroundColor: colors.surface_v3,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18 },
  howStepSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border_subtle },
  stepNum: {
    marginRight: 20,
    minWidth: 40,
    fontFamily: typography.fontFamily.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.skeleton_muted_v3,
    letterSpacing: -1,
  },
  howTxtCol: { flex: 1, minWidth: 0 },
  howStepTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
    marginBottom: 4,
  },
  howStepBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    lineHeight: 21,
  },

  infoNote: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface_low,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrap: { marginRight: 14 },
  infoNoteTxt: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_secondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  footer: {
    backgroundColor: 'rgba(32,31,31,0.94)',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  ctaPrimary: { marginTop: 4, marginBottom: 4 },
  ctaGhost: { marginTop: 12 },
});

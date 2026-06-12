import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import { resetToMainTabs } from '@/navigation/navigationRef';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EmailConfirm'>;

const RESEND_COOLDOWN_SEC = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function EmailConfirmScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const email = route.params.email;

  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const resendConfirmationEmail = useAuthStore((s) => s.resendConfirmationEmail);
  const refreshVerificationStatus = useAuthStore((s) => s.refreshVerificationStatus);
  const clearError = useAuthStore((s) => s.clearError);

  const [resendSec, setResendSec] = useState(0);
  const [resentOk, setResentOk] = useState(false);

  const masked = useMemo(() => maskEmail(email), [email]);

  useEffect(() => {
    if (isLoggedIn) {
      resetToMainTabs();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (resendSec <= 0) return;
    const t = setInterval(() => setResendSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendSec]);

  const handleResend = useCallback(async () => {
    if (resendSec > 0 || isLoading) return;
    clearError();
    setResentOk(false);
    try {
      await resendConfirmationEmail(email);
      setResentOk(true);
      setResendSec(RESEND_COOLDOWN_SEC);
    } catch {
      // error surfaced via store
    }
  }, [clearError, email, isLoading, resendConfirmationEmail, resendSec]);

  const handleContinue = useCallback(async () => {
    clearError();
    const ok = await refreshVerificationStatus();
    if (ok) {
      resetToMainTabs();
      return;
    }
    nav.navigate('AuthGateway', { email, fromEmailVerify: true });
  }, [clearError, email, nav, refreshVerificationStatus]);

  const openMailApp = useCallback(() => {
    void Linking.openURL('mailto:');
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <SafeAreaView edges={[]} style={styles.flex}>
        <RepRightHeader
          variant="auth"
          showBack
          rightSlot={<Ionicons name="mail-outline" size={22} color={colors.primary_green} />}
        />
        <View style={styles.body}>
          <View style={styles.mailIcon}>
            <Ionicons name="mail-unread-outline" size={44} color={colors.primary_green} />
          </View>

          <Text style={styles.title}>{t('emailConfirm.title')}</Text>
          <Text style={styles.sub}>
            {t('emailConfirm.body', { email: masked })}
          </Text>

          <PrimaryButton
            title={t('emailConfirm.openEmail')}
            trailing={<MaterialIcons name="mail-outline" size={22} color={colors.text_on_green} />}
            style={styles.primaryBtn}
            onPress={openMailApp}
          />

          <PrimaryButton
            title={isLoading ? t('emailConfirm.checking') : t('emailConfirm.verifiedContinue')}
            variant="ghost"
            disabled={isLoading}
            onPress={() => void handleContinue()}
            style={styles.secondaryBtn}
          />

          {error ? <Text style={styles.errorTxt}>{error}</Text> : null}
          {resentOk && !error ? (
            <Text style={styles.okTxt}>{t('emailConfirm.resentOk')}</Text>
          ) : null}

          <Pressable
            style={styles.resendWrap}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendSec > 0 || isLoading }}
            onPress={() => void handleResend()}
            disabled={resendSec > 0 || isLoading}
          >
            <Text style={styles.resend}>
              {t('emailConfirm.resendPrompt')}{' '}
              <Text style={[styles.resendBold, resendSec > 0 && styles.resendMuted]}>
                {resendSec > 0 ? t('emailConfirm.resendIn', { seconds: resendSec }) : t('emailConfirm.resendLink')}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            style={styles.backLogin}
            accessibilityRole="button"
            onPress={() => nav.navigate('AuthGateway')}
          >
            <Text style={styles.backLoginTxt}>{t('emailConfirm.backToSignIn')}</Text>
          </Pressable>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}>
              <Ionicons name="shield-checkmark-outline" color={colors.primary_green} size={20} />
              <Text style={styles.infoTxt}>{t('emailConfirm.expiresHint')}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="phone-portrait-outline" color={colors.primary_green} size={20} />
              <Text style={styles.infoTxt}>{t('emailConfirm.openOnPhone')}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg_surface_alt },
  body: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  mailIcon: {
    marginTop: 12,
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: colors.green_subtle_bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(39,195,79,0.35)',
  },
  title: {
    marginTop: 28,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 8,
    color: colors.text_primary,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  sub: {
    marginTop: 14,
    textAlign: 'center',
    color: colors.text_secondary,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
    fontFamily: typography.fontFamily.regular,
    paddingHorizontal: 4,
  },
  emailHighlight: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
  },
  primaryBtn: { marginTop: 28, alignSelf: 'stretch' },
  secondaryBtn: { marginTop: 12, alignSelf: 'stretch' },
  errorTxt: {
    marginTop: 16,
    color: colors.accent_red,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captions,
    textAlign: 'center',
    lineHeight: 20,
  },
  okTxt: {
    marginTop: 16,
    color: colors.primary_green,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captions,
    textAlign: 'center',
  },
  resendWrap: { marginTop: 22, paddingVertical: 8 },
  resend: { color: colors.text_muted, fontSize: typography.fontSize.captions, textAlign: 'center' },
  resendBold: { color: colors.primary_green, fontFamily: typography.fontFamily.bold },
  resendMuted: { color: colors.text_muted },
  backLogin: { marginTop: 8, paddingVertical: 8 },
  backLoginTxt: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
  },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 36, alignSelf: 'stretch' },
  infoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
  },
  infoTxt: { flex: 1, color: colors.text_secondary, fontSize: typography.fontSize.captions, lineHeight: 18 },
});

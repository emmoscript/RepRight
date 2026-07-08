import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RepRightHeader } from '@/components/RepRightHeader';
import { getAllSessions } from '@/modules/session';
import { pullAndMergeCloudSessions } from '@/lib/pullSessionsFromSupabase';
import { pushProfileToSupabase } from '@/lib/profileSync';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { resetToWelcome } from '@/navigation/navigationRef';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { resolveDisplayName } from '@/utils/displayName';
import { computeProfileSessionStats } from '@/utils/profileSessionStats';
import { weightSystemLabel, weightUnitSuffix } from '@/utils/weightUnits';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isGuest = useAuthStore((s) => s.isGuest);
  const participantId = useAuthStore((s) => s.participantId);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const displayNamePref = useUserPreferencesStore((s) => s.displayName);
  const profilePhotoUri = useUserPreferencesStore((s) => s.profilePhotoUri);
  const weightUnit = useUserPreferencesStore((s) => s.weightUnit);
  const language = useUserPreferencesStore((s) => s.language);
  const audioFeedbackEnabled = useUserPreferencesStore((s) => s.audioFeedbackEnabled);
  const setDisplayName = useUserPreferencesStore((s) => s.setDisplayName);
  const setProfilePhotoUri = useUserPreferencesStore((s) => s.setProfilePhotoUri);
  const setWeightUnit = useUserPreferencesStore((s) => s.setWeightUnit);
  const setLanguage = useUserPreferencesStore((s) => s.setLanguage);
  const setAudioFeedbackEnabled = useUserPreferencesStore((s) => s.setAudioFeedbackEnabled);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [bestFormPct, setBestFormPct] = useState<number | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (isLoggedIn) {
          await pullAndMergeCloudSessions();
        }
        const list = await getAllSessions();
        if (!active) return;
        const stats = computeProfileSessionStats(list);
        setSessionCount(stats.sessionCount);
        setBestFormPct(stats.bestFormPct);
        setStreakDays(stats.streakDays);
      })();
      return () => {
        active = false;
      };
    }, [userId, isGuest, isLoggedIn]),
  );

  const bestFormLabel =
    bestFormPct != null && sessionCount > 0 ? `${Math.round(bestFormPct)}%` : '—';
  const streakLabel = sessionCount > 0 ? `🔥 ${streakDays}` : '🔥 —';
  const sessionsLabel = sessionCount > 0 ? String(sessionCount) : '—';

  const display = useMemo(
    () => resolveDisplayName({ displayName: displayNamePref, email, isGuest }),
    [displayNamePref, email, isGuest, i18n.language],
  );

  const participantLabel =
    isGuest || !isLoggedIn ? t('profile.guestParticipant') : t('profile.testParticipant');
  const unitSuffix = weightUnitSuffix(weightUnit);
  const systemLabel = weightSystemLabel(weightUnit);

  const initials = display.slice(0, 2).toUpperCase();

  const pushProfile = useCallback(async () => {
    if (userId) await pushProfileToSupabase(userId);
  }, [userId]);

  const handleSignOut = async () => {
    await signOut();
    resetToWelcome();
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccountConfirm'),
        style: 'destructive',
        onPress: () => {
          void deleteAccount().catch(() => {
            Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountError'));
          });
        },
      },
    ]);
  };

  const openNameEditor = () => {
    setNameDraft(displayNamePref ?? display);
    setNameModalOpen(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    await setDisplayName(trimmed);
    await pushProfile();
    setNameModalOpen(false);
  };

  const handleLanguageChange = useCallback(
    (lang: 'en' | 'es') => {
      void setLanguage(lang).then(pushProfile);
    },
    [setLanguage, pushProfile],
  );

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.photoAccessTitle'), t('profile.photoAccessBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setProfilePhotoUri(result.assets[0].uri);
    }
  };

  const confirmRemovePhoto = () => {
    Alert.alert(t('profile.removePhotoTitle'), t('profile.removePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => void setProfilePhotoUri(null),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <RepRightHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.avatarWrap}
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
          onPress={() => void pickProfilePhoto()}
          onLongPress={profilePhotoUri ? confirmRemovePhoto : undefined}
        >
          <View style={styles.avatar}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarTxt}>{initials}</Text>
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={16} color={colors.text_on_green} />
          </View>
          {isLoggedIn ? (
            <View style={styles.ver}>
              <Ionicons name="checkmark-circle" size={26} color={colors.primary_green} />
            </View>
          ) : null}
        </Pressable>

        <Pressable
          style={styles.nameRow}
          accessibilityRole="button"
          onPress={openNameEditor}
        >
          <Text style={styles.name}>{display}</Text>
          <Ionicons name="pencil-outline" size={18} color={colors.text_muted} />
        </Pressable>
        {email ? <Text style={styles.emailSub}>{email}</Text> : null}

        <Pressable style={styles.alphaCard}>
          <Ionicons
            name="flask-outline"
            size={24}
            color={colors.primary_green}
            style={{ marginRight: 14 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.alphaTitle}>{participantLabel}</Text>
            <Text style={styles.alphaMuted}>{t('profile.alphaBuild', { id: participantId })}</Text>
          </View>
        </Pressable>

        <View style={styles.statRow}>
          <StatChip label={t('profile.bestForm')} value={bestFormLabel} />
          <StatChip label={t('profile.sessions')} value={sessionsLabel} />
          <StatChip label={t('profile.streak')} value={streakLabel} />
        </View>

        <View style={styles.settingsBlock}>
          <View style={styles.unitsCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="language-outline" size={20} color={colors.primary_green} />
              <Text style={styles.unitsTitle}>{t('profile.languageTitle')}</Text>
            </View>
            <Text style={styles.unitsSub}>{t('profile.languageSub')}</Text>
            <View style={styles.segmentRow}>
              <SegmentButton
                label={t('common.english')}
                selected={language === 'en'}
                onPress={() => handleLanguageChange('en')}
              />
              <SegmentButton
                label={t('common.spanish')}
                selected={language === 'es'}
                onPress={() => handleLanguageChange('es')}
              />
            </View>
          </View>

          <View style={styles.unitsCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="barbell-outline" size={20} color={colors.primary_green} />
              <Text style={styles.unitsTitle}>{t('profile.unitsTitle')}</Text>
            </View>
            <Text style={styles.unitsSub}>
              {t('profile.unitsSub', { system: systemLabel, suffix: unitSuffix })}
            </Text>
            <View style={styles.segmentRow}>
              <SegmentButton
                label={t('common.imperialLb')}
                selected={weightUnit === 'lb'}
                onPress={() => void setWeightUnit('lb').then(pushProfile)}
              />
              <SegmentButton
                label={t('common.metricKg')}
                selected={weightUnit === 'kg'}
                onPress={() => void setWeightUnit('kg').then(pushProfile)}
              />
            </View>
          </View>

          <RowToggle
            label={t('profile.voiceFeedback')}
            subtitle={t('profile.voiceFeedbackSub')}
            value={audioFeedbackEnabled}
            onChange={(next) => void setAudioFeedbackEnabled(next).then(pushProfile)}
          />

          <View style={styles.unitsCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary_green} />
              <Text style={styles.unitsTitle}>{t('profile.legalTitle')}</Text>
            </View>
            <SettingsLink
              label={t('profile.privacyPolicy')}
              onPress={() => nav.navigate('LegalDocument', { type: 'privacy' })}
            />
            <SettingsLink
              label={t('profile.termsOfUse')}
              onPress={() => nav.navigate('LegalDocument', { type: 'terms' })}
            />
            <SettingsLink
              label={t('profile.supportContact')}
              onPress={() => nav.navigate('Support')}
              last
            />
          </View>
        </View>

        <Pressable
          style={[styles.signOutGhost, isLoading && styles.signOutDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
          onPress={() => void handleSignOut()}
          disabled={isLoading}
        >
          <Text style={styles.signOutTxt}>
            {isLoading ? t('profile.signingOut') : isGuest ? t('profile.exitGuest') : t('profile.signOut')}
          </Text>
        </Pressable>

        {isLoggedIn ? (
          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <Ionicons name="warning-outline" size={20} color={colors.accent_red} />
              <Text style={styles.dangerTitle}>{t('profile.dangerZoneTitle')}</Text>
            </View>
            <Text style={styles.dangerSub}>{t('profile.dangerZoneSub')}</Text>
            <Pressable
              style={[styles.deleteAccountBtn, isLoading && styles.signOutDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
              onPress={handleDeleteAccount}
              disabled={isLoading}
            >
              <Text style={styles.deleteAccountTxt}>
                {isLoading ? t('profile.deletingAccount') : t('profile.deleteAccount')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.verSmall}>{t('profile.footer')}</Text>
      </ScrollView>

      <Modal visible={nameModalOpen} transparent animationType="fade" onRequestClose={() => setNameModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setNameModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('profile.displayName')}</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('profile.yourName')}
              placeholderTextColor={colors.text_muted}
              autoCapitalize="words"
              autoFocus
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setNameModalOpen(false)}>
                <Text style={styles.modalBtnGhostTxt}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={() => void saveName()}>
                <Text style={styles.modalBtnPrimaryTxt}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SegmentButton(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[styles.segmentBtn, props.selected ? styles.segmentBtnOn : styles.segmentBtnOff]}
    >
      <Text style={[styles.segmentTxt, props.selected ? styles.segmentTxtOn : styles.segmentTxtOff]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function StatChip(props: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statVal}>{props.value}</Text>
      <Text style={styles.statLab}>{props.label}</Text>
    </View>
  );
}

function RowToggle(props: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLab}>{props.label}</Text>
        {props.subtitle ? <Text style={styles.rowSub}>{props.subtitle}</Text> : null}
      </View>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ false: '#333', true: colors.primary_green }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SettingsLink(props: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.settingsLink, props.last && styles.settingsLinkLast]}
    >
      <Text style={styles.settingsLinkTxt}>{props.label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.text_muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  avatarWrap: { alignSelf: 'center', marginTop: 8 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary_green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg_elevated,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { fontFamily: typography.fontFamily.bold, fontSize: 34, color: colors.text_primary },
  cameraBadge: {
    position: 'absolute',
    left: -2,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary_green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg_v3,
  },
  ver: { position: 'absolute', right: -4, bottom: 6 },
  nameRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  name: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodyLg + 12,
    color: colors.text_primary,
    letterSpacing: -0.3,
  },
  emailSub: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
  },
  alphaCard: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: colors.green_subtle_bg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alphaTitle: { fontFamily: typography.fontFamily.bold, color: colors.text_primary, fontSize: 16 },
  alphaMuted: { marginTop: 6, fontSize: 13, color: colors.text_secondary },
  statRow: { flexDirection: 'row', marginTop: 28, gap: 10 },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface_v3,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  statLab: {
    marginTop: 8,
    color: colors.text_muted,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  settingsBlock: { marginTop: 22, gap: 10 },
  unitsCard: {
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitsTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  unitsSub: {
    marginTop: 6,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.text_secondary,
    lineHeight: 20,
  },
  row: {
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  rowLab: { fontFamily: typography.fontFamily.medium, color: colors.text_primary },
  rowSub: {
    marginTop: 4,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.text_muted,
  },
  signOutGhost: {
    marginTop: 28,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth + 2,
    borderColor: colors.accent_red + '69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutDisabled: { opacity: 0.5 },
  signOutTxt: { color: colors.accent_red, fontFamily: typography.fontFamily.bold, fontSize: 15 },
  deleteAccountBtn: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: colors.accent_red + '22',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: colors.accent_red + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountTxt: {
    color: colors.accent_red,
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
  },
  dangerZone: {
    marginTop: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: colors.accent_red + '44',
    backgroundColor: colors.accent_red + '0D',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.accent_red,
  },
  dangerSub: {
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.text_secondary,
    lineHeight: 19,
  },
  settingsLink: {
    marginTop: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  settingsLinkLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  settingsLinkTxt: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  verSmall: {
    marginTop: 28,
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.text_muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    color: colors.text_primary,
  },
  modalInput: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: colors.bg_elevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalBtnGhostTxt: {
    fontFamily: typography.fontFamily.medium,
    color: colors.text_secondary,
  },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary_green,
  },
  modalBtnPrimaryTxt: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text_on_green,
  },
  segmentRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  segmentBtnOn: { backgroundColor: colors.primary_green },
  segmentBtnOff: { backgroundColor: colors.bg_elevated },
  segmentTxt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.body },
  segmentTxtOn: { color: colors.text_on_green },
  segmentTxtOff: { color: colors.text_secondary },
});

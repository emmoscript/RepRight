import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
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

import { LanguageSegment } from '@/components/LanguageSegment';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { resetToWelcome } from '@/navigation/navigationRef';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { resolveDisplayName } from '@/utils/displayName';
import { weightSystemLabel, weightUnitSuffix } from '@/utils/weightUnits';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isGuest = useAuthStore((s) => s.isGuest);
  const participantId = useAuthStore((s) => s.participantId);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);

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

  const display = useMemo(
    () => resolveDisplayName({ displayName: displayNamePref, email, isGuest }),
    [displayNamePref, email, isGuest, i18n.language],
  );

  const participantLabel =
    isGuest || !isLoggedIn ? t('profile.guestParticipant') : t('profile.testParticipant');
  const unitSuffix = weightUnitSuffix(weightUnit);
  const systemLabel = weightSystemLabel(weightUnit);

  const initials = display.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    resetToWelcome();
  };

  const openNameEditor = () => {
    setNameDraft(displayNamePref ?? display);
    setNameModalOpen(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    await setDisplayName(trimmed);
    setNameModalOpen(false);
  };

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

        <View style={styles.alphaCard}>
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
        </View>

        <View style={styles.statRow}>
          <StatChip label={t('profile.bestForm')} value="—" />
          <StatChip label={t('profile.sessions')} value="—" />
          <StatChip label={t('profile.streak')} value="🔥 —" />
        </View>

        <View style={styles.settingsBlock}>
          <View style={styles.unitsCard}>
            <Text style={styles.unitsTitle}>{t('profile.languageTitle')}</Text>
            <Text style={styles.unitsSub}>{t('profile.languageSub')}</Text>
            <View style={styles.segmentRow}>
              <LanguageSegment value={language} onChange={(lang) => void setLanguage(lang)} />
            </View>
          </View>

          <View style={styles.unitsCard}>
            <Text style={styles.unitsTitle}>{t('profile.unitsTitle')}</Text>
            <Text style={styles.unitsSub}>
              {t('profile.unitsSub', { system: systemLabel, suffix: unitSuffix })}
            </Text>
            <View style={styles.segmentRow}>
              <SegmentButton
                label={t('common.imperialLb')}
                selected={weightUnit === 'lb'}
                onPress={() => void setWeightUnit('lb')}
              />
              <SegmentButton
                label={t('common.metricKg')}
                selected={weightUnit === 'kg'}
                onPress={() => void setWeightUnit('kg')}
              />
            </View>
          </View>

          <RowToggle
            label={t('profile.voiceFeedback')}
            subtitle={t('profile.voiceFeedbackSub')}
            value={audioFeedbackEnabled}
            onChange={(next) => void setAudioFeedbackEnabled(next)}
          />
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

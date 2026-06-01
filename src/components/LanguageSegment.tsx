import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppLanguage } from '@/i18n/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  value: AppLanguage;
  onChange: (lang: AppLanguage) => void;
  compact?: boolean;
};

export function LanguageSegment({ value, onChange, compact }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <SegmentButton
        label={compact ? 'EN' : t('common.english')}
        selected={value === 'en'}
        onPress={() => onChange('en')}
      />
      <SegmentButton
        label={compact ? 'ES' : t('common.spanish')}
        selected={value === 'es'}
        onPress={() => onChange('es')}
      />
    </View>
  );
}

function SegmentButton(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[styles.btn, props.selected ? styles.btnOn : styles.btnOff]}
    >
      <Text style={[styles.txt, props.selected ? styles.txtOn : styles.txtOff]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnOn: { backgroundColor: colors.primary_green },
  btnOff: { backgroundColor: colors.bg_elevated },
  txt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.body },
  txtOn: { color: colors.text_on_green },
  txtOff: { color: colors.text_secondary },
});

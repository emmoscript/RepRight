import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, ICONS } from '@/components/Icon';
import { GetStartedPanel } from '@/components/onboarding/GetStartedPanel';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAD_H = 20;

/** Returning users — sign in, sign up, or guest. No onboarding steps. */
export function WelcomeScreen() {
  const nav = useNavigation<Nav>();
  const enterAsGuest = useAuthStore((s) => s.enterAsGuest);

  const onGuest = useCallback(() => {
    void (async () => {
      await enterAsGuest();
      nav.navigate('MainTabs', { screen: 'HomeMain' });
    })();
  }, [enterAsGuest, nav]);

  const onLogin = useCallback(() => {
    nav.navigate('AuthGateway', { mode: 'login' });
  }, [nav]);

  const onCreate = useCallback(() => {
    nav.navigate('AuthGateway', { mode: 'signup' });
  }, [nav]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Icon name={ICONS.barbell} size={22} color={colors.primary_green} />
        <Text style={styles.brand}>RepRight</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <GetStartedPanel onCreate={onCreate} onLogin={onLogin} onGuest={onGuest} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg_v3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_H,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary_green,
    letterSpacing: -0.5,
  },
  headerSpacer: { width: 22 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: PAD_H,
    paddingBottom: 24,
  },
});

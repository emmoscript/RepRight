import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon, ICONS } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { RootStackParamList } from "@/navigation/routeTypes";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STEPS = [
  "Position device 5–7 feet away, full-body profile view.",
  "Execute your set — AI detects start/end automatically.",
  "Receive instant feedback on depth, pathing, velocity.",
] as const;

export function DemoScreen() {
  const nav = useNavigation<Nav>();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollInner}
          style={styles.scroll}>
          <View style={styles.logoWrap}>
            <Icon name={ICONS.barbell} size={42} color={colors.primary_green} />
            <Text style={styles.logoWord}>RepRight</Text>
          </View>

          <Text style={styles.demoMode}>DEMO MODE</Text>
          <Text style={styles.sub}>
            Test the AI analysis without starting a real session saved to
            history.
          </Text>

          <View style={styles.heroCard}>
            {/* Simulated camera feed with skeleton stats */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroPill}>
                <View style={styles.heroPillDot} />
                <Text style={styles.heroPillTxt}>AI TRACKING ACTIVE</Text>
              </View>
              <Text style={[styles.hudVal, { color: colors.primary_green }]}>
                98%
              </Text>
            </View>
            <View style={styles.heroSkeleton}>
              <View style={styles.heroBodyIconWrap}>
                <Icon
                  name={ICONS.personOutline}
                  size={88}
                  color={colors.primary_green}
                />
              </View>
            </View>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>150°</Text>
                <Text style={styles.heroStatLab}>BACK ANGLE</Text>
              </View>
              <View style={styles.heroStat}>
                <Text
                  style={[styles.heroStatVal, { color: colors.primary_green }]}>
                  OK
                </Text>
                <Text style={styles.heroStatLab}>LUMBAR</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>SET 1</Text>
                <Text style={styles.heroStatLab}>SERIES</Text>
              </View>
            </View>
          </View>

          <Text style={styles.stepsTitle}>Instructions</Text>
          {STEPS.map((line, index) => (
            <View key={line} style={styles.step}>
              <Text style={styles.stepNum}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.stepTxt}>{line}</Text>
            </View>
          ))}

          <View style={styles.note}>
            <Text style={styles.noteTxt}>
              Demo data is not saved to your session history.
            </Text>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView style={styles.footer} edges={["bottom"]}>
        <PrimaryButton
          title="START DEMO →"
          onPress={() => nav.navigate("LiveSession")}
        />
        <PrimaryButton
          title="SKIP TO APP →"
          variant="ghost"
          onPress={() => nav.navigate("Login")}
          style={{ marginTop: 12 }}
        />
        <Pressable
          onPress={() => nav.navigate("Signup")}
          style={styles.backGhost}
          accessibilityRole="button">
          <Text style={styles.backGhostTxt}>Create account instead</Text>
        </Pressable>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 26, paddingTop: 36, paddingBottom: 24 },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  logoWord: {
    fontFamily: typography.fontFamily.display,
    color: colors.primary_green,
    fontSize: 30,
    letterSpacing: typography.letterSpacing.capsWide,
  },
  demoMode: {
    marginTop: 28,
    textAlign: "center",
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontSize: typography.fontSize.titleSm,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.capsWide,
  },
  sub: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    color: colors.text_secondary,
    lineHeight: 24,
  },
  heroCard: {
    marginTop: 28,
    borderRadius: 16,
    backgroundColor: colors.bg_elevated,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(39,195,79,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(39,195,79,0.25)",
  },
  heroPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary_green,
  },
  heroPillTxt: {
    color: colors.primary_green,
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 1,
  },
  hudVal: { fontFamily: typography.fontFamily.display, fontSize: 22 },
  heroSkeleton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  heroBodyIconWrap: { opacity: 0.85 },
  heroStatsRow: { flexDirection: "row", gap: 0, marginTop: 4 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.text_primary,
  },
  heroStatLab: {
    marginTop: 3,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    textTransform: "uppercase",
  },
  stepsTitle: {
    marginTop: 32,
    fontFamily: typography.fontFamily.medium,
    color: colors.text_primary,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: typography.letterSpacing.capsWide,
  },
  step: {
    flexDirection: "row",
    marginTop: 16,
    gap: 16,
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
  },
  stepNum: {
    fontFamily: typography.fontFamily.display,
    color: colors.primary_green,
    fontSize: 18,
  },
  stepTxt: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_primary,
    lineHeight: 22,
  },
  note: {
    marginTop: 22,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.green_subtle_bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary_green,
  },
  noteTxt: {
    fontSize: typography.fontSize.captions,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
  },
  footer: {
    backgroundColor: colors.bg_v3,
    paddingHorizontal: 26,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  backGhost: { alignItems: "center", paddingVertical: 14 },
  backGhostTxt: {
    fontFamily: typography.fontFamily.medium,
    color: colors.text_secondary,
    fontSize: 14,
  },
});

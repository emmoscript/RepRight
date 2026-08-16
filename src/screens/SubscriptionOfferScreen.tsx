import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  type Purchase,
  type Subscription,
} from "react-native-iap";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import type { RootStackParamList } from "@/navigation/routeTypes";
import { useAuthStore } from "@/store/authStore";
import {
  resolveSubscriptionOwnerKey,
  useSubscriptionStore,
} from "@/store/subscriptionStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

const HERO_IMAGE = require("../../assets/images/man-deadlifting.jpg");
const SUBSCRIPTION_SKU = "com.unibe.repright.premium.monthly";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BENEFIT_KEYS = ["benefit1", "benefit2", "benefit3"] as const;

export function SubscriptionOfferScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isGuest = useAuthStore((s) => s.isGuest);
  const participantId = useAuthStore((s) => s.participantId);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const subscribed = useSubscriptionStore((s) => s.subscribed);
  const [product, setProduct] = useState<Subscription | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [purchasePending, setPurchasePending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const ownerKey = resolveSubscriptionOwnerKey({
    isLoggedIn,
    isGuest,
    userId,
    participantId,
  });

  const source = (route.params as { source?: string } | undefined)?.source;
  const headline =
    source === "first_session" || source === "weekly_limit"
      ? t("subscriptionOffer.title")
      : t("subscriptionOffer.title");

  useEffect(() => {
    let active = true;
    const listeners: { remove: () => void }[] = [];

    const markActive = async () => {
      await useSubscriptionStore.getState().setSubscriptionActive(ownerKey);
      nav.replace("MainTabs", { screen: "HomeMain" });
    };

    const syncPurchase = async (purchase: Purchase) => {
      if (purchase.productId !== SUBSCRIPTION_SKU) return;
      try {
        await finishTransaction({ purchase });
        await markActive();
        setStatusMessage(t("subscriptionOffer.active"));
      } catch (error) {
        console.warn("[iap] finish/persist failed", error);
        setStatusMessage(t("subscriptionOffer.purchaseFailed"));
      } finally {
        setPurchasePending(false);
      }
    };

    void (async () => {
      try {
        await initConnection();
        const items = await getSubscriptions({ skus: [SUBSCRIPTION_SKU] });
        if (active) {
          setProduct(items[0] ?? null);
          setLoadingProduct(false);
        }

        listeners.push(
          purchaseUpdatedListener((purchase) => {
            void syncPurchase(purchase);
          }),
        );
        listeners.push(
          purchaseErrorListener((error) => {
            console.warn("[iap] purchase error", error);
            setStatusMessage(t("subscriptionOffer.purchaseFailed"));
            setPurchasePending(false);
          }),
        );
      } catch (error) {
        console.warn("[iap] init failed", error);
        if (active) {
          setLoadingProduct(false);
          setStatusMessage(t("subscriptionOffer.purchaseFailed"));
        }
      }
    })();

    return () => {
      active = false;
      for (const listener of listeners) listener.remove();
      void endConnection();
    };
  }, [nav, ownerKey, t]);

  const continueFree = () => {
    nav.replace("MainTabs", { screen: "HomeMain" });
  };

  const unlockPremium = async () => {
    try {
      setPurchasePending(true);
      setStatusMessage(null);
      await requestSubscription({
        sku: SUBSCRIPTION_SKU,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
        appAccountToken: ownerKey,
      });
    } catch (error) {
      console.warn("[iap] requestSubscription failed", error);
      setPurchasePending(false);
      setStatusMessage(t("subscriptionOffer.purchaseFailed"));
    }
  };

  const handleRestore = async () => {
    try {
      setRestorePending(true);
      setStatusMessage(null);
      const purchases = await getAvailablePurchases({
        automaticallyFinishRestoredTransactions: false,
      });
      const restored = purchases.find(
        (purchase) => purchase.productId === SUBSCRIPTION_SKU,
      );
      if (!restored) {
        setStatusMessage(t("subscriptionOffer.restoreEmpty"));
        return;
      }

      await finishTransaction({ purchase: restored });
      await useSubscriptionStore.getState().setSubscriptionActive(ownerKey);
      nav.replace("MainTabs", { screen: "HomeMain" });
    } catch (error) {
      console.warn("[iap] restore failed", error);
      setStatusMessage(t("subscriptionOffer.restoreFailed"));
    } finally {
      setRestorePending(false);
    }
  };

  const priceLabel =
    product && "localizedPrice" in product ? product.localizedPrice : "$9.99";
  const titleLabel = product?.title ?? t("subscriptionOffer.title");

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={HERO_IMAGE}
          style={styles.hero}
          imageStyle={styles.heroImage}>
          <View style={styles.heroScrim} />
          <View style={styles.heroTopRow}>
            <Pressable
              style={styles.backBtn}
              onPress={continueFree}
              accessibilityRole="button"
              accessibilityLabel="Back to app">
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.text_primary}
              />
            </Pressable>
            <View style={styles.badge}>
              <Ionicons name="flash" size={14} color={colors.text_on_green} />
              <Text style={styles.badgeTxt}>Premium</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>
              {source === "first_session"
                ? t("sessionComplete.sessionComplete")
                : source === "weekly_limit"
                  ? "Weekly Limit Reached"
                  : "TESTFLIGHT SANDBOX"}
            </Text>
            <Text style={styles.title}>{headline}</Text>
            <Text style={styles.subtitle}>
              {t("subscriptionOffer.subtitle")}
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What premium unlocks</Text>
          <View style={styles.benefits}>
            {BENEFIT_KEYS.map((key) => (
              <View key={key} style={styles.benefitRow}>
                <View style={styles.checkWrap}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.text_on_green}
                  />
                </View>
                <Text style={styles.benefitText}>
                  {t(`subscriptionOffer.${key}`)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>
              {t("subscriptionOffer.priceLabel")}
            </Text>
            <Text style={styles.priceValue}>{priceLabel}</Text>
            <Text style={styles.priceFine}>{titleLabel}</Text>
            <Text style={styles.priceFine}>
              {t("subscriptionOffer.priceFine")}
            </Text>
          </View>

          <PrimaryButton
            title={
              subscribed
                ? t("subscriptionOffer.active")
                : t("subscriptionOffer.unlock")
            }
            onPress={() => void unlockPremium()}
            disabled={subscribed || loadingProduct || purchasePending}
          />

          {loadingProduct ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary_green} />
              <Text style={styles.loadingText}>Loading App Store product…</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => void handleRestore()}
            disabled={restorePending}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnTxt}>
              {restorePending
                ? `${t("subscriptionOffer.restore")}…`
                : t("subscriptionOffer.restore")}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={continueFree}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnTxt}>
              {t("subscriptionOffer.continueFree")}
            </Text>
          </Pressable>

          {statusMessage ? (
            <Text style={styles.footerNote}>{statusMessage}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg_v3,
  },
  scroll: {
    paddingBottom: 28,
  },
  hero: {
    minHeight: 420,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  heroImage: {
    opacity: 0.72,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary_green,
  },
  badgeTxt: {
    color: colors.text_on_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroCopy: {
    gap: 12,
    maxWidth: 340,
  },
  eyebrow: {
    color: colors.accent_green_light,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: typography.letterSpacing.capsWide,
    fontSize: 11,
  },
  title: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -1.4,
    textTransform: "uppercase",
  },
  subtitle: {
    color: colors.on_surface,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
  },
  card: {
    marginTop: -28,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.surface_v3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    gap: 18,
  },
  cardTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: -0.4,
  },
  benefits: {
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary_green,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.body,
    lineHeight: 22,
  },
  priceCard: {
    borderRadius: 18,
    backgroundColor: colors.bg_elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    padding: 16,
    gap: 4,
  },
  priceLabel: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: "uppercase",
  },
  priceValue: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  priceFine: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryBtnTxt: {
    color: colors.accent_green_light,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.capsWide,
  },
  footerNote: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
  },
});

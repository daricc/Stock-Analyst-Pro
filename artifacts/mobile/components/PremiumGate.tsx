import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useSubscription } from "@/lib/revenuecat";

const C = Colors.light;

export function PremiumBadge() {
  return (
    <View style={badgeStyles.container}>
      <Feather name="star" size={10} color="#FFD700" />
      <Text style={badgeStyles.text}>PRO</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,215,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  text: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    letterSpacing: 1,
  },
});

interface PremiumGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function PremiumGate({ children, feature }: PremiumGateProps) {
  const { isSubscribed } = useSubscription();

  if (isSubscribed) {
    return <>{children}</>;
  }

  return <UpgradeOverlay feature={feature} />;
}

function UpgradeOverlay({ feature }: { feature?: string }) {
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <>
      <Pressable onPress={() => setShowPaywall(true)} style={overlayStyles.container}>
        <LinearGradient
          colors={["rgba(255,215,0,0.08)", "rgba(255,215,0,0.02)"]}
          style={overlayStyles.gradient}
        >
          <View style={overlayStyles.lockIcon}>
            <Feather name="lock" size={24} color="#FFD700" />
          </View>
          <Text style={overlayStyles.title}>Premium Feature</Text>
          <Text style={overlayStyles.subtitle}>
            {feature
              ? `Unlock ${feature} with Premium`
              : "Upgrade to Premium to access this feature"}
          </Text>
          <View style={overlayStyles.button}>
            <Feather name="star" size={14} color="#000" />
            <Text style={overlayStyles.buttonText}>Start Free Trial</Text>
          </View>
        </LinearGradient>
      </Pressable>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  gradient: {
    padding: 24,
    alignItems: "center",
  },
  lockIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,215,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFD700",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },
});

type PlanKey = "monthly" | "6month" | "annual";

const PLAN_INFO: Record<PlanKey, { label: string; period: string; monthlyEquiv: string; savings?: string }> = {
  monthly: { label: "Monthly", period: "/mo", monthlyEquiv: "$9.99/mo" },
  "6month": { label: "6 Months", period: "/6mo", monthlyEquiv: "$8.33/mo", savings: "Save 17%" },
  annual: { label: "Annual", period: "/yr", monthlyEquiv: "$6.67/mo", savings: "Save 33%" },
};

const PLAN_PACKAGE_KEYS: Record<PlanKey, string> = {
  monthly: "$rc_monthly",
  "6month": "$rc_six_month",
  annual: "$rc_annual",
};

const PLAN_FALLBACK_PRICES: Record<PlanKey, string> = {
  monthly: "$9.99",
  "6month": "$49.99",
  annual: "$79.99",
};

export function PaywallModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("annual");

  const currentOffering = offerings?.current;

  const getPackageForPlan = (plan: PlanKey) => {
    const key = PLAN_PACKAGE_KEYS[plan];
    return currentOffering?.availablePackages.find(
      (p: any) => p.identifier === key || p.packageType === key
    );
  };

  const getPriceForPlan = (plan: PlanKey) => {
    const pkg = getPackageForPlan(plan);
    return pkg?.product.priceString || PLAN_FALLBACK_PRICES[plan];
  };

  const selectedPackage = getPackageForPlan(selectedPlan);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    try {
      await purchase(selectedPackage);
      onClose();
    } catch (e: any) {
      if (e.userCancelled) return;
      console.error("Purchase error:", e);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      onClose();
    } catch (e) {
      console.error("Restore error:", e);
    }
  };

  const features = [
    { icon: "cpu" as const, text: "AI-Powered Stock Analysis" },
    { icon: "book-open" as const, text: "Day Trade Playbooks" },
    { icon: "target" as const, text: "Entry & Exit Strategies" },
    { icon: "trending-up" as const, text: "Unlimited Recommendations" },
  ];

  const plans: PlanKey[] = ["monthly", "6month", "annual"];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={paywallStyles.overlay}>
        <View style={paywallStyles.container}>
          <Pressable onPress={onClose} style={paywallStyles.closeBtn}>
            <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} style={{ width: "100%" }} contentContainerStyle={{ alignItems: "center" }}>
            <View style={paywallStyles.headerIcon}>
              <Feather name="star" size={32} color="#FFD700" />
            </View>
            <Text style={paywallStyles.title}>Go Premium</Text>
            <Text style={paywallStyles.subtitle}>
              Start your 7-day free trial today
            </Text>

            <View style={paywallStyles.featureList}>
              {features.map((f, i) => (
                <View key={i} style={paywallStyles.featureRow}>
                  <View style={paywallStyles.featureIcon}>
                    <Feather name={f.icon} size={16} color={C.tint} />
                  </View>
                  <Text style={paywallStyles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <View style={paywallStyles.planSelector}>
              {plans.map((plan) => {
                const info = PLAN_INFO[plan];
                const isSelected = selectedPlan === plan;
                const price = getPriceForPlan(plan);

                return (
                  <Pressable
                    key={plan}
                    onPress={() => setSelectedPlan(plan)}
                    style={[
                      paywallStyles.planCard,
                      isSelected && paywallStyles.planCardSelected,
                    ]}
                  >
                    {info.savings && (
                      <View style={paywallStyles.savingsBadge}>
                        <Text style={paywallStyles.savingsText}>{info.savings}</Text>
                      </View>
                    )}
                    {plan === "annual" && (
                      <View style={paywallStyles.bestValueBadge}>
                        <Text style={paywallStyles.bestValueText}>BEST VALUE</Text>
                      </View>
                    )}
                    <View style={[
                      paywallStyles.planRadio,
                      isSelected && paywallStyles.planRadioSelected,
                    ]}>
                      {isSelected && <View style={paywallStyles.planRadioDot} />}
                    </View>
                    <View style={paywallStyles.planInfo}>
                      <Text style={[
                        paywallStyles.planLabel,
                        isSelected && paywallStyles.planLabelSelected,
                      ]}>{info.label}</Text>
                      <Text style={paywallStyles.planMonthly}>{info.monthlyEquiv}</Text>
                    </View>
                    <Text style={[
                      paywallStyles.planPrice,
                      isSelected && paywallStyles.planPriceSelected,
                    ]}>
                      {price}<Text style={paywallStyles.planPeriod}>{info.period}</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handlePurchase}
              disabled={isPurchasing || !selectedPackage}
              style={[paywallStyles.purchaseBtn, isPurchasing && { opacity: 0.7 }]}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Feather name="zap" size={18} color="#000" />
                  <Text style={paywallStyles.purchaseText}>
                    Start 7-Day Free Trial
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={paywallStyles.trialInfo}>
              Free for 7 days, then {getPriceForPlan(selectedPlan)}{PLAN_INFO[selectedPlan].period}
            </Text>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              style={paywallStyles.restoreBtn}
            >
              {isRestoring ? (
                <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
              ) : (
                <Text style={paywallStyles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>

            <Text style={paywallStyles.terms}>
              After the free trial, subscription renews automatically.{"\n"}Cancel anytime. No charge during trial.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const paywallStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: C.navySurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    borderBottomWidth: 0,
    maxHeight: "90%",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  headerIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,215,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 24,
  },
  featureList: {
    width: "100%",
    marginBottom: 24,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,208,132,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    flex: 1,
  },
  planSelector: {
    width: "100%",
    gap: 10,
    marginBottom: 20,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  planCardSelected: {
    borderColor: "#FFD700",
    backgroundColor: "rgba(255,215,0,0.06)",
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  planRadioSelected: {
    borderColor: "#FFD700",
  },
  planRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFD700",
  },
  planInfo: {
    flex: 1,
  },
  planLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  planLabelSelected: {
    color: "#FFFFFF",
  },
  planMonthly: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.7)",
  },
  planPriceSelected: {
    color: "#FFD700",
  },
  planPeriod: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  savingsBadge: {
    position: "absolute",
    top: -9,
    right: 16,
    backgroundColor: C.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.5,
  },
  bestValueBadge: {
    position: "absolute",
    top: -9,
    left: 16,
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestValueText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.5,
  },
  purchaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    width: "100%",
    borderRadius: 14,
    marginBottom: 8,
  },
  purchaseText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  trialInfo: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 14,
  },
  restoreBtn: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  restoreText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  terms: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    lineHeight: 16,
  },
});

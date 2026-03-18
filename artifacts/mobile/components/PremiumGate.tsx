import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
            <Text style={overlayStyles.buttonText}>Upgrade to Premium</Text>
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

export function PaywallModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();

  const currentOffering = offerings?.current;
  const monthlyPackage = currentOffering?.availablePackages[0];
  const price = monthlyPackage?.product.priceString || "$9.99/mo";

  const handlePurchase = async () => {
    if (!monthlyPackage) return;
    try {
      await purchase(monthlyPackage);
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={paywallStyles.overlay}>
        <View style={paywallStyles.container}>
          <Pressable onPress={onClose} style={paywallStyles.closeBtn}>
            <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <View style={paywallStyles.headerIcon}>
            <Feather name="star" size={32} color="#FFD700" />
          </View>
          <Text style={paywallStyles.title}>Go Premium</Text>
          <Text style={paywallStyles.subtitle}>
            Unlock the full power of AI-driven trading insights
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

          <Pressable
            onPress={handlePurchase}
            disabled={isPurchasing || !monthlyPackage}
            style={[paywallStyles.purchaseBtn, isPurchasing && { opacity: 0.7 }]}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="zap" size={18} color="#000" />
                <Text style={paywallStyles.purchaseText}>
                  Subscribe for {price}
                </Text>
              </>
            )}
          </Pressable>

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
            Subscription renews automatically. Cancel anytime.
          </Text>
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
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  featureList: {
    width: "100%",
    marginBottom: 28,
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
  purchaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    width: "100%",
    borderRadius: 14,
    marginBottom: 14,
  },
  purchaseText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
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
  },
});

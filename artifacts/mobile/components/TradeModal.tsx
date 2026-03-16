import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TradeAction, usePortfolio } from "@/contexts/portfolio-context";

interface TradeModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  price: number;
  assetType?: "stock" | "crypto";
  suggestedAction?: string;
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  buy:   { bg: "#00D084", text: "#000" },
  sell:  { bg: "#FF4D6A", text: "#fff" },
  short: { bg: "#FF4D6A", text: "#fff" },
  cover: { bg: "#FFBA33", text: "#000" },
};

function mapSuggested(s?: string): "buy" | "short" {
  if (!s) return "buy";
  if (s === "SHORT" || s === "SELL") return "short";
  return "buy";
}

export function TradeModal({
  visible,
  onClose,
  symbol,
  name,
  price,
  assetType = "stock",
  suggestedAction,
}: TradeModalProps) {
  const insets = useSafeAreaInsets();
  const { portfolio, executeTrade } = usePortfolio();

  const existingPos = portfolio.positions[symbol];

  const getDefaultTab = (): "buy" | "sell" | "short" | "cover" => {
    if (existingPos?.direction === "long") return "sell";
    if (existingPos?.direction === "short") return "cover";
    return mapSuggested(suggestedAction);
  };

  const [activeTab, setActiveTab] = useState<TradeAction>(getDefaultTab());
  const [sharesInput, setSharesInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveTab(getDefaultTab());
      setSharesInput("");
    }
  }, [visible, symbol]);

  const shares = parseFloat(sharesInput) || 0;
  const total = shares * price;
  const isCrypto = assetType === "crypto";
  const isShortSide = activeTab === "short" || activeTab === "cover";

  const availableCash = portfolio.cash;
  const maxSharesByCash = price > 0 ? availableCash / price : 0;

  const tabs: TradeAction[] = existingPos
    ? existingPos.direction === "long"
      ? ["buy", "sell"]
      : ["short", "cover"]
    : ["buy", "short"];

  const tabLabels: Record<string, string> = {
    buy:   "Buy / Long",
    sell:  "Sell / Close",
    short: "Short / Futures",
    cover: "Cover Short",
  };

  const handleSetMax = () => {
    if (activeTab === "sell" && existingPos) {
      setSharesInput(existingPos.shares.toString());
    } else if (activeTab === "cover" && existingPos) {
      setSharesInput(existingPos.shares.toString());
    } else {
      setSharesInput(maxSharesByCash.toFixed(isCrypto ? 6 : 2));
    }
  };

  const handleTrade = async () => {
    if (shares <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid number of shares.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await executeTrade(symbol, name, activeTab, shares, price, assetType);
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      Alert.alert("Trade Executed!", result.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Trade Failed", result.message);
    }
  };

  const btnCfg = ACTION_COLORS[activeTab] ?? ACTION_COLORS.buy;

  const unrealizedPnl = existingPos
    ? existingPos.direction === "long"
      ? (price - existingPos.avgCost) * existingPos.shares
      : (existingPos.avgCost - price) * existingPos.shares
    : 0;
  const unrealizedPct = existingPos
    ? (unrealizedPnl / (existingPos.avgCost * existingPos.shares)) * 100
    : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.symbolText}>{symbol.replace("-USD", "")}</Text>
              <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceText}>
                ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
              </Text>
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          {existingPos && (
            <View style={styles.positionBanner}>
              <View>
                <Text style={styles.positionBannerLabel}>
                  Current {existingPos.direction === "long" ? "Long" : "Short"} Position
                </Text>
                <Text style={styles.positionBannerDetails}>
                  {existingPos.shares.toFixed(isCrypto ? 4 : 2)} shares @ ${existingPos.avgCost.toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.pnlText,
                    { color: unrealizedPnl >= 0 ? "#00D084" : "#FF4D6A" },
                  ]}
                >
                  {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.pnlPct,
                    { color: unrealizedPnl >= 0 ? "#00D084" : "#FF4D6A" },
                  ]}
                >
                  ({unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%)
                </Text>
              </View>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.tabRow}>
              {tabs.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.tab, activeTab === t && styles.activeTab]}
                  onPress={() => { setActiveTab(t); setSharesInput(""); }}
                >
                  <Text style={[styles.tabLabel, activeTab === t && styles.activeTabLabel]}>
                    {tabLabels[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.descRow}>
              <Text style={styles.descText}>
                {activeTab === "buy" && "Buy shares and profit when the price rises (Long position)."}
                {activeTab === "sell" && "Sell your shares to realize gains or cut losses."}
                {activeTab === "short" && "Borrow & sell shares now. Profit when price drops (Short / Futures). Margin reserved from your cash."}
                {activeTab === "cover" && "Buy back your shorted shares to close your short position."}
              </Text>
            </View>

            <View style={styles.cashRow}>
              <Text style={styles.cashLabel}>Available Cash</Text>
              <Text style={styles.cashValue}>${availableCash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            <View style={styles.inputSection}>
              <View style={styles.inputRow}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{isCrypto ? "Quantity" : "Shares"}</Text>
                  <TextInput
                    style={styles.input}
                    value={sharesInput}
                    onChangeText={setSharesInput}
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
                <Pressable style={styles.maxBtn} onPress={handleSetMax}>
                  <Text style={styles.maxBtnText}>MAX</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Price per share</Text>
                <Text style={styles.summaryValue}>${price < 1 ? price.toFixed(4) : price.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {activeTab === "short" ? "Margin Required" : "Total Cost"}
                </Text>
                <Text style={[styles.summaryValue, { fontWeight: "700", fontSize: 17 }]}>
                  ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              {(activeTab === "buy" || activeTab === "short") && shares > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Remaining Cash</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: availableCash - total < 0 ? "#FF4D6A" : "#00D084" },
                    ]}
                  >
                    ${(availableCash - total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={[
                styles.executeBtn,
                { backgroundColor: btnCfg.bg },
                (loading || shares <= 0) && { opacity: 0.5 },
              ]}
              onPress={handleTrade}
              disabled={loading || shares <= 0}
            >
              <Feather
                name={isShortSide ? "trending-down" : "trending-up"}
                size={18}
                color={btnCfg.text}
              />
              <Text style={[styles.executeBtnText, { color: btnCfg.text }]}>
                {loading ? "Executing..." : `${tabLabels[activeTab]} — $${total.toFixed(2)}`}
              </Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Paper trading only. No real money is used. Prices are live market data.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: "#0D1526",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  symbolText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  nameText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
    maxWidth: 160,
  },
  priceBox: {
    marginLeft: "auto",
    alignItems: "flex-end",
    marginRight: 12,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  liveLabel: {
    color: "#00D084",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  positionBanner: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  positionBannerLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  positionBannerDetails: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  pnlText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pnlPct: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tabLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
  },
  activeTabLabel: {
    color: "#FFFFFF",
  },
  descRow: {
    marginBottom: 14,
  },
  descText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 18,
  },
  cashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,208,132,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0,208,132,0.2)",
  },
  cashLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  cashValue: {
    color: "#00D084",
    fontSize: 15,
    fontWeight: "700",
  },
  inputSection: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  maxBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  maxBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  summaryBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  executeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 12,
  },
  executeBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  disclaimer: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 4,
  },
});

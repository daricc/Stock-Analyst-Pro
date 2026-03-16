import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueries } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { usePortfolio, Position, Transaction } from "@/contexts/portfolio-context";
import { TradeModal } from "@/components/TradeModal";
import { getApiUrl } from "@/lib/query-client";

const C = Colors.light;

async function fetchPrice(symbol: string): Promise<number> {
  const base = getApiUrl();
  const res = await fetch(`${base}api/stocks/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch price");
  const data = await res.json() as { price?: number };
  return data.price ?? 0;
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PnlBadge({ value, pct }: { value: number; pct: number }) {
  const isPos = value >= 0;
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Text style={[styles.pnlValue, { color: isPos ? "#00D084" : "#FF4D6A" }]}>
        {isPos ? "+" : ""}{formatCurrency(value)}
      </Text>
      <Text style={[styles.pnlPct, { color: isPos ? "#00D084" : "#FF4D6A" }]}>
        {isPos ? "+" : ""}{pct.toFixed(2)}%
      </Text>
    </View>
  );
}

interface PositionCardProps {
  position: Position;
  currentPrice: number | null;
  loadingPrice: boolean;
  onTrade: () => void;
}

function PositionCard({ position, currentPrice, loadingPrice, onTrade }: PositionCardProps) {
  const isCrypto = position.assetType === "crypto";
  const isLong = position.direction === "long";
  const price = currentPrice ?? position.avgCost;
  const pnl = isLong
    ? (price - position.avgCost) * position.shares
    : (position.avgCost - price) * position.shares;
  const pnlPct = (pnl / (position.avgCost * position.shares)) * 100;

  return (
    <Pressable
      style={styles.positionCard}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/stock/[symbol]", params: { symbol: position.symbol, name: position.name } });
      }}
    >
      <View style={styles.positionTopRow}>
        <View style={[styles.tickerBadge, isCrypto && styles.cryptoBadge]}>
          <Text style={styles.tickerText}>{position.symbol.replace("-USD", "")}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.positionName} numberOfLines={1}>{position.name}</Text>
          <View style={styles.directionRow}>
            <View style={[styles.dirBadge, isLong ? styles.longBadge : styles.shortBadge]}>
              <Feather
                name={isLong ? "trending-up" : "trending-down"}
                size={10}
                color={isLong ? "#00D084" : "#FF4D6A"}
              />
              <Text style={[styles.dirText, { color: isLong ? "#00D084" : "#FF4D6A" }]}>
                {isLong ? "LONG" : "SHORT"}
              </Text>
            </View>
            {isCrypto && (
              <View style={styles.cryptoBadgeSmall}>
                <Text style={styles.cryptoBadgeSmallText}>CRYPTO</Text>
              </View>
            )}
          </View>
        </View>
        {loadingPrice ? (
          <ActivityIndicator size="small" color={C.tint} />
        ) : (
          <PnlBadge value={pnl} pct={pnlPct} />
        )}
      </View>

      <View style={styles.positionDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Shares</Text>
          <Text style={styles.detailValue}>{position.shares.toFixed(isCrypto ? 4 : 2)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Avg Cost</Text>
          <Text style={styles.detailValue}>${position.avgCost.toFixed(2)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Current</Text>
          <Text style={styles.detailValue}>{loadingPrice ? "…" : `$${price.toFixed(2)}`}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Market Val</Text>
          <Text style={styles.detailValue}>{formatCurrency(price * position.shares)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.tradeBtn}
        onPress={(e) => { e.stopPropagation(); onTrade(); }}
      >
        <Feather name={isLong ? "dollar-sign" : "refresh-cw"} size={13} color="#FFFFFF" />
        <Text style={styles.tradeBtnText}>{isLong ? "Sell / Manage" : "Cover / Manage"}</Text>
      </Pressable>
    </Pressable>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isOpen = tx.action === "buy" || tx.action === "short";
  const actionLabels: Record<string, { label: string; color: string }> = {
    buy:   { label: "BUY",   color: "#00D084" },
    sell:  { label: "SELL",  color: "#FF4D6A" },
    short: { label: "SHORT", color: "#FF4D6A" },
    cover: { label: "COVER", color: "#FFBA33" },
  };
  const cfg = actionLabels[tx.action] ?? { label: tx.action.toUpperCase(), color: "#FFFFFF" };
  const date = new Date(tx.timestamp);

  return (
    <View style={styles.txRow}>
      <View style={[styles.txBadge, { backgroundColor: cfg.color + "20" }]}>
        <Text style={[styles.txBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.txSymbol}>{tx.symbol.replace("-USD", "")} · {tx.shares.toFixed(4)} sh @ ${tx.price.toFixed(2)}</Text>
        <Text style={styles.txDate}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.txTotal}>{formatCurrency(tx.total)}</Text>
        {tx.realizedPnl !== undefined && (
          <Text style={[styles.txPnl, { color: tx.realizedPnl >= 0 ? "#00D084" : "#FF4D6A" }]}>
            {tx.realizedPnl >= 0 ? "+" : ""}{formatCurrency(tx.realizedPnl)}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { portfolio, loaded, resetPortfolio } = usePortfolio();
  const [tradeTarget, setTradeTarget] = useState<string | null>(null);
  const [showTx, setShowTx] = useState(false);

  const positions = Object.values(portfolio.positions);
  const symbols = positions.map((p) => p.symbol);

  const priceQueries = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ["price", sym],
      queryFn: () => fetchPrice(sym),
      refetchInterval: 15000,
      staleTime: 10000,
    })),
  });

  const priceMap: Record<string, number | null> = {};
  symbols.forEach((sym, i) => {
    priceMap[sym] = priceQueries[i]?.data ?? null;
  });

  const totalPositionValue = positions.reduce((acc, p) => {
    const price = priceMap[p.symbol] ?? p.avgCost;
    return acc + price * p.shares;
  }, 0);

  const totalCostBasis = positions.reduce((acc, p) => acc + p.avgCost * p.shares, 0);
  const totalUnrealizedPnl = positions.reduce((acc, p) => {
    const price = priceMap[p.symbol] ?? p.avgCost;
    return acc + (p.direction === "long"
      ? (price - p.avgCost) * p.shares
      : (p.avgCost - price) * p.shares);
  }, 0);

  const totalPortfolioValue = portfolio.cash + totalPositionValue;
  const totalPnl = totalPortfolioValue - portfolio.startingBalance;
  const totalPnlPct = (totalPnl / portfolio.startingBalance) * 100;

  const realizedPnl = portfolio.transactions
    .filter((tx) => tx.realizedPnl !== undefined)
    .reduce((acc, tx) => acc + (tx.realizedPnl ?? 0), 0);

  const isRefreshing = priceQueries.some((q) => q.isFetching);

  const handleReset = () => {
    Alert.alert(
      "Reset Portfolio",
      "This will clear all positions, transactions, and restore your $100,000 starting balance. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetPortfolio();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const tradePos = tradeTarget ? portfolio.positions[tradeTarget] : null;
  const tradePrice = tradeTarget ? (priceMap[tradeTarget] ?? tradePos?.avgCost ?? 0) : 0;

  if (!loaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Paper Portfolio</Text>
          <Text style={styles.screenSubtitle}>Virtual trading · Real market prices</Text>
        </View>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Feather name="rotate-ccw" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => priceQueries.forEach((q) => q.refetch())}
            tintColor={C.tint}
          />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(totalPortfolioValue)}</Text>
          <PnlBadge value={totalPnl} pct={totalPnlPct} />

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Cash Available</Text>
              <Text style={styles.summaryItemValue}>{formatCurrency(portfolio.cash)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Invested</Text>
              <Text style={styles.summaryItemValue}>{formatCurrency(totalPositionValue)}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Unrealized P&L</Text>
              <Text style={[styles.summaryItemValue, { color: totalUnrealizedPnl >= 0 ? "#00D084" : "#FF4D6A" }]}>
                {totalUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedPnl)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Realized P&L</Text>
              <Text style={[styles.summaryItemValue, { color: realizedPnl >= 0 ? "#00D084" : "#FF4D6A" }]}>
                {realizedPnl >= 0 ? "+" : ""}{formatCurrency(realizedPnl)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Feather name="briefcase" size={16} color={C.tint} />
          <Text style={styles.sectionTitle}>
            Positions ({positions.length})
          </Text>
        </View>

        {positions.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="briefcase" size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No Open Positions</Text>
            <Text style={styles.emptySubtitle}>
              Go to Discover to find your first trade opportunity.
            </Text>
            <Pressable
              style={styles.goDiscoverBtn}
              onPress={() => router.push("/(tabs)/discover")}
            >
              <Feather name="compass" size={14} color="#000" />
              <Text style={styles.goDiscoverText}>Go to Discover</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10, paddingHorizontal: 16 }}>
            {positions.map((pos) => (
              <PositionCard
                key={pos.symbol}
                position={pos}
                currentPrice={priceMap[pos.symbol]}
                loadingPrice={priceQueries[symbols.indexOf(pos.symbol)]?.isLoading ?? false}
                onTrade={() => setTradeTarget(pos.symbol)}
              />
            ))}
          </View>
        )}

        <Pressable
          style={styles.sectionHeader}
          onPress={() => setShowTx(!showTx)}
        >
          <Feather name="clock" size={16} color="rgba(255,255,255,0.5)" />
          <Text style={[styles.sectionTitle, { color: "rgba(255,255,255,0.7)" }]}>
            Transaction History ({portfolio.transactions.length})
          </Text>
          <Feather
            name={showTx ? "chevron-up" : "chevron-down"}
            size={14}
            color="rgba(255,255,255,0.4)"
            style={{ marginLeft: "auto" }}
          />
        </Pressable>

        {showTx && (
          <View style={styles.txList}>
            {portfolio.transactions.length === 0 ? (
              <Text style={styles.emptySubtitle}>No transactions yet.</Text>
            ) : (
              portfolio.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {tradeTarget && tradePos && (
        <TradeModal
          visible={!!tradeTarget}
          onClose={() => setTradeTarget(null)}
          symbol={tradePos.symbol}
          name={tradePos.name}
          price={tradePrice}
          assetType={tradePos.assetType}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1E",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  screenTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  screenSubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resetBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "#0D1526",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  summaryTotal: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  pnlPct: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  summaryItemLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryItemValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  positionCard: {
    backgroundColor: "#0D1526",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  positionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tickerBadge: {
    backgroundColor: "#1A2A4A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 52,
    alignItems: "center",
  },
  cryptoBadge: {
    backgroundColor: "#2D1F4A",
  },
  tickerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  positionName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  directionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  longBadge: {
    backgroundColor: "rgba(0,208,132,0.15)",
  },
  shortBadge: {
    backgroundColor: "rgba(255,77,106,0.15)",
  },
  dirText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cryptoBadgeSmall: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cryptoBadgeSmallText: {
    color: "#A78BFA",
    fontSize: 9,
    fontWeight: "700",
  },
  positionDetails: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  detailItem: {
    flex: 1,
    alignItems: "center",
  },
  detailLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  tradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tradeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  goDiscoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#00D084",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  goDiscoverText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  txList: {
    paddingHorizontal: 16,
    gap: 1,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  txBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: "center",
  },
  txBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  txSymbol: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  txDate: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 2,
  },
  txTotal: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  txPnl: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});

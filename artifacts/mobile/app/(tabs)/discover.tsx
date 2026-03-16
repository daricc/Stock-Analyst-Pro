import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const C = Colors.light;

interface ProfitStrategy {
  action: string;
  entry: string;
  target: string;
  stopLoss: string;
  timeframe: string;
  rationale: string;
}

interface DiscoveredStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  category: string;
  assetType: string;
  sentiment: string;
  signalSource: string;
  aiSummary: string;
  profitStrategy: ProfitStrategy;
}

interface DiscoverResponse {
  discoveries: DiscoveredStock[];
  marketMood: string;
  topHeadlineThemes: string[];
  generatedAt: string;
}

async function fetchDiscoveries(): Promise<DiscoverResponse> {
  const base = getApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${base}api/stocks/discover`, { signal: controller.signal });
    if (!res.ok) throw new Error("Failed to discover stocks");
    return res.json() as Promise<DiscoverResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  trending: { label: "Trending Now", icon: "trending-up", color: "#5B9BFF" },
  gainers: { label: "Top Gainers", icon: "arrow-up-circle", color: "#00D084" },
  movers: { label: "Big Movers", icon: "zap", color: "#FFBA33" },
  crypto: { label: "Crypto", icon: "dollar-sign", color: "#A78BFA" },
  ai_pick: { label: "AI Picks", icon: "cpu", color: "#00D084" },
};

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BULLISH: { label: "Bullish", color: "#00D084", bg: "rgba(0,208,132,0.15)" },
  BEARISH: { label: "Bearish", color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  NEUTRAL: { label: "Neutral", color: "#FFBA33", bg: "rgba(255,186,51,0.15)" },
};

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  BUY: { color: "#00D084", bg: "rgba(0,208,132,0.15)" },
  SELL: { color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  SHORT: { color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  HOLD: { color: "#FFBA33", bg: "rgba(255,186,51,0.15)" },
  WATCH: { color: "#5B9BFF", bg: "rgba(91,155,255,0.15)" },
};

function MarketMoodBar({ mood, themes }: { mood: string; themes: string[] }) {
  return (
    <View style={styles.moodBar}>
      <View style={styles.moodHeader}>
        <Feather name="activity" size={16} color={C.tint} />
        <Text style={styles.moodLabel}>Market Pulse</Text>
      </View>
      <Text style={styles.moodText}>{mood}</Text>
      {themes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themesRow}>
          {themes.map((theme, i) => (
            <View key={i} style={styles.themeBadge}>
              <Text style={styles.themeText}>{theme}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StrategyCard({ strategy }: { strategy: ProfitStrategy }) {
  const actionCfg = ACTION_CONFIG[strategy.action] ?? ACTION_CONFIG.WATCH;
  return (
    <View style={styles.strategyCard}>
      <View style={styles.strategyHeader}>
        <View style={[styles.actionBadge, { backgroundColor: actionCfg.bg }]}>
          <Text style={[styles.actionText, { color: actionCfg.color }]}>{strategy.action}</Text>
        </View>
        <Text style={styles.strategyTimeframe}>{strategy.timeframe}</Text>
      </View>
      <View style={styles.strategyGrid}>
        <View style={styles.strategyItem}>
          <Text style={styles.strategyLabel}>Entry</Text>
          <Text style={styles.strategyValue} numberOfLines={2}>{strategy.entry}</Text>
        </View>
        <View style={styles.strategyItem}>
          <Text style={styles.strategyLabel}>Target</Text>
          <Text style={[styles.strategyValue, { color: "#00D084" }]} numberOfLines={2}>{strategy.target}</Text>
        </View>
        <View style={styles.strategyItem}>
          <Text style={styles.strategyLabel}>Stop Loss</Text>
          <Text style={[styles.strategyValue, { color: "#FF4D6A" }]} numberOfLines={2}>{strategy.stopLoss}</Text>
        </View>
      </View>
      <Text style={styles.strategyRationale}>{strategy.rationale}</Text>
    </View>
  );
}

function DiscoverCard({ item }: { item: DiscoveredStock }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = item.changePercent >= 0;
  const sentimentCfg = SENTIMENT_CONFIG[item.sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
  const isCrypto = item.assetType === "crypto";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/stock/[symbol]",
      params: { symbol: item.symbol, name: item.name },
    });
  };

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.discoverCard}>
      <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <View style={styles.cardTopRow}>
          <View style={[styles.tickerBadge, isCrypto && styles.cryptoBadge]}>
            <Text style={[styles.tickerText, isCrypto && styles.cryptoTickerText]}>
              {item.symbol.replace("-USD", "")}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.signalSource} numberOfLines={1}>
              {item.signalSource}
            </Text>
          </View>
          <View style={styles.cardPriceCol}>
            <Text style={styles.cardPrice}>
              ${item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}
            </Text>
            <View style={[styles.changeBadge, isPositive ? styles.positiveBg : styles.negativeBg]}>
              <Text style={[styles.changeText, isPositive ? styles.positiveClr : styles.negativeClr]}>
                {isPositive ? "+" : ""}{item.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardMidRow}>
          <View style={[styles.sentimentBadge, { backgroundColor: sentimentCfg.bg }]}>
            <View style={[styles.sentimentDot, { backgroundColor: sentimentCfg.color }]} />
            <Text style={[styles.sentimentText, { color: sentimentCfg.color }]}>{sentimentCfg.label}</Text>
          </View>
          {isCrypto && (
            <View style={styles.assetTypeBadge}>
              <Text style={styles.assetTypeText}>CRYPTO</Text>
            </View>
          )}
        </View>

        <Text style={styles.aiSummary}>{item.aiSummary}</Text>
      </Pressable>

      <Pressable onPress={toggleExpand} style={styles.strategyToggle}>
        <Feather name="target" size={14} color={C.tint} />
        <Text style={styles.strategyToggleText}>
          {expanded ? "Hide Strategy" : "View Profit Strategy"}
        </Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.tint} />
      </Pressable>

      {expanded && <StrategyCard strategy={item.profitStrategy} />}
    </View>
  );
}

function CategoryHeader({ category }: { category: string }) {
  const cfg = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.ai_pick;
  return (
    <View style={styles.categoryHeader}>
      <Feather name={cfg.icon as keyof typeof Feather.glyphMap} size={18} color={cfg.color} />
      <Text style={[styles.categoryLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ["discover"],
    queryFn: fetchDiscoveries,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
  });

  const grouped = React.useMemo(() => {
    if (!data?.discoveries) return [];
    const cats = ["trending", "gainers", "movers", "crypto", "ai_pick"];
    const groups: { category: string; items: DiscoveredStock[] }[] = [];
    for (const cat of cats) {
      const items = data.discoveries.filter((d) => d.category === cat);
      if (items.length > 0) groups.push({ category: cat, items });
    }
    return groups;
  }, [data]);

  const flatData = React.useMemo(() => {
    const result: ({ type: "mood" } | { type: "category"; category: string } | { type: "stock"; item: DiscoveredStock })[] = [];
    if (data?.marketMood) {
      result.push({ type: "mood" });
    }
    for (const group of grouped) {
      result.push({ type: "category", category: group.category });
      for (const item of group.items) {
        result.push({ type: "stock", item });
      }
    }
    return result;
  }, [data, grouped]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopPad }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.tint} />
          <Text style={styles.loadingTitle}>Scanning Markets...</Text>
          <Text style={styles.loadingSubtitle}>Analyzing trends, movers & crypto</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopPad }]}>
        <View style={styles.loadingContainer}>
          <Feather name="alert-circle" size={40} color="#FF4D6A" />
          <Text style={styles.loadingTitle}>Couldn't load discoveries</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad, paddingBottom: webBottomPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>AI-curated opportunities</Text>
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item, i) => {
          if (item.type === "mood") return "mood";
          if (item.type === "category") return `cat-${item.category}`;
          return `stock-${item.item.symbol}`;
        }}
        renderItem={({ item }) => {
          if (item.type === "mood" && data) {
            return <MarketMoodBar mood={data.marketMood} themes={data.topHeadlineThemes} />;
          }
          if (item.type === "category") {
            return <CategoryHeader category={item.category} />;
          }
          if (item.type === "stock") {
            return <DiscoverCard item={item.item} />;
          }
          return null;
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.tint}
            colors={[C.tint]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 12,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  moodBar: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  moodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.tint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moodText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  themesRow: {
    marginTop: 12,
    flexDirection: "row",
  },
  themeBadge: {
    backgroundColor: "rgba(91,155,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(91,155,255,0.25)",
  },
  themeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#5B9BFF",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  discoverCard: {
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingBottom: 8,
  },
  tickerBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.tintMuted,
    borderWidth: 1.5,
    borderColor: C.tintBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cryptoBadge: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.35)",
  },
  tickerText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.tint,
    letterSpacing: 0.3,
  },
  cryptoTickerText: {
    color: "#A78BFA",
  },
  cardInfo: {
    flex: 1,
    marginRight: 8,
  },
  cardName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  signalSource: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  cardPriceCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  cardPrice: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  positiveBg: {
    backgroundColor: "rgba(0,208,132,0.15)",
  },
  negativeBg: {
    backgroundColor: "rgba(255,77,106,0.15)",
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  positiveClr: {
    color: "#00D084",
  },
  negativeClr: {
    color: "#FF4D6A",
  },
  cardMidRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 6,
  },
  sentimentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  sentimentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sentimentText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  assetTypeBadge: {
    backgroundColor: "rgba(167,139,250,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  assetTypeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#A78BFA",
    letterSpacing: 0.5,
  },
  aiSummary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  strategyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  strategyToggleText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.tint,
  },
  strategyCard: {
    padding: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  strategyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  actionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  strategyTimeframe: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  strategyGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  strategyItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  strategyLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  strategyValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  strategyRationale: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: C.tint,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.navy,
  },
});

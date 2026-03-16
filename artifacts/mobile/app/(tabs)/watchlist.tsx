import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useWatchlist } from "@/contexts/watchlist-context";

const C = Colors.light;

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
}

async function fetchQuote(symbol: string): Promise<StockQuote> {
  const base = getApiUrl();
  const res = await fetch(`${base}api/stocks/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch quote");
  return res.json() as Promise<StockQuote>;
}

function WatchlistCard({ symbol, name, onRemove }: { symbol: string; name: string; onRemove: () => void }) {
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote(symbol),
    refetchInterval: 60000,
  });

  const isPositive = (quote?.changePercent ?? 0) >= 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/stock/[symbol]", params: { symbol, name } });
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      <View style={styles.cardLeft}>
        <View style={styles.tickerBadge}>
          <Text style={styles.tickerText}>{symbol}</Text>
        </View>
        <View>
          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardSymbol}>{symbol}</Text>
        </View>
      </View>

      <View style={styles.cardRight}>
        {isLoading ? (
          <ActivityIndicator size="small" color={C.tint} />
        ) : quote ? (
          <>
            <Text style={styles.price}>
              ${quote.price.toFixed(2)}
            </Text>
            <View style={[styles.changeBadge, isPositive ? styles.positiveBadge : styles.negativeBadge]}>
              <Text style={[styles.changeText, isPositive ? styles.positiveText : styles.negativeText]}>
                {isPositive ? "+" : ""}{quote.changePercent.toFixed(2)}%
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>—</Text>
        )}

        <Pressable onPress={handleRemove} style={styles.removeBtn} hitSlop={12}>
          <Ionicons name="close-circle" size={20} color={C.whiteLow} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const { watchlist, removeFromWatchlist } = useWatchlist();

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad, paddingBottom: webBottomPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watchlist</Text>
        <Text style={styles.headerSubtitle}>{watchlist.length} stock{watchlist.length !== 1 ? "s" : ""} tracked</Text>
      </View>

      {watchlist.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="star" size={36} color={C.tint} />
          </View>
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Search for stocks and tap the star to add them here
          </Text>
          <Pressable
            style={styles.searchButton}
            onPress={() => router.push("/")}
          >
            <Text style={styles.searchButtonText}>Find Stocks</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <WatchlistCard
              symbol={item.symbol}
              name={item.name}
              onRemove={() => removeFromWatchlist(item.symbol)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  tickerBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.tintMuted,
    borderWidth: 1,
    borderColor: C.tintBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.tint,
    letterSpacing: 0.3,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
    maxWidth: 140,
  },
  cardSymbol: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    marginTop: 1,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
    flexDirection: "row",
    alignSelf: "center",
  },
  price: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
    minWidth: 60,
    textAlign: "right",
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  positiveBadge: {
    backgroundColor: C.positiveMuted,
  },
  negativeBadge: {
    backgroundColor: C.negativeMuted,
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  positiveText: {
    color: C.positive,
  },
  negativeText: {
    color: C.negative,
  },
  errorText: {
    fontSize: 14,
    color: C.whiteLow,
  },
  removeBtn: {
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.tintMuted,
    borderWidth: 1,
    borderColor: C.tintBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.white,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    textAlign: "center",
    lineHeight: 21,
  },
  searchButton: {
    marginTop: 8,
    backgroundColor: C.tint,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  searchButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.navy,
  },
});

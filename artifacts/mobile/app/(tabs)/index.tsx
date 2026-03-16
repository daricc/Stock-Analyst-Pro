import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const C = Colors.light;

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "META", name: "Meta Platforms", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", type: "EQUITY" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", exchange: "NYSE", type: "ETF" },
];

async function searchStocks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const base = getApiUrl();
  const res = await fetch(`${base}api/stocks/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json() as { results: SearchResult[] };
  return data.results;
}

function StockRow({
  item,
  onPress,
}: {
  item: SearchResult;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.stockRow, pressed && styles.stockRowPressed]}
      onPress={onPress}
    >
      <View style={styles.tickerBadge}>
        <Text style={styles.tickerText}>{item.symbol}</Text>
      </View>
      <View style={styles.stockInfo}>
        <Text style={styles.stockName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.stockExchange}>
          {item.exchange} · {item.type}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={C.whiteLow} />
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchStocks(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 400);
  };

  const handleStockPress = (item: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    router.push({
      pathname: "/stock/[symbol]",
      params: { symbol: item.symbol, name: item.name },
    });
  };

  const showResults = debouncedQuery.length > 0;
  const displayItems: SearchResult[] = showResults ? (searchResults ?? []) : POPULAR_STOCKS;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad, paddingBottom: webBottomPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Markets</Text>
        <Text style={styles.headerSubtitle}>AI-powered stock analysis</Text>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={17} color={C.whiteMedium} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search stocks, ETFs..."
          placeholderTextColor={C.whiteLow}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {isSearching && (
          <ActivityIndicator size="small" color={C.tint} style={{ marginRight: 12 }} />
        )}
      </View>

      <FlatList<SearchResult>
        data={displayItems}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <StockRow item={item} onPress={() => handleStockPress(item)} />
        )}
        ListHeaderComponent={
          <SectionHeader title={showResults ? `Results for "${debouncedQuery}"` : "Popular Stocks"} />
        }
        ListEmptyComponent={
          !isSearching && debouncedQuery.length > 0 ? (
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={36} color={C.whiteLow} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try a different ticker or company name</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: {
    marginLeft: 14,
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: C.white,
    paddingHorizontal: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteMedium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  stockRowPressed: {
    opacity: 0.75,
    backgroundColor: C.navySurface,
  },
  tickerBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: C.tintMuted,
    borderWidth: 1,
    borderColor: C.tintBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  tickerText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: C.tint,
    letterSpacing: 0.3,
  },
  stockInfo: {
    flex: 1,
  },
  stockName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
  },
  stockExchange: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteMedium,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteLow,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

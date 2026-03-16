import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from "react-native-svg";

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
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  week52High: number;
  week52Low: number;
  currency: string;
  exchange: string;
}

interface PricePoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface Signal {
  name: string;
  signal: "BULLISH" | "NEUTRAL" | "BEARISH";
  detail: string;
}

interface EntryStrategy {
  idealEntryPrice: number;
  entryConditions: string[];
  supportLevels: number[];
  timing: string;
}

interface ExitStrategy {
  targetExitPrice: number;
  stopLossPrice: number;
  trailingStopPercent: number;
  exitConditions: string[];
  resistanceLevels: number[];
  timing: string;
}

interface FuturesSpecific {
  recommendedDuration: string;
  leverageConsiderations: string;
  marginRequirements: string;
  rolloverTiming: string;
  futuresRisks: string[];
}

interface ShortSpecific {
  borrowCostAssessment: string;
  shortSqueezeRisk: string;
  optimalShortEntry: string;
  coverTiming: string;
  shortRisks: string[];
}

type InvestmentStrategy = "standard" | "futures" | "short";

interface StockAnalysis {
  symbol: string;
  investmentStrategy: InvestmentStrategy;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number;
  targetPrice: number;
  targetPriceRange?: { low: number; high: number };
  timeHorizon?: string;
  summary: string;
  sentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  technicalSignals: Signal[];
  fundamentalSignals: Signal[];
  risks: string[];
  catalysts: string[];
  priceTargets?: { bear: number; base: number; bull: number };
  entryStrategy: EntryStrategy;
  exitStrategy: ExitStrategy;
  futuresSpecific?: FuturesSpecific;
  shortSpecific?: ShortSpecific;
  generatedAt: string;
}

const STRATEGIES: { label: string; value: InvestmentStrategy }[] = [
  { label: "Standard", value: "standard" },
  { label: "Futures", value: "futures" },
  { label: "Short", value: "short" },
];

const PERIODS = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(`${getApiUrl()}api/stocks/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<StockQuote>;
}

async function fetchHistory(symbol: string, period: string): Promise<PricePoint[]> {
  const res = await fetch(
    `${getApiUrl()}api/stocks/history?symbol=${encodeURIComponent(symbol)}&period=${period}`
  );
  if (!res.ok) throw new Error("Failed");
  const data = await res.json() as { data: PricePoint[] };
  return data.data;
}

async function analyzeStock(
  symbol: string,
  quote: StockQuote | undefined,
  history: PricePoint[] | undefined,
  investmentStrategy: InvestmentStrategy
): Promise<StockAnalysis> {
  const res = await fetch(`${getApiUrl()}api/stocks/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, quote, history: { symbol, period: "3mo", data: history }, investmentStrategy }),
  });
  if (!res.ok) throw new Error("Analysis failed");
  return res.json() as Promise<StockAnalysis>;
}

function MiniChart({ data, positive }: { data: PricePoint[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const width = 340;
  const height = 120;
  const pad = 8;
  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const toX = (i: number) => pad + (i / (closes.length - 1)) * (width - pad * 2);
  const toY = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);

  const points = closes.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const fillPoints = `${toX(0)},${height} ${points} ${toX(closes.length - 1)},${height}`;

  const color = positive ? C.positive : C.negative;
  const fillId = positive ? "greenGrad" : "redGrad";

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPoints} fill={`url(#${fillId})`} />
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RecommendationBadge({ rec }: { rec: StockAnalysis["recommendation"] }) {
  const config = {
    STRONG_BUY: { label: "Strong Buy", bg: "rgba(0, 208, 132, 0.2)", border: "rgba(0, 208, 132, 0.5)", text: C.positive },
    BUY: { label: "Buy", bg: "rgba(0, 208, 132, 0.12)", border: C.tintBorder, text: C.positive },
    HOLD: { label: "Hold", bg: C.neutralMuted, border: "rgba(245, 158, 11, 0.4)", text: C.neutral },
    SELL: { label: "Sell", bg: C.negativeMuted, border: "rgba(255, 59, 92, 0.4)", text: C.negative },
    STRONG_SELL: { label: "Strong Sell", bg: "rgba(255, 59, 92, 0.2)", border: "rgba(255, 59, 92, 0.5)", text: C.negative },
  };
  const c = config[rec];
  return (
    <View style={[styles.recBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.recLabel, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const colors = {
    BULLISH: C.positive,
    NEUTRAL: C.neutral,
    BEARISH: C.negative,
  };
  const icons = {
    BULLISH: "trending-up" as const,
    NEUTRAL: "minus" as const,
    BEARISH: "trending-down" as const,
  };
  const color = colors[signal.signal];
  const icon = icons[signal.signal];

  return (
    <View style={styles.signalRow}>
      <View style={[styles.signalIcon, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <View style={styles.signalContent}>
        <View style={styles.signalHeader}>
          <Text style={styles.signalName}>{signal.name}</Text>
          <Text style={[styles.signalBadge, { color }]}>{signal.signal}</Text>
        </View>
        <Text style={styles.signalDetail}>{signal.detail}</Text>
      </View>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatNumber(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

export default function StockDetailScreen() {
  const { symbol, name } = useLocalSearchParams<{ symbol: string; name: string }>();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState("1mo");
  const [selectedStrategy, setSelectedStrategy] = useState<InvestmentStrategy>("standard");

  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const inWatchlist = isInWatchlist(symbol ?? "");

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote(symbol ?? ""),
    enabled: !!symbol,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["history", symbol, period],
    queryFn: () => fetchHistory(symbol ?? "", period),
    enabled: !!symbol,
  });

  const {
    mutate: runAnalysis,
    data: analysis,
    isPending: analyzing,
    isError: analysisError,
  } = useMutation({
    mutationFn: () => analyzeStock(symbol ?? "", quote, history, selectedStrategy),

  });

  const isPositive = (quote?.changePercent ?? 0) >= 0;

  const handleWatchlist = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inWatchlist) {
      removeFromWatchlist(symbol ?? "");
    } else {
      addToWatchlist({ symbol: symbol ?? "", name: name ?? symbol ?? "", addedAt: new Date().toISOString() });
    }
  }, [inWatchlist, symbol, name, addToWatchlist, removeFromWatchlist]);

  const handleAnalyze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runAnalysis();
  }, [runAnalysis]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={24} color={C.white} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navSymbol}>{symbol}</Text>
        </View>
        <Pressable onPress={handleWatchlist} style={styles.watchlistBtn} hitSlop={12}>
          <Ionicons
            name={inWatchlist ? "star" : "star-outline"}
            size={22}
            color={inWatchlist ? C.tint : C.whiteMedium}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {quoteLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.tint} />
            <Text style={styles.loadingText}>Loading quote...</Text>
          </View>
        ) : quote ? (
          <>
            <View style={styles.priceSection}>
              <Text style={styles.companyName} numberOfLines={2}>{quote.name}</Text>
              <Text style={styles.price}>${quote.price.toFixed(2)}</Text>
              <View style={styles.changeRow}>
                <View style={[styles.changeBadge, isPositive ? styles.positiveBadge : styles.negativeBadge]}>
                  <Feather
                    name={isPositive ? "trending-up" : "trending-down"}
                    size={13}
                    color={isPositive ? C.positive : C.negative}
                  />
                  <Text style={[styles.changeText, isPositive ? styles.positiveText : styles.negativeText]}>
                    {isPositive ? "+" : ""}{quote.change.toFixed(2)} ({isPositive ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                  </Text>
                </View>
                <Text style={styles.exchangeText}>{quote.exchange} · {quote.currency}</Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              {historyLoading ? (
                <View style={styles.chartPlaceholder}>
                  <ActivityIndicator color={C.tint} />
                </View>
              ) : history && history.length > 0 ? (
                <MiniChart data={history} positive={isPositive} />
              ) : (
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.noChartText}>Chart unavailable</Text>
                </View>
              )}
            </View>

            <View style={styles.periodRow}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p.value}
                  style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
                  onPress={() => {
                    setPeriod(p.value);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.periodLabel, period === p.value && styles.periodLabelActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.statsGrid}>
              <StatBox label="Open" value={`$${quote.open?.toFixed(2) ?? "—"}`} />
              <StatBox label="High" value={`$${quote.high?.toFixed(2) ?? "—"}`} />
              <StatBox label="Low" value={`$${quote.low?.toFixed(2) ?? "—"}`} />
              <StatBox label="Volume" value={formatNumber(quote.volume).replace("$", "")} />
              <StatBox label="Market Cap" value={formatNumber(quote.marketCap)} />
              <StatBox label="52W High" value={`$${quote.week52High?.toFixed(2) ?? "—"}`} />
              <StatBox label="52W Low" value={`$${quote.week52Low?.toFixed(2) ?? "—"}`} />
            </View>

            {!analysis && !analyzing && (
              <View style={styles.strategySection}>
                <Text style={styles.strategySectionTitle}>Investment Strategy</Text>
                <View style={styles.strategyRow}>
                  {STRATEGIES.map((s) => (
                    <Pressable
                      key={s.value}
                      style={[styles.strategyBtn, selectedStrategy === s.value && styles.strategyBtnActive]}
                      onPress={() => {
                        setSelectedStrategy(s.value);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Feather
                        name={s.value === "standard" ? "bar-chart-2" : s.value === "futures" ? "clock" : "arrow-down-right"}
                        size={14}
                        color={selectedStrategy === s.value ? C.navy : C.whiteMedium}
                      />
                      <Text style={[styles.strategyLabel, selectedStrategy === s.value && styles.strategyLabelActive]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  style={({ pressed }) => [styles.analyzeBtn, pressed && styles.analyzeBtnPressed]}
                  onPress={handleAnalyze}
                >
                  <Feather name="cpu" size={20} color={C.navy} />
                  <Text style={styles.analyzeBtnText}>Run AI Analysis</Text>
                </Pressable>
              </View>

            )}

            {analyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator color={C.tint} size="small" />
                <Text style={styles.analyzingText}>Analyzing {symbol}...</Text>
              </View>
            )}

            {analysisError && !analyzing && (
              <View style={styles.errorContainer}>
                <Feather name="alert-triangle" size={20} color={C.negative} />
                <Text style={styles.errorText}>Analysis failed. Please try again.</Text>
                <Pressable onPress={handleAnalyze}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {analysis && (
              <View style={styles.analysisContainer}>
                <View style={styles.analysisHeader}>
                  <Text style={styles.sectionTitle}>
                    AI Analysis · {analysis.investmentStrategy === "futures" ? "Futures" : analysis.investmentStrategy === "short" ? "Short" : "Standard"}
                  </Text>

                  <Text style={styles.analysisTimestamp}>
                    {new Date(analysis.generatedAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.recommendationCard}>
                  <View style={styles.recRow}>
                    <RecommendationBadge rec={analysis.recommendation} />
                    <View style={styles.confidenceBar}>
                      <Text style={styles.confidenceLabel}>Confidence</Text>
                      <View style={styles.confidenceTrack}>
                        <View
                          style={[
                            styles.confidenceFill,
                            {
                              width: `${analysis.confidence}%`,
                              backgroundColor:
                                analysis.confidence > 70
                                  ? C.positive
                                  : analysis.confidence > 40
                                  ? C.neutral
                                  : C.negative,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.confidenceValue}>{analysis.confidence}%</Text>
                    </View>
                  </View>
                  <Text style={styles.analysisSummary}>{analysis.summary}</Text>
                </View>

                {analysis.priceTargets && (
                  <View style={styles.priceTargetsCard}>
                    <Text style={styles.cardSectionTitle}>Price Targets{analysis.timeHorizon ? ` · ${analysis.timeHorizon}` : ""}</Text>
                    <View style={styles.priceTargetsRow}>
                      <View style={styles.priceTarget}>
                        <Text style={styles.ptLabel}>Bear</Text>
                        <Text style={[styles.ptValue, { color: C.negative }]}>
                          ${analysis.priceTargets.bear.toFixed(2)}
                        </Text>
                      </View>
                      <View style={[styles.priceTarget, styles.ptBase]}>
                        <Text style={styles.ptLabel}>Base</Text>
                        <Text style={[styles.ptValue, styles.ptBaseValue]}>
                          ${analysis.priceTargets.base.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.priceTarget}>
                        <Text style={styles.ptLabel}>Bull</Text>
                        <Text style={[styles.ptValue, { color: C.positive }]}>
                          ${analysis.priceTargets.bull.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {analysis.entryStrategy && (
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyCardHeader}>
                      <Feather name="log-in" size={16} color={C.positive} />
                      <Text style={styles.cardSectionTitle}>Entry Strategy</Text>
                    </View>
                    <View style={styles.strategyDetailRow}>
                      <Text style={styles.strategyDetailLabel}>Ideal Entry</Text>
                      <Text style={[styles.strategyDetailValue, { color: C.positive }]}>
                        ${analysis.entryStrategy.idealEntryPrice.toFixed(2)}
                      </Text>
                    </View>
                    {analysis.entryStrategy.supportLevels.length > 0 && (
                      <View style={styles.strategyDetailRow}>
                        <Text style={styles.strategyDetailLabel}>Support Levels</Text>
                        <Text style={styles.strategyDetailValue}>
                          {analysis.entryStrategy.supportLevels.map((p) => `$${p.toFixed(2)}`).join(", ")}
                        </Text>
                      </View>
                    )}
                    <View style={styles.strategyTimingBox}>
                      <Feather name="clock" size={12} color={C.whiteLow} />
                      <Text style={styles.strategyTimingText}>{analysis.entryStrategy.timing}</Text>
                    </View>
                    {analysis.entryStrategy.entryConditions.map((c, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.positive }]} />
                        <Text style={styles.listItemText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.exitStrategy && (
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyCardHeader}>
                      <Feather name="log-out" size={16} color={C.negative} />
                      <Text style={styles.cardSectionTitle}>Exit Strategy</Text>
                    </View>
                    <View style={styles.strategyDetailRow}>
                      <Text style={styles.strategyDetailLabel}>Target Exit</Text>
                      <Text style={[styles.strategyDetailValue, { color: C.positive }]}>
                        ${analysis.exitStrategy.targetExitPrice.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.strategyDetailRow}>
                      <Text style={styles.strategyDetailLabel}>Stop Loss</Text>
                      <Text style={[styles.strategyDetailValue, { color: C.negative }]}>
                        ${analysis.exitStrategy.stopLossPrice.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.strategyDetailRow}>
                      <Text style={styles.strategyDetailLabel}>Trailing Stop</Text>
                      <Text style={styles.strategyDetailValue}>
                        {analysis.exitStrategy.trailingStopPercent}%
                      </Text>
                    </View>
                    {analysis.exitStrategy.resistanceLevels.length > 0 && (
                      <View style={styles.strategyDetailRow}>
                        <Text style={styles.strategyDetailLabel}>Resistance</Text>
                        <Text style={styles.strategyDetailValue}>
                          {analysis.exitStrategy.resistanceLevels.map((p) => `$${p.toFixed(2)}`).join(", ")}
                        </Text>
                      </View>
                    )}
                    <View style={styles.strategyTimingBox}>
                      <Feather name="clock" size={12} color={C.whiteLow} />
                      <Text style={styles.strategyTimingText}>{analysis.exitStrategy.timing}</Text>
                    </View>
                    {analysis.exitStrategy.exitConditions.map((c, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.negative }]} />
                        <Text style={styles.listItemText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.futuresSpecific && (
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyCardHeader}>
                      <Feather name="layers" size={16} color={C.tint} />
                      <Text style={styles.cardSectionTitle}>Futures Insights</Text>
                    </View>
                    <View style={styles.strategyDetailRow}>
                      <Text style={styles.strategyDetailLabel}>Duration</Text>
                      <Text style={styles.strategyDetailValue}>{analysis.futuresSpecific.recommendedDuration}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Leverage</Text>
                      <Text style={styles.strategyInsightText}>{analysis.futuresSpecific.leverageConsiderations}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Margin</Text>
                      <Text style={styles.strategyInsightText}>{analysis.futuresSpecific.marginRequirements}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Rollover</Text>
                      <Text style={styles.strategyInsightText}>{analysis.futuresSpecific.rolloverTiming}</Text>
                    </View>
                    {analysis.futuresSpecific.futuresRisks.map((r, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.neutral }]} />
                        <Text style={styles.listItemText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.shortSpecific && (
                  <View style={styles.strategyCard}>
                    <View style={styles.strategyCardHeader}>
                      <Feather name="arrow-down-right" size={16} color={C.tint} />
                      <Text style={styles.cardSectionTitle}>Short Selling Insights</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Borrow Cost</Text>
                      <Text style={styles.strategyInsightText}>{analysis.shortSpecific.borrowCostAssessment}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Squeeze Risk</Text>
                      <Text style={styles.strategyInsightText}>{analysis.shortSpecific.shortSqueezeRisk}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Entry Point</Text>
                      <Text style={styles.strategyInsightText}>{analysis.shortSpecific.optimalShortEntry}</Text>
                    </View>
                    <View style={styles.strategyInsightBox}>
                      <Text style={styles.strategyInsightLabel}>Cover Timing</Text>
                      <Text style={styles.strategyInsightText}>{analysis.shortSpecific.coverTiming}</Text>
                    </View>
                    {analysis.shortSpecific.shortRisks.map((r, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.negative }]} />
                        <Text style={styles.listItemText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.technicalSignals.length > 0 && (
                  <View style={styles.signalsSection}>
                    <Text style={styles.cardSectionTitle}>Technical Signals</Text>
                    {analysis.technicalSignals.map((s, i) => (
                      <SignalRow key={i} signal={s} />
                    ))}
                  </View>
                )}

                {analysis.fundamentalSignals.length > 0 && (
                  <View style={styles.signalsSection}>
                    <Text style={styles.cardSectionTitle}>Fundamental Signals</Text>
                    {analysis.fundamentalSignals.map((s, i) => (
                      <SignalRow key={i} signal={s} />
                    ))}
                  </View>
                )}

                {analysis.catalysts.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={styles.cardSectionTitle}>Catalysts</Text>
                    {analysis.catalysts.map((c, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.positive }]} />
                        <Text style={styles.listItemText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.risks.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={styles.cardSectionTitle}>Key Risks</Text>
                    {analysis.risks.map((r, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listDot, { backgroundColor: C.negative }]} />
                        <Text style={styles.listItemText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.disclaimer}>
                  <Feather name="info" size={13} color={C.whiteLow} />
                  <Text style={styles.disclaimerText}>
                    AI-generated analysis is for informational purposes only and does not constitute financial advice.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.reAnalyzeBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleAnalyze}
                >
                  <Feather name="refresh-cw" size={15} color={C.whiteMedium} />
                  <Text style={styles.reAnalyzeText}>Re-analyze</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={36} color={C.negative} />
            <Text style={styles.errorTitle}>Failed to load {symbol}</Text>
            <Text style={styles.errorSubtitle}>Check the ticker and try again</Text>
            <Pressable onPress={() => router.back()} style={styles.backPressable}>
              <Text style={styles.backText}>Go Back</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  navCenter: {
    flex: 1,
    alignItems: "center",
  },
  navSymbol: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: C.white,
    letterSpacing: 0.3,
  },
  watchlistBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
  },
  priceSection: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.whiteMedium,
    marginBottom: 6,
  },
  price: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: C.white,
    letterSpacing: -1,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  positiveBadge: { backgroundColor: C.positiveMuted },
  negativeBadge: { backgroundColor: C.negativeMuted },
  changeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  positiveText: { color: C.positive },
  negativeText: { color: C.negative },
  exchangeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.whiteLow,
  },
  chartContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  chartPlaceholder: {
    height: 120,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  noChartText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteLow,
  },
  periodRow: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 9,
  },
  periodBtnActive: {
    backgroundColor: C.tint,
  },
  periodLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteMedium,
  },
  periodLabelActive: {
    color: C.navy,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.tint,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 24,
  },
  analyzeBtnPressed: {
    opacity: 0.85,
  },
  analyzeBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: C.navy,
  },
  analyzingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 24,
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  analyzingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: C.whiteMedium,
  },
  errorContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.white,
  },
  errorSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
  },
  retryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.tint,
    marginTop: 4,
  },
  backPressable: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
  },
  backText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
  },
  analysisContainer: {
    gap: 12,
    marginBottom: 20,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.white,
  },
  analysisTimestamp: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.whiteLow,
  },
  recommendationCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  recRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  recBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  recLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  confidenceBar: {
    flex: 1,
    gap: 4,
  },
  confidenceLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confidenceTrack: {
    height: 6,
    backgroundColor: C.whiteVeryLow,
    borderRadius: 3,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteMedium,
  },
  analysisSummary: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    lineHeight: 21,
  },
  priceTargetsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceTargetsRow: {
    flexDirection: "row",
    gap: 8,
  },
  priceTarget: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  ptBase: {
    borderColor: C.tintBorder,
    backgroundColor: C.tintMuted,
  },
  ptLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ptValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  ptBaseValue: {
    color: C.tint,
  },
  signalsSection: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  signalIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  signalContent: {
    flex: 1,
    gap: 2,
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signalName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.white,
  },
  signalBadge: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  signalDetail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    lineHeight: 18,
  },
  listSection: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.whiteLow,
    lineHeight: 16,
  },
  reAnalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  reAnalyzeText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.whiteMedium,
  },
  strategySection: {
    gap: 12,
    marginBottom: 24,
  },
  strategySectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  strategyRow: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  strategyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  strategyBtnActive: {
    backgroundColor: C.tint,
  },
  strategyLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteMedium,
  },
  strategyLabelActive: {
    color: C.navy,
  },
  strategyCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  strategyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  strategyDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  strategyDetailLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.whiteLow,
  },
  strategyDetailValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.white,
  },
  strategyTimingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  strategyTimingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    lineHeight: 18,
  },
  strategyInsightBox: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  strategyInsightLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.whiteLow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  strategyInsightText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.whiteMedium,
    lineHeight: 18,
  },
});

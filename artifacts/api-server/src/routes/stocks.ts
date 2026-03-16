import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_SCREENER_BASE = "https://query2.finance.yahoo.com";

async function fetchYahooQuote(symbol: string) {
  const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchYahooHistory(symbol: string, range: string) {
  const intervalMap: Record<string, string> = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1wk",
  };
  const interval = intervalMap[range] || "1d";
  const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance history error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchYahooSearch(q: string) {
  const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo search error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

router.get("/stocks/quote", async (req, res) => {
  const symbol = req.query["symbol"] as string;
  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  try {
    const q = await fetchSingleQuoteViaChart(symbol.toUpperCase());
    if (!q) {
      res.status(404).json({ error: "Stock not found" });
      return;
    }

    const price = (q["regularMarketPrice"] as number) ?? 0;
    res.json({
      symbol: (q["symbol"] as string) ?? symbol.toUpperCase(),
      name: (q["longName"] as string) ?? (q["shortName"] as string) ?? symbol.toUpperCase(),
      price,
      change: parseFloat(((q["regularMarketChange"] as number) ?? 0).toFixed(2)),
      changePercent: parseFloat(((q["regularMarketChangePercent"] as number) ?? 0).toFixed(2)),
      open: (q["regularMarketOpen"] as number) ?? price,
      high: (q["regularMarketDayHigh"] as number) ?? price,
      low: (q["regularMarketDayLow"] as number) ?? price,
      volume: (q["regularMarketVolume"] as number) ?? 0,
      marketCap: (q["marketCap"] as number) ?? 0,
      pe: null,
      week52High: (q["fiftyTwoWeekHigh"] as number) ?? price,
      week52Low: (q["fiftyTwoWeekLow"] as number) ?? price,
      currency: (q["currency"] as string) ?? "USD",
      exchange: (q["exchangeName"] as string) ?? (q["fullExchangeName"] as string) ?? "Unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Quote error:", err);
    res.status(500).json({ error: "Failed to fetch stock quote" });
  }
});

router.get("/stocks/history", async (req, res) => {
  const symbol = req.query["symbol"] as string;
  const period = (req.query["period"] as string) || "1mo";

  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  try {
    const data = await fetchYahooHistory(symbol.toUpperCase(), period);
    const chart = data as Record<string, unknown>;
    const result = (chart["chart"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[] | null;

    if (!result || result.length === 0) {
      res.status(404).json({ error: "Stock history not found" });
      return;
    }

    const stockData = result[0];
    const timestamps = stockData["timestamp"] as number[] | undefined;
    const indicators = stockData["indicators"] as Record<string, unknown>;
    const quote = ((indicators["quote"] as Record<string, unknown>[])?.[0]) as Record<string, number[]> | undefined;

    if (!timestamps || !quote) {
      res.json({ symbol: symbol.toUpperCase(), period, data: [] });
      return;
    }

    const opens = quote["open"] ?? [];
    const highs = quote["high"] ?? [];
    const lows = quote["low"] ?? [];
    const closes = quote["close"] ?? [];
    const volumes = quote["volume"] ?? [];

    const priceData = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      open: opens[i] ? parseFloat((opens[i]).toFixed(2)) : 0,
      high: highs[i] ? parseFloat((highs[i]).toFixed(2)) : 0,
      low: lows[i] ? parseFloat((lows[i]).toFixed(2)) : 0,
      close: closes[i] ? parseFloat((closes[i]).toFixed(2)) : 0,
      volume: volumes[i] ?? 0,
    })).filter(d => d.close > 0);

    res.json({
      symbol: symbol.toUpperCase(),
      period,
      data: priceData,
    });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Failed to fetch stock history" });
  }
});

router.get("/stocks/search", async (req, res) => {
  const q = req.query["q"] as string;
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }

  try {
    const data = await fetchYahooSearch(q);
    const quotes = ((data["quotes"] as Record<string, unknown>[]) ?? [])
      .filter((q: Record<string, unknown>) => q["quoteType"] === "EQUITY" || q["quoteType"] === "ETF" || q["quoteType"] === "CRYPTOCURRENCY")
      .slice(0, 8)
      .map((q: Record<string, unknown>) => ({
        symbol: q["symbol"] as string,
        name: (q["longname"] as string) ?? (q["shortname"] as string) ?? (q["symbol"] as string),
        exchange: (q["exchDisp"] as string) ?? "Unknown",
        type: (q["quoteType"] as string) ?? "EQUITY",
      }));

    res.json({ results: quotes, query: q });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Failed to search stocks" });
  }
});

function buildStrategyPromptSection(strategy: string): string {
  const entryExitJson = `
  "entryStrategy": {
    "idealEntryPrice": <number>,
    "entryConditions": ["<condition 1>", "<condition 2>", "<condition 3>"],
    "supportLevels": [<price1>, <price2>, <price3>],
    "timing": "<when to enter based on current conditions>"
  },
  "exitStrategy": {
    "targetExitPrice": <number>,
    "stopLossPrice": <number>,
    "trailingStopPercent": <number between 1-10>,
    "exitConditions": ["<condition 1>", "<condition 2>", "<condition 3>"],
    "resistanceLevels": [<price1>, <price2>, <price3>],
    "timing": "<when to exit based on current conditions>"
  },`;

  if (strategy === "futures") {
    return `
Analyze this from a FUTURES TRADING perspective. Consider contract duration, leverage, margin, and rollover timing.

Additional JSON fields to include:
${entryExitJson}
  "futuresSpecific": {
    "recommendedDuration": "<recommended contract duration e.g. near-month, quarterly>",
    "leverageConsiderations": "<analysis of appropriate leverage levels and risks>",
    "marginRequirements": "<estimated margin requirements and maintenance considerations>",
    "rolloverTiming": "<when to roll over contracts and strategy for doing so>",
    "futuresRisks": ["<futures-specific risk 1>", "<futures-specific risk 2>", "<futures-specific risk 3>"]
  },`;
  }

  if (strategy === "short") {
    return `
Analyze this from a SHORT SELLING perspective. Evaluate borrow costs, short squeeze risk, optimal short entry, and cover timing.

Additional JSON fields to include:
${entryExitJson}
  "shortSpecific": {
    "borrowCostAssessment": "<estimated borrow costs and availability>",
    "shortSqueezeRisk": "<assessment of short squeeze potential and current short interest>",
    "optimalShortEntry": "<specific price levels and conditions for initiating a short position>",
    "coverTiming": "<when and at what levels to cover the short position>",
    "shortRisks": ["<short-specific risk 1>", "<short-specific risk 2>", "<short-specific risk 3>"]
  },`;
  }

  return `
Analyze this from a STANDARD BUY/HOLD investment perspective.

Additional JSON fields to include:
${entryExitJson}`;
}

router.post("/stocks/analyze", async (req, res) => {
  const { symbol, quote, history, investmentStrategy } = req.body as {
    symbol: string;
    quote?: Record<string, unknown>;
    history?: Record<string, unknown>;
    investmentStrategy?: string;
  };

  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const validStrategies = ["standard", "futures", "short"];
  const strategy = validStrategies.includes(investmentStrategy ?? "") ? investmentStrategy! : "standard";
  try {
    let stockQuote = quote;
    let stockHistory = history;

    if (!stockQuote) {
      try {
        const quoteRes = await fetch(`http://localhost:${process.env["PORT"] ?? 3000}/api/stocks/quote?symbol=${symbol}`);
        if (quoteRes.ok) stockQuote = await quoteRes.json() as Record<string, unknown>;
      } catch {}
    }

    if (!stockHistory) {
      try {
        const histRes = await fetch(`http://localhost:${process.env["PORT"] ?? 3000}/api/stocks/history?symbol=${symbol}&period=3mo`);
        if (histRes.ok) stockHistory = await histRes.json() as Record<string, unknown>;
      } catch {}
    }

    const currentPrice = stockQuote ? (stockQuote["price"] as number) : null;
    const changePercent = stockQuote ? (stockQuote["changePercent"] as number) : null;
    const high52 = stockQuote ? (stockQuote["week52High"] as number) : null;
    const low52 = stockQuote ? (stockQuote["week52Low"] as number) : null;
    const marketCap = stockQuote ? (stockQuote["marketCap"] as number) : null;
    const volume = stockQuote ? (stockQuote["volume"] as number) : null;
    const name = stockQuote ? (stockQuote["name"] as string) : symbol;

    const historyData = stockHistory ? ((stockHistory["data"] as Record<string, unknown>[]) ?? []) : [];
    const recentPrices = historyData.slice(-30).map((d) => (d["close"] as number));
    const priceChange30d = recentPrices.length >= 2
      ? ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100
      : null;

    const strategySection = buildStrategyPromptSection(strategy);

    const strategyLabel = strategy === "futures" ? "Futures Trading" : strategy === "short" ? "Short Selling" : "Standard (Buy/Hold)";

    const prompt = `You are a professional stock analyst with expertise in technical and fundamental analysis. Analyze the following stock data and provide a detailed investment recommendation.

Investment Strategy: ${strategyLabel}

Stock: ${name} (${symbol})
${currentPrice ? `Current Price: $${currentPrice}` : ""}
${changePercent !== null ? `Today's Change: ${changePercent > 0 ? "+" : ""}${changePercent?.toFixed(2)}%` : ""}
${high52 ? `52-Week High: $${high52}` : ""}
${low52 ? `52-Week Low: $${low52}` : ""}
${marketCap ? `Market Cap: $${(marketCap / 1e9).toFixed(2)}B` : ""}
${volume ? `Volume: ${(volume / 1e6).toFixed(2)}M` : ""}
${priceChange30d !== null ? `30-Day Price Change: ${priceChange30d.toFixed(2)}%` : ""}
${recentPrices.length > 0 ? `Recent 30-day price trend: ${recentPrices.slice(0, 5).map((p) => `$${p.toFixed(2)}`).join(", ")}...${recentPrices.slice(-5).map((p) => `$${p.toFixed(2)}`).join(", ")}` : ""}
${strategySection}

Provide a comprehensive stock analysis in the following JSON format exactly (no markdown, just raw JSON):
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": <0-100 number>,
  "targetPrice": <number>,
  "targetPriceRange": { "low": <number>, "high": <number> },
  "timeHorizon": "3-6 months",
  "summary": "<2-3 sentence investment thesis tailored to ${strategyLabel} strategy>",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "technicalSignals": [
    { "name": "<signal name>", "signal": "BULLISH" | "NEUTRAL" | "BEARISH", "detail": "<explanation>" },
    ...3-4 signals
  ],
  "fundamentalSignals": [
    { "name": "<factor name>", "signal": "BULLISH" | "NEUTRAL" | "BEARISH", "detail": "<explanation>" },
    ...3-4 signals
  ],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "catalysts": ["<catalyst 1>", "<catalyst 2>", "<catalyst 3>"],
  "priceTargets": { "bear": <number>, "base": <number>, "bull": <number> },
  ...include the additional strategy-specific JSON fields described above
}

Be specific and data-driven. Base your analysis on the provided data. Provide realistic price targets and entry/exit levels based on the current price. All price levels must be concrete numbers.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 3000,
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst. Respond only with valid JSON, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(content) as Record<string, unknown>;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {};
    }

    const defaultEntry = {
      idealEntryPrice: currentPrice ?? 0,
      entryConditions: ["Wait for confirmation of trend direction"],
      supportLevels: currentPrice ? [currentPrice * 0.97, currentPrice * 0.94, currentPrice * 0.90] : [],
      timing: "Monitor for entry signal",
    };

    const defaultExit = {
      targetExitPrice: currentPrice ? currentPrice * 1.1 : 0,
      stopLossPrice: currentPrice ? currentPrice * 0.95 : 0,
      trailingStopPercent: 5,
      exitConditions: ["Target price reached", "Stop loss triggered"],
      resistanceLevels: currentPrice ? [currentPrice * 1.03, currentPrice * 1.06, currentPrice * 1.10] : [],
      timing: "Exit when conditions are met",
    };

    const result: Record<string, unknown> = {
      symbol: symbol.toUpperCase(),
      investmentStrategy: strategy,
      recommendation: analysis["recommendation"] ?? "HOLD",
      confidence: analysis["confidence"] ?? 50,
      targetPrice: analysis["targetPrice"] ?? currentPrice,
      targetPriceRange: analysis["targetPriceRange"] ?? {
        low: currentPrice ? currentPrice * 0.9 : 0,
        high: currentPrice ? currentPrice * 1.1 : 0,
      },
      timeHorizon: analysis["timeHorizon"] ?? "3-6 months",
      summary: analysis["summary"] ?? "Analysis not available.",
      sentiment: analysis["sentiment"] ?? "NEUTRAL",
      technicalSignals: analysis["technicalSignals"] ?? [],
      fundamentalSignals: analysis["fundamentalSignals"] ?? [],
      risks: analysis["risks"] ?? [],
      catalysts: analysis["catalysts"] ?? [],
      priceTargets: analysis["priceTargets"] ?? {
        bear: currentPrice ? currentPrice * 0.85 : 0,
        base: currentPrice ?? 0,
        bull: currentPrice ? currentPrice * 1.2 : 0,
      },
      entryStrategy: analysis["entryStrategy"] ?? defaultEntry,
      exitStrategy: analysis["exitStrategy"] ?? defaultExit,
      generatedAt: new Date().toISOString(),
    };

    if (strategy === "futures" && analysis["futuresSpecific"]) {
      result["futuresSpecific"] = analysis["futuresSpecific"];
    }
    if (strategy === "short" && analysis["shortSpecific"]) {
      result["shortSpecific"] = analysis["shortSpecific"];
    }

    res.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: "Failed to analyze stock" });
  }
});

async function fetchYahooTrending(): Promise<Record<string, unknown>[]> {
  try {
    const url = `${YAHOO_BASE}/v1/finance/trending/US?count=10`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, unknown>;
    const financeRes = (data["finance"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[] | undefined;
    if (!financeRes || financeRes.length === 0) return [];
    const quotes = financeRes[0]["quotes"] as Record<string, unknown>[] | undefined;
    return quotes ?? [];
  } catch {
    return [];
  }
}

async function fetchYahooScreener(scrId: string, count = 8): Promise<Record<string, unknown>[]> {
  try {
    const url = `${YAHOO_SCREENER_BASE}/v1/finance/screener/predefined/saved?formatted=false&scrIds=${scrId}&count=${count}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, unknown>;
    const financeRes = (data["finance"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[] | undefined;
    if (!financeRes || financeRes.length === 0) return [];
    const quotes = financeRes[0]["quotes"] as Record<string, unknown>[] | undefined;
    return quotes ?? [];
  } catch {
    return [];
  }
}

const singleQuoteCache = new Map<string, { data: Record<string, unknown>; ts: number }>();
const SINGLE_QUOTE_TTL = 60 * 1000;

async function fetchSingleQuoteViaChart(symbol: string): Promise<Record<string, unknown> | null> {
  const cached = singleQuoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < SINGLE_QUOTE_TTL) return cached.data;
  try {
    const data = await fetchYahooQuote(symbol);
    const chart = data as Record<string, unknown>;
    const result = (chart["chart"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[] | null;
    if (!result || result.length === 0) return null;
    const meta = result[0]["meta"] as Record<string, unknown>;
    const quote = {
      symbol: (meta["symbol"] as string) ?? symbol,
      longName: (meta["longName"] as string) ?? null,
      shortName: (meta["shortName"] as string) ?? null,
      regularMarketPrice: (meta["regularMarketPrice"] as number) ?? 0,
      regularMarketChange: ((meta["regularMarketPrice"] as number) ?? 0) - ((meta["chartPreviousClose"] as number) ?? (meta["regularMarketPrice"] as number) ?? 0),
      regularMarketChangePercent: (() => {
        const price = (meta["regularMarketPrice"] as number) ?? 0;
        const prev = (meta["chartPreviousClose"] as number) ?? price;
        return prev !== 0 ? ((price - prev) / prev) * 100 : 0;
      })(),
      regularMarketVolume: (meta["regularMarketVolume"] as number) ?? 0,
      regularMarketDayHigh: (meta["regularMarketDayHigh"] as number) || ((meta["regularMarketPrice"] as number) ?? 0),
      regularMarketDayLow: (meta["regularMarketDayLow"] as number) || ((meta["regularMarketPrice"] as number) ?? 0),
      regularMarketOpen: (meta["regularMarketOpen"] as number) || ((meta["regularMarketPrice"] as number) ?? 0),
      chartPreviousClose: (meta["chartPreviousClose"] as number) || ((meta["regularMarketPrice"] as number) ?? 0),
      marketCap: (meta["marketCap"] as number) ?? 0,
      quoteType: (meta["instrumentType"] as string) ?? ((symbol.includes("-USD") || symbol.includes("-BTC")) ? "CRYPTOCURRENCY" : "EQUITY"),
    };
    singleQuoteCache.set(symbol, { data: quote, ts: Date.now() });
    return quote;
  } catch {
    return null;
  }
}

async function fetchMultiQuote(symbols: string[]): Promise<Record<string, Record<string, unknown>>> {
  if (symbols.length === 0) return {};
  const batchSize = 22;
  const map: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((s) => fetchSingleQuoteViaChart(s)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) map[batch[j]] = results[j]!;
    }
  }
  return map;
}

interface IntradayTechnicals {
  symbol: string;
  vwap: number;
  support: number;
  resistance: number;
  relativeVolume: number;
  momentumScore: number;
  priceVsVwap: "above" | "below" | "at";
  intradayTrend: "strong_up" | "up" | "flat" | "down" | "strong_down";
  avgCandleRange: number;
  dayTradeScore: number;
}

async function fetchIntradayCandles(symbol: string): Promise<{ closes: number[]; highs: number[]; lows: number[]; volumes: number[]; opens: number[] } | null> {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const result = ((data["chart"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[]);
    if (!result || result.length === 0) return null;
    const indicators = (result[0]["indicators"] as Record<string, unknown>)?.["quote"] as Record<string, unknown>[];
    if (!indicators || indicators.length === 0) return null;
    const q = indicators[0];
    const closes = ((q["close"] as (number | null)[]) ?? []).filter((v): v is number => v !== null);
    const highs = ((q["high"] as (number | null)[]) ?? []).filter((v): v is number => v !== null);
    const lows = ((q["low"] as (number | null)[]) ?? []).filter((v): v is number => v !== null);
    const volumes = ((q["volume"] as (number | null)[]) ?? []).filter((v): v is number => v !== null);
    const opens = ((q["open"] as (number | null)[]) ?? []).filter((v): v is number => v !== null);
    if (closes.length < 3) return null;
    return { closes, highs, lows, volumes, opens };
  } catch {
    return null;
  }
}

function computeIntradayTechnicals(symbol: string, candles: { closes: number[]; highs: number[]; lows: number[]; volumes: number[]; opens: number[] }, ticker: { intradayRangePct: number; gapPct: number; changePercent: number; volume: number }): IntradayTechnicals {
  const { closes, highs, lows, volumes } = candles;
  const len = closes.length;

  let vwapNum = 0;
  let vwapDen = 0;
  for (let i = 0; i < Math.min(len, volumes.length); i++) {
    const typical = (highs[i] + lows[i] + closes[i]) / 3;
    vwapNum += typical * volumes[i];
    vwapDen += volumes[i];
  }
  const vwap = vwapDen > 0 ? vwapNum / vwapDen : closes[len - 1];

  const recentCount = Math.min(12, len);
  const recentHighs = highs.slice(-recentCount);
  const recentLows = lows.slice(-recentCount);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  const totalVol = volumes.reduce((s, v) => s + v, 0);
  const elapsedFraction = len / 78;
  const relativeVolume = elapsedFraction > 0 ? (totalVol / elapsedFraction) / (ticker.volume || totalVol) : 1;

  let momentum = 0;
  const lookback = Math.min(6, len);
  if (lookback >= 2) {
    const recent = closes.slice(-lookback);
    const oldAvg = (recent[0] + recent[1]) / 2;
    const newAvg = (recent[recent.length - 1] + recent[recent.length - 2]) / 2;
    momentum = oldAvg > 0 ? ((newAvg - oldAvg) / oldAvg) * 100 : 0;
  }
  const momentumScore = Math.round(Math.min(100, Math.max(-100, momentum * 20)));

  const currentPrice = closes[len - 1];
  const vwapDiff = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
  const priceVsVwap: "above" | "below" | "at" = vwapDiff > 0.15 ? "above" : vwapDiff < -0.15 ? "below" : "at";

  let intradayTrend: "strong_up" | "up" | "flat" | "down" | "strong_down" = "flat";
  const changeAbs = Math.abs(ticker.changePercent);
  if (ticker.changePercent > 2) intradayTrend = "strong_up";
  else if (ticker.changePercent > 0.5) intradayTrend = "up";
  else if (ticker.changePercent < -2) intradayTrend = "strong_down";
  else if (ticker.changePercent < -0.5) intradayTrend = "down";

  let avgCandleRange = 0;
  for (let i = 0; i < Math.min(len, highs.length, lows.length); i++) {
    avgCandleRange += (highs[i] - lows[i]) / (lows[i] || 1);
  }
  avgCandleRange = len > 0 ? (avgCandleRange / len) * 100 : 0;

  const dayTradeScore =
    (ticker.intradayRangePct * 25) +
    (Math.abs(ticker.gapPct) * 20) +
    (Math.min(relativeVolume, 3) * 15) +
    (changeAbs * 10) +
    (avgCandleRange * 5) +
    (Math.abs(momentumScore) / 100 * 10);

  return {
    symbol,
    vwap: Math.round(vwap * 100) / 100,
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    relativeVolume: Math.round(relativeVolume * 100) / 100,
    momentumScore,
    priceVsVwap,
    intradayTrend,
    avgCandleRange: Math.round(avgCandleRange * 100) / 100,
    dayTradeScore: Math.round(dayTradeScore * 100) / 100,
  };
}

interface DayTradePlaybook {
  setup: string;
  idealEntry: string;
  scaling: string;
  targetLevels: string[];
  stopPlacement: string;
  exitRules: string;
  positionSizing: string;
  redFlags: string[];
  technicals: {
    vwap: number;
    support: number;
    resistance: number;
    relativeVolume: number;
    momentumScore: number;
    priceVsVwap: string;
    intradayTrend: string;
  };
}

interface DiscoveredPick {
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
  profitStrategy: {
    action: string;
    entry: string;
    target: string;
    stopLoss: string;
    timeframe: string;
    rationale: string;
    expectedProfitPercent: number;
    riskRewardRatio: number;
  };
  dayTradePlaybook?: DayTradePlaybook;
}

const CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD"];

const TRENDING_STOCKS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "PLTR", "COIN"];
const VOLATILE_STOCKS = ["GME", "MARA", "RIOT", "SOFI", "SMCI", "ARM", "SOXL", "TQQQ", "UVXY", "LABU"];

let discoverCache: { data: unknown; timestamp: number } | null = null;
let discoverInFlight: Promise<unknown> | null = null;
const DISCOVER_CACHE_TTL = 8 * 60 * 1000;

const VALID_CATEGORIES = new Set(["trending", "gainers", "movers", "crypto", "ai_pick", "day_trade"]);
const VALID_SENTIMENTS = new Set(["BULLISH", "BEARISH", "NEUTRAL"]);
const VALID_ACTIONS = new Set(["BUY", "SELL", "SHORT", "HOLD", "WATCH"]);

async function generateDiscoverData() {
    const allSymbols = [...new Set([...TRENDING_STOCKS, ...VOLATILE_STOCKS, ...CRYPTO_SYMBOLS])];
    const quoteMap = await fetchMultiQuote(allSymbols);

    type TickerInfo = { symbol: string; name: string; price: number; change: number; changePercent: number; volume: number; marketCap: number; category: string; assetType: string; intradayRangePct: number; gapPct: number; dayHigh: number; dayLow: number };
    const tickers: TickerInfo[] = [];

    const buildTicker = (sym: string, cat: string): TickerInfo | null => {
      const q = quoteMap[sym];
      if (!q || !(q["regularMarketPrice"] as number)) return null;
      const price = (q["regularMarketPrice"] as number) ?? 0;
      const open = (q["regularMarketOpen"] as number) || price;
      const prevClose = (q["chartPreviousClose"] as number) || price;
      const dayHigh = (q["regularMarketDayHigh"] as number) || price;
      const dayLow = (q["regularMarketDayLow"] as number) || price;
      const intradayRangePct = open > 0 ? ((dayHigh - dayLow) / open) * 100 : 0;
      const gapPct = prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0;
      return {
        symbol: sym,
        name: (q["longName"] as string) ?? (q["shortName"] as string) ?? sym,
        price,
        change: (q["regularMarketChange"] as number) ?? 0,
        changePercent: (q["regularMarketChangePercent"] as number) ?? 0,
        volume: (q["regularMarketVolume"] as number) ?? 0,
        marketCap: (q["marketCap"] as number) ?? 0,
        category: cat,
        assetType: (q["quoteType"] as string) === "CRYPTOCURRENCY" ? "crypto" : "stock",
        intradayRangePct,
        gapPct,
        dayHigh,
        dayLow,
      };
    };

    for (const sym of TRENDING_STOCKS) {
      const t = buildTicker(sym, "trending");
      if (t) tickers.push(t);
    }
    for (const sym of VOLATILE_STOCKS) {
      if (tickers.some((t) => t.symbol === sym)) continue;
      const t = buildTicker(sym, "movers");
      if (t) tickers.push(t);
    }
    for (const sym of CRYPTO_SYMBOLS) {
      if (tickers.some((t) => t.symbol === sym)) continue;
      const t = buildTicker(sym, "crypto");
      if (t) { t.assetType = "crypto"; tickers.push(t); }
    }

    const sorted = [...tickers].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const topGainers = sorted.filter((t) => t.changePercent > 0).slice(0, 4);
    for (const g of topGainers) g.category = "gainers";

    const dayTradeCandidates = [...tickers]
      .sort((a, b) => {
        const scoreA = (a.intradayRangePct * 25) + (Math.abs(a.gapPct) * 20) + (Math.abs(a.changePercent) * 15);
        const scoreB = (b.intradayRangePct * 25) + (Math.abs(b.gapPct) * 20) + (Math.abs(b.changePercent) * 15);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    console.log("[Discover] Top day trade candidates:", dayTradeCandidates.map(t => `${t.symbol} (range:${t.intradayRangePct.toFixed(1)}%, gap:${t.gapPct.toFixed(1)}%)`).join(", "));

    const intradayResults = await Promise.all(
      dayTradeCandidates.map(async (t) => {
        const candles = await fetchIntradayCandles(t.symbol);
        if (!candles) return null;
        return computeIntradayTechnicals(t.symbol, candles, t);
      })
    );
    const techMap = new Map<string, IntradayTechnicals>();
    for (const tech of intradayResults) {
      if (tech) techMap.set(tech.symbol, tech);
    }

    const tickerSummary = tickers.map((t) =>
      `${t.symbol} (${t.name}): $${t.price.toFixed(2)}, ${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}%, vol ${(t.volume / 1e6).toFixed(1)}M, cap $${(t.marketCap / 1e9).toFixed(1)}B, intraday_range: ${t.intradayRangePct.toFixed(2)}%, gap_from_prev_close: ${t.gapPct >= 0 ? "+" : ""}${t.gapPct.toFixed(2)}%, day_high: $${t.dayHigh.toFixed(2)}, day_low: $${t.dayLow.toFixed(2)}, category: ${t.category}, type: ${t.assetType}`
    ).join("\n");

    const techSummary = dayTradeCandidates.map((t) => {
      const tech = techMap.get(t.symbol);
      if (!tech) return `${t.symbol}: no intraday data available`;
      return `${t.symbol}: VWAP=$${tech.vwap.toFixed(2)}, Support=$${tech.support.toFixed(2)}, Resistance=$${tech.resistance.toFixed(2)}, RelVolume=${tech.relativeVolume.toFixed(1)}x, Momentum=${tech.momentumScore}/100, PriceVsVWAP=${tech.priceVsVwap}, Trend=${tech.intradayTrend}, AvgCandleRange=${tech.avgCandleRange.toFixed(2)}%, DayTradeScore=${tech.dayTradeScore.toFixed(0)}`;
    }).join("\n");

    const prompt = `You are an elite quantitative day trader and market strategist. Analyze the following market data and intraday technical analysis to select the top 14 opportunities. You MUST include 2-3 DAY TRADE picks based on the algorithmic analysis below — these are intraday setups to be opened AND closed within today's session. For every day trade pick, provide an extremely detailed playbook that a trader can follow step-by-step.

MARKET DATA:
${tickerSummary}

INTRADAY TECHNICAL ANALYSIS (for top day trade candidates by algorithmic score):
${techSummary}

Respond with ONLY valid JSON (no markdown), in this exact format:
{
  "picks": [
    {
      "symbol": "<ticker>",
      "category": "trending" | "gainers" | "movers" | "crypto" | "ai_pick" | "day_trade",
      "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
      "signalSource": "<1-line description of the signal>",
      "aiSummary": "<2-3 sentence insight>",
      "profitStrategy": {
        "action": "BUY" | "SELL" | "SHORT" | "HOLD" | "WATCH",
        "entry": "<specific entry price or condition>",
        "target": "<specific profit target price>",
        "stopLoss": "<specific stop loss price>",
        "timeframe": "<holding period. For day_trade: 'Intraday — close by EOD'. For swings: e.g. '2-4 weeks'>",
        "rationale": "<1-2 sentence reasoning>",
        "expectedProfitPercent": <number>,
        "riskRewardRatio": <number>
      },
      "dayTradePlaybook": {
        "setup": "<precise trade setup description, e.g. 'VWAP reclaim + gap-up momentum' or 'Breakdown below intraday support with heavy volume'>",
        "idealEntry": "<exact trigger, e.g. 'Enter LONG on first 5-min candle close above VWAP ($XXX.XX) with volume spike' or 'Enter SHORT on break below $XXX.XX support'>",
        "scaling": "<how to scale in/out, e.g. 'Enter 50% at VWAP touch, add remaining 50% on first green 5-min candle above entry'>",
        "targetLevels": ["$XXX.XX (intraday resistance)", "$XXX.XX (pre-market high / extended target)"],
        "stopPlacement": "<exact stop with reasoning, e.g. 'Hard stop at $XXX.XX — below VWAP and intraday support. This is a $X.XX risk per share.'>",
        "exitRules": "<step-by-step exit plan: 'Take 50% profit at Target 1. Move stop to breakeven. Trail remaining with 5-min candle lows. Close ALL by 3:45 PM ET regardless.'>",
        "positionSizing": "<risk-based sizing, e.g. 'Risk 1% of $100K account = $1,000 max loss. Entry $XXX.XX to stop $XXX.XX = $X.XX risk/share → max XX shares.'>",
        "redFlags": ["<condition that invalidates this trade, e.g. 'If SPY breaks below $XXX, all longs off'>", "<another red flag>"]
      }
    }
  ],
  "marketMood": "<1-2 sentence overall market assessment>",
  "topHeadlineThemes": ["<theme 1>", "<theme 2>", "<theme 3>"]
}

CRITICAL RULES:
- ALWAYS include exactly 2-3 picks with category "day_trade" — ONLY from the symbols in the INTRADAY TECHNICAL ANALYSIS section. Pick the ones with highest DayTradeScore
- dayTradePlaybook is REQUIRED for day_trade picks (omit it for non day_trade picks)
- For day_trade picks: use the computed VWAP, support, resistance from the technical data as the basis for entry/target/stop levels. NEVER make up random price levels — anchor to the real computed technicals
- day_trade timeframe must be "Intraday — close by EOD"
- Position sizing should assume a $100K paper trading account
- Select a MIX of stocks AND crypto (at least 2-3 crypto picks) for non day_trade categories
- Be specific with prices — use actual numbers from the data
- Include at least one bearish/short opportunity if data supports it
- signalSource should be SHORT — just the key signal in a few words
- aiSummary should be INSIGHTFUL — not just restating the price change`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a professional market strategist. Respond only with valid JSON, no markdown formatting." },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const content = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let aiResult: Record<string, unknown>;
    try {
      aiResult = JSON.parse(content) as Record<string, unknown>;
    } catch {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        aiResult = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {};
      } catch {
        console.error("Failed to parse discover AI response, using fallback");
        aiResult = { picks: [] };
      }
    }

    const knownSymbols = new Set(tickers.map((t) => t.symbol));

    const aiPicks = (aiResult["picks"] as Record<string, unknown>[]) ?? [];
    const discoveries: DiscoveredPick[] = aiPicks
      .filter((pick) => knownSymbols.has(pick["symbol"] as string))
      .map((pick) => {
        const sym = pick["symbol"] as string;
        const tickerData = tickers.find((t) => t.symbol === sym)!;
        const profitStrat = (pick["profitStrategy"] as Record<string, string>) ?? {};
        const rawCategory = pick["category"] as string;
        const rawSentiment = pick["sentiment"] as string;
        const rawAction = profitStrat["action"] as string;
        const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : tickerData.category;

        const result: DiscoveredPick = {
          symbol: sym,
          name: tickerData.name,
          price: tickerData.price,
          change: tickerData.change,
          changePercent: tickerData.changePercent,
          category,
          assetType: tickerData.assetType,
          sentiment: VALID_SENTIMENTS.has(rawSentiment) ? rawSentiment : "NEUTRAL",
          signalSource: (pick["signalSource"] as string) ?? "",
          aiSummary: (pick["aiSummary"] as string) ?? "",
          profitStrategy: {
            action: VALID_ACTIONS.has(rawAction) ? rawAction : "WATCH",
            entry: profitStrat["entry"] ?? "",
            target: profitStrat["target"] ?? "",
            stopLoss: profitStrat["stopLoss"] ?? "",
            timeframe: profitStrat["timeframe"] ?? "",
            rationale: profitStrat["rationale"] ?? "",
            expectedProfitPercent: parseFloat(String(profitStrat["expectedProfitPercent"] ?? "0")) || 0,
            riskRewardRatio: parseFloat(String(profitStrat["riskRewardRatio"] ?? "0")) || 0,
          },
        };

        if (category === "day_trade") {
          const aiPlaybook = (pick["dayTradePlaybook"] as Record<string, unknown>) ?? {};
          const tech = techMap.get(sym);
          result.dayTradePlaybook = {
            setup: (aiPlaybook["setup"] as string) ?? "Intraday momentum trade",
            idealEntry: (aiPlaybook["idealEntry"] as string) ?? "",
            scaling: (aiPlaybook["scaling"] as string) ?? "Enter full position at trigger",
            targetLevels: (aiPlaybook["targetLevels"] as string[]) ?? [],
            stopPlacement: (aiPlaybook["stopPlacement"] as string) ?? "",
            exitRules: (aiPlaybook["exitRules"] as string) ?? "Close all positions by 3:45 PM ET.",
            positionSizing: (aiPlaybook["positionSizing"] as string) ?? "",
            redFlags: (aiPlaybook["redFlags"] as string[]) ?? [],
            technicals: {
              vwap: tech?.vwap ?? 0,
              support: tech?.support ?? 0,
              resistance: tech?.resistance ?? 0,
              relativeVolume: tech?.relativeVolume ?? 1,
              momentumScore: tech?.momentumScore ?? 0,
              priceVsVwap: tech?.priceVsVwap ?? "at",
              intradayTrend: tech?.intradayTrend ?? "flat",
            },
          };
        }

        return result;
      });

    if (discoveries.length === 0) {
      const fallbackPicks = sorted.slice(0, 8).map((t) => ({
        symbol: t.symbol,
        name: t.name,
        price: t.price,
        change: t.change,
        changePercent: t.changePercent,
        category: t.category,
        assetType: t.assetType,
        sentiment: t.changePercent > 1 ? "BULLISH" : t.changePercent < -1 ? "BEARISH" : "NEUTRAL" as string,
        signalSource: `${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}% today`,
        aiSummary: "AI analysis unavailable. Check back shortly.",
        profitStrategy: {
          action: "WATCH" as string,
          entry: `$${t.price.toFixed(2)}`,
          target: `$${(t.price * 1.05).toFixed(2)}`,
          stopLoss: `$${(t.price * 0.95).toFixed(2)}`,
          timeframe: "Monitor",
          rationale: "Awaiting full AI analysis.",
          expectedProfitPercent: 5,
          riskRewardRatio: 1.0,
        },
      }));
      discoveries.push(...fallbackPicks);
    }

    return {
      discoveries,
      marketMood: (aiResult["marketMood"] as string) ?? "Market data available. AI analysis processing.",
      topHeadlineThemes: (aiResult["topHeadlineThemes"] as string[]) ?? [],
      generatedAt: new Date().toISOString(),
    };
}

router.get("/stocks/discover", async (_req, res) => {
  try {
    if (discoverCache && Date.now() - discoverCache.timestamp < DISCOVER_CACHE_TTL) {
      res.json(discoverCache.data);
      return;
    }

    if (!discoverInFlight) {
      discoverInFlight = generateDiscoverData()
        .then((data) => {
          discoverCache = { data, timestamp: Date.now() };
          discoverInFlight = null;
          return data;
        })
        .catch((err) => {
          discoverInFlight = null;
          throw err;
        });
    }

    const data = await discoverInFlight;
    res.json(data);
  } catch (err) {
    console.error("Discover error:", err);
    if (discoverCache) {
      res.json(discoverCache.data);
    } else {
      res.status(500).json({ error: "Failed to discover stocks" });
    }
  }
});

setTimeout(() => {
  if (discoverCache) return;
  console.log("[Discover] Warming cache on startup...");
  generateDiscoverData()
    .then((data) => {
      discoverCache = { data, timestamp: Date.now() };
      console.log("[Discover] Cache warmed — ready for instant responses");
    })
    .catch((err) => console.error("[Discover] Startup warm failed:", err));
}, 3000);

export default router;

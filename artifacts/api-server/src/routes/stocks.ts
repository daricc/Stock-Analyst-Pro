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
}

const CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD"];

const TRENDING_STOCKS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "PLTR", "COIN"];
const VOLATILE_STOCKS = ["GME", "MARA", "RIOT", "SOFI"];

let discoverCache: { data: unknown; timestamp: number } | null = null;
let discoverInFlight: Promise<unknown> | null = null;
const DISCOVER_CACHE_TTL = 8 * 60 * 1000;

const VALID_CATEGORIES = new Set(["trending", "gainers", "movers", "crypto", "ai_pick"]);
const VALID_SENTIMENTS = new Set(["BULLISH", "BEARISH", "NEUTRAL"]);
const VALID_ACTIONS = new Set(["BUY", "SELL", "SHORT", "HOLD", "WATCH"]);

async function generateDiscoverData() {
    const allSymbols = [...new Set([...TRENDING_STOCKS, ...VOLATILE_STOCKS, ...CRYPTO_SYMBOLS])];
    const quoteMap = await fetchMultiQuote(allSymbols);

    type TickerInfo = { symbol: string; name: string; price: number; change: number; changePercent: number; volume: number; marketCap: number; category: string; assetType: string };
    const tickers: TickerInfo[] = [];

    const buildTicker = (sym: string, cat: string): TickerInfo | null => {
      const q = quoteMap[sym];
      if (!q || !(q["regularMarketPrice"] as number)) return null;
      return {
        symbol: sym,
        name: (q["longName"] as string) ?? (q["shortName"] as string) ?? sym,
        price: (q["regularMarketPrice"] as number) ?? 0,
        change: (q["regularMarketChange"] as number) ?? 0,
        changePercent: (q["regularMarketChangePercent"] as number) ?? 0,
        volume: (q["regularMarketVolume"] as number) ?? 0,
        marketCap: (q["marketCap"] as number) ?? 0,
        category: cat,
        assetType: (q["quoteType"] as string) === "CRYPTOCURRENCY" ? "crypto" : "stock",
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

    const tickerSummary = tickers.map((t) =>
      `${t.symbol} (${t.name}): $${t.price.toFixed(2)}, ${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}%, vol ${(t.volume / 1e6).toFixed(1)}M, cap $${(t.marketCap / 1e9).toFixed(1)}B, category: ${t.category}, type: ${t.assetType}`
    ).join("\n");

    const prompt = `You are an elite market strategist and stock/crypto analyst. Analyze the following market data — trending tickers, biggest movers, and crypto — and select the top 12 most interesting opportunities. For each pick, provide a sentiment assessment, a concise AI insight explaining WHY this is notable right now, and a concrete PROFIT STRATEGY telling the user exactly how to trade it.

MARKET DATA:
${tickerSummary}

Respond with ONLY valid JSON (no markdown), in this exact format:
{
  "picks": [
    {
      "symbol": "<ticker>",
      "category": "trending" | "gainers" | "movers" | "crypto" | "ai_pick",
      "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
      "signalSource": "<1-line description of the signal, e.g. 'Top gainer +8.5% on heavy volume' or 'Breaking above 50-day MA'>",
      "aiSummary": "<2-3 sentence insight about why this stock/crypto is interesting right now, mentioning catalysts, news themes, or technical patterns>",
      "profitStrategy": {
        "action": "BUY" | "SELL" | "SHORT" | "HOLD" | "WATCH",
        "entry": "<specific entry price or condition, e.g. '$185.50 on pullback to support' or 'At market open'>",
        "target": "<specific profit target price, e.g. '$205.00'>",
        "stopLoss": "<specific stop loss price, e.g. '$175.00'>",
        "timeframe": "<holding period, e.g. '2-4 weeks' or 'Swing trade 3-5 days'>",
        "rationale": "<1-2 sentence reasoning for this strategy>",
        "expectedProfitPercent": <positive number representing expected profit %, e.g. 10.5 for a 10.5% gain. For SHORT/SELL actions, this is the expected downside capture %>,
        "riskRewardRatio": <number like 2.1 representing risk/reward, e.g. 2.1 means you risk 1 to make 2.1>
      }
    }
  ],
  "marketMood": "<1-2 sentence overall market assessment>",
  "topHeadlineThemes": ["<theme 1>", "<theme 2>", "<theme 3>"]
}

RULES:
- Select a MIX of stocks AND crypto (at least 2-3 crypto picks)
- Rank by how actionable and interesting each pick is
- Be specific with prices — use actual numbers from the data
- Each profit strategy must include concrete entry, target, and stop-loss levels
- Include at least one bearish/short opportunity if data supports it
- signalSource should be SHORT — just the key signal in a few words
- aiSummary should be INSIGHTFUL — not just restating the price change`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4000,
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
        return {
          symbol: sym,
          name: tickerData.name,
          price: tickerData.price,
          change: tickerData.change,
          changePercent: tickerData.changePercent,
          category: VALID_CATEGORIES.has(rawCategory) ? rawCategory : tickerData.category,
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

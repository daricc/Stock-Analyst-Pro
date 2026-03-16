import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const YAHOO_BASE = "https://query1.finance.yahoo.com";

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
    const data = await fetchYahooQuote(symbol.toUpperCase());
    const chart = data as Record<string, unknown>;
    const result = (chart["chart"] as Record<string, unknown>)?.["result"] as Record<string, unknown>[] | null;

    if (!result || result.length === 0) {
      res.status(404).json({ error: "Stock not found" });
      return;
    }

    const stockData = result[0];
    const meta = stockData["meta"] as Record<string, unknown>;
    const quote = meta;

    const currentPrice = (quote["regularMarketPrice"] as number) ?? 0;
    const prevClose = (quote["chartPreviousClose"] as number) ?? (quote["regularMarketPreviousClose"] as number) ?? currentPrice;
    const change = currentPrice - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    res.json({
      symbol: (quote["symbol"] as string) ?? symbol.toUpperCase(),
      name: (quote["longName"] as string) ?? (quote["shortName"] as string) ?? symbol.toUpperCase(),
      price: currentPrice,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      open: (quote["regularMarketOpen"] as number) ?? currentPrice,
      high: (quote["regularMarketDayHigh"] as number) ?? currentPrice,
      low: (quote["regularMarketDayLow"] as number) ?? currentPrice,
      volume: (quote["regularMarketVolume"] as number) ?? 0,
      marketCap: (quote["marketCap"] as number) ?? 0,
      pe: null,
      week52High: (quote["fiftyTwoWeekHigh"] as number) ?? currentPrice,
      week52Low: (quote["fiftyTwoWeekLow"] as number) ?? currentPrice,
      currency: (quote["currency"] as string) ?? "USD",
      exchange: (quote["exchangeName"] as string) ?? (quote["fullExchangeName"] as string) ?? "Unknown",
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
      .filter((q: Record<string, unknown>) => q["quoteType"] === "EQUITY" || q["quoteType"] === "ETF")
      .slice(0, 6)
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

router.post("/stocks/analyze", async (req, res) => {
  const { symbol, quote, history } = req.body as {
    symbol: string;
    quote?: Record<string, unknown>;
    history?: Record<string, unknown>;
  };

  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

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

    const prompt = `You are a professional stock analyst with expertise in technical and fundamental analysis. Analyze the following stock data and provide a detailed investment recommendation.

Stock: ${name} (${symbol})
${currentPrice ? `Current Price: $${currentPrice}` : ""}
${changePercent !== null ? `Today's Change: ${changePercent > 0 ? "+" : ""}${changePercent?.toFixed(2)}%` : ""}
${high52 ? `52-Week High: $${high52}` : ""}
${low52 ? `52-Week Low: $${low52}` : ""}
${marketCap ? `Market Cap: $${(marketCap / 1e9).toFixed(2)}B` : ""}
${volume ? `Volume: ${(volume / 1e6).toFixed(2)}M` : ""}
${priceChange30d !== null ? `30-Day Price Change: ${priceChange30d.toFixed(2)}%` : ""}
${recentPrices.length > 0 ? `Recent 30-day price trend: ${recentPrices.slice(0, 5).map((p) => `$${p.toFixed(2)}`).join(", ")}...${recentPrices.slice(-5).map((p) => `$${p.toFixed(2)}`).join(", ")}` : ""}

Provide a comprehensive stock analysis in the following JSON format exactly (no markdown, just raw JSON):
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": <0-100 number>,
  "targetPrice": <number>,
  "targetPriceRange": { "low": <number>, "high": <number> },
  "timeHorizon": "3-6 months",
  "summary": "<2-3 sentence investment thesis>",
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
  "priceTargets": { "bear": <number>, "base": <number>, "bull": <number> }
}

Be specific and data-driven. Base your analysis on the provided data. Provide realistic price targets based on the current price.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2000,
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

    res.json({
      symbol: symbol.toUpperCase(),
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
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: "Failed to analyze stock" });
  }
});

export default router;

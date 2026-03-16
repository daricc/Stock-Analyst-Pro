import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@paper_portfolio_v1";
const STARTING_BALANCE = 100_000;

export type Direction = "long" | "short";
export type TradeAction = "buy" | "sell" | "short" | "cover";

export interface Position {
  symbol: string;
  name: string;
  direction: Direction;
  shares: number;
  avgCost: number;
  openedAt: number;
  assetType: "stock" | "crypto";
}

export interface Transaction {
  id: string;
  symbol: string;
  name: string;
  action: TradeAction;
  shares: number;
  price: number;
  total: number;
  timestamp: number;
  realizedPnl?: number;
}

export interface Portfolio {
  cash: number;
  startingBalance: number;
  positions: Record<string, Position>;
  transactions: Transaction[];
}

interface PortfolioContextType {
  portfolio: Portfolio;
  loaded: boolean;
  executeTrade: (
    symbol: string,
    name: string,
    action: TradeAction,
    shares: number,
    price: number,
    assetType: "stock" | "crypto"
  ) => Promise<{ success: boolean; message: string }>;
  resetPortfolio: () => Promise<void>;
}

const DEFAULT_PORTFOLIO: Portfolio = {
  cash: STARTING_BALANCE,
  startingBalance: STARTING_BALANCE,
  positions: {},
  transactions: [],
};

const PortfolioContext = createContext<PortfolioContextType | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(DEFAULT_PORTFOLIO);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setPortfolio(JSON.parse(data) as Portfolio);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const save = useCallback(async (p: Portfolio) => {
    setPortfolio(p);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const executeTrade = useCallback(
    async (
      symbol: string,
      name: string,
      action: TradeAction,
      shares: number,
      price: number,
      assetType: "stock" | "crypto"
    ): Promise<{ success: boolean; message: string }> => {
      if (shares <= 0) return { success: false, message: "Invalid quantity" };
      const cost = shares * price;
      const p: Portfolio = {
        ...portfolio,
        positions: { ...portfolio.positions },
        transactions: [...portfolio.transactions],
      };

      let realizedPnl: number | undefined;

      if (action === "buy") {
        if (cost > p.cash) return { success: false, message: "Insufficient funds" };
        const existing = p.positions[symbol];
        if (existing?.direction === "short")
          return { success: false, message: "You have a short position. Cover it first." };
        if (existing?.direction === "long") {
          const totalShares = existing.shares + shares;
          const avgCost = (existing.avgCost * existing.shares + price * shares) / totalShares;
          p.positions[symbol] = { ...existing, shares: totalShares, avgCost };
        } else {
          p.positions[symbol] = {
            symbol, name, direction: "long", shares, avgCost: price,
            openedAt: Date.now(), assetType,
          };
        }
        p.cash -= cost;
      } else if (action === "sell") {
        const existing = p.positions[symbol];
        if (!existing || existing.direction !== "long")
          return { success: false, message: "No long position to sell" };
        if (shares > existing.shares)
          return { success: false, message: `You only have ${existing.shares.toFixed(4)} shares` };
        realizedPnl = (price - existing.avgCost) * shares;
        if (Math.abs(shares - existing.shares) < 0.00001) {
          delete p.positions[symbol];
        } else {
          p.positions[symbol] = { ...existing, shares: existing.shares - shares };
        }
        p.cash += cost;
      } else if (action === "short") {
        if (cost > p.cash)
          return { success: false, message: "Insufficient margin for short position" };
        const existing = p.positions[symbol];
        if (existing?.direction === "long")
          return { success: false, message: "You have a long position. Sell it first." };
        if (existing?.direction === "short") {
          const totalShares = existing.shares + shares;
          const avgCost = (existing.avgCost * existing.shares + price * shares) / totalShares;
          p.positions[symbol] = { ...existing, shares: totalShares, avgCost };
        } else {
          p.positions[symbol] = {
            symbol, name, direction: "short", shares, avgCost: price,
            openedAt: Date.now(), assetType,
          };
        }
        p.cash -= cost;
      } else if (action === "cover") {
        const existing = p.positions[symbol];
        if (!existing || existing.direction !== "short")
          return { success: false, message: "No short position to cover" };
        if (shares > existing.shares)
          return { success: false, message: `You only shorted ${existing.shares.toFixed(4)} shares` };
        realizedPnl = (existing.avgCost - price) * shares;
        const marginReturn = existing.avgCost * shares;
        if (Math.abs(shares - existing.shares) < 0.00001) {
          delete p.positions[symbol];
        } else {
          p.positions[symbol] = { ...existing, shares: existing.shares - shares };
        }
        p.cash += marginReturn + realizedPnl;
      }

      const tx: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol, name, action, shares, price, total: cost,
        timestamp: Date.now(),
        realizedPnl,
      };
      p.transactions = [tx, ...p.transactions].slice(0, 200);
      await save(p);
      return { success: true, message: "Trade executed!" };
    },
    [portfolio, save]
  );

  const resetPortfolio = useCallback(async () => {
    await save({ ...DEFAULT_PORTFOLIO });
  }, [save]);

  return (
    <PortfolioContext.Provider value={{ portfolio, loaded, executeTrade, resetPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}

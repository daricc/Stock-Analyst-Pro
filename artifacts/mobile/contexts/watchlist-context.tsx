import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
}

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const STORAGE_KEY = "@stock_watchlist";

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setWatchlist(JSON.parse(data) as WatchlistItem[]);
        } catch {}
      }
    });
  }, []);

  const save = (items: WatchlistItem[]) => {
    setWatchlist(items);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const addToWatchlist = (item: WatchlistItem) => {
    save([...watchlist.filter((w) => w.symbol !== item.symbol), item]);
  };

  const removeFromWatchlist = (symbol: string) => {
    save(watchlist.filter((w) => w.symbol !== symbol));
  };

  const isInWatchlist = (symbol: string) => {
    return watchlist.some((w) => w.symbol === symbol);
  };

  return (
    <WatchlistContext.Provider
      value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}

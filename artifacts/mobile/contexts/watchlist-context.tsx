import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

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

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const { isAuthenticated, token } = useAuth();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const localData = await AsyncStorage.getItem(STORAGE_KEY);
      let localWatchlist: WatchlistItem[] | null = null;
      if (localData) {
        try { localWatchlist = JSON.parse(localData) as WatchlistItem[]; } catch {}
      }

      if (isAuthenticated && token) {
        try {
          const apiBase = getApiBaseUrl();
          const res = await fetch(`${apiBase}/api/user-data/watchlist`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.watchlist) {
            setWatchlist(data.watchlist as WatchlistItem[]);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data.watchlist));
            return;
          }
          if (localWatchlist && localWatchlist.length > 0) {
            setWatchlist(localWatchlist);
            try {
              await fetch(`${apiBase}/api/user-data/watchlist`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ watchlist: localWatchlist }),
              });
            } catch {}
            return;
          }
        } catch {}
      }
      if (localWatchlist) {
        setWatchlist(localWatchlist);
      }
    })();
  }, [isAuthenticated, token]);

  const syncToServer = useCallback(async (items: WatchlistItem[]) => {
    if (!isAuthenticated || !token) return;
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/user-data/watchlist`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ watchlist: items }),
      });
    } catch {}
  }, [isAuthenticated, token]);

  const save = useCallback((items: WatchlistItem[]) => {
    setWatchlist(items);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => syncToServer(items), 2000);
  }, [syncToServer]);

  const addToWatchlist = useCallback((item: WatchlistItem) => {
    setWatchlist(prev => {
      const updated = [...prev.filter((w) => w.symbol !== item.symbol), item];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => syncToServer(updated), 2000);
      return updated;
    });
  }, [syncToServer]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const updated = prev.filter((w) => w.symbol !== symbol);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => syncToServer(updated), 2000);
      return updated;
    });
  }, [syncToServer]);

  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist.some((w) => w.symbol === symbol);
  }, [watchlist]);

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

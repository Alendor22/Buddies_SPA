'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type MapboxConfigState = {
  token: string;
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const MapboxConfigContext = createContext<MapboxConfigState | null>(null);

export function MapboxProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/maps/config?ts=${Date.now()}`, { cache: 'no-store' });
      const payload = await response.json() as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        setToken('');
        setError(payload.error || 'Map configuration is unavailable.');
        return;
      }
      setToken(payload.token);
    } catch {
      setToken('');
      setError('Map configuration could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<MapboxConfigState>(() => ({
    token,
    ready: Boolean(token),
    loading,
    error,
    refresh
  }), [error, loading, refresh, token]);

  return <MapboxConfigContext.Provider value={value}>{children}</MapboxConfigContext.Provider>;
}

export function useMapboxConfig() {
  const context = useContext(MapboxConfigContext);
  if (!context) throw new Error('useMapboxConfig must be used inside MapboxProvider');
  return context;
}

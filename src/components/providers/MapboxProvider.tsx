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

export function MapboxProvider({ children, initialToken = '' }: { children: ReactNode; initialToken?: string }) {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(!initialToken);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/maps/config?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('Map configuration service returned an unexpected response.');
      }
      const payload = await response.json() as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        setError(payload.error || 'Map configuration is unavailable.');
        return;
      }
      setToken(payload.token);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Map configuration could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialToken) void refresh();
  }, [initialToken, refresh]);

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

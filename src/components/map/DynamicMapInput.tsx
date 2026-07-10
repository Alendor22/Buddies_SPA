'use client';

import { useEffect, useMemo, useState } from 'react';

export type MapMenu = 'route' | 'radar' | 'reports' | 'route-memory' | 'walk-details';

export type DynamicMapAction = {
  menu: MapMenu;
  value: string;
};

type Props = {
  activeMenu: MapMenu;
  onSubmit: (action: DynamicMapAction) => void | Promise<void>;
};

type HistoryState = Record<MapMenu, string[]>;

const HISTORY_KEY = 'buddies-map-input-history-v1';
const EMPTY_HISTORY: HistoryState = {
  route: [],
  radar: [],
  reports: [],
  'route-memory': [],
  'walk-details': []
};

const CONFIG: Record<MapMenu, { placeholder: string; submitLabel: string }> = {
  route: { placeholder: 'Address, landmark, route name, or route command', submitLabel: 'Search route' },
  radar: { placeholder: 'Dog name, breed, DogID, or neighborhood', submitLabel: 'Search dog radar' },
  reports: { placeholder: 'Search or describe a neighborhood report', submitLabel: 'Search reports' },
  'route-memory': { placeholder: 'Route name, dog, or neighborhood', submitLabel: 'Search route memory' },
  'walk-details': { placeholder: 'Dog, start time, duration, or walk notes', submitLabel: 'Apply walk details' }
};

function readHistory(): HistoryState {
  if (typeof window === 'undefined') return EMPTY_HISTORY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '{}') as Partial<HistoryState>;
    return {
      route: parsed.route ?? [],
      radar: parsed.radar ?? [],
      reports: parsed.reports ?? [],
      'route-memory': parsed['route-memory'] ?? [],
      'walk-details': parsed['walk-details'] ?? []
    };
  } catch {
    return EMPTY_HISTORY;
  }
}

export default function DynamicMapInput({ activeMenu, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const config = CONFIG[activeMenu];
  const currentHistory = useMemo(() => history[activeMenu], [activeMenu, history]);

  useEffect(() => setHistory(readHistory()), []);
  useEffect(() => {
    setValue('');
    setHistoryOpen(false);
  }, [activeMenu]);

  function persist(next: HistoryState) {
    setHistory(next);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await onSubmit({ menu: activeMenu, value: trimmed });
      const nextEntries = [trimmed, ...history[activeMenu].filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, 15);
      persist({ ...history, [activeMenu]: nextEntries });
      setHistoryOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-5 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-2xl px-3">
      {historyOpen ? (
        <div className="mb-2 max-h-52 overflow-auto rounded-2xl border border-white/40 bg-slate-950/50 p-2 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
            <span>{activeMenu.replace('-', ' ')} history</span>
            <button type="button" onClick={() => persist({ ...history, [activeMenu]: [] })} className="rounded px-2 py-1 hover:bg-white/10">Clear</button>
          </div>
          {currentHistory.length ? currentHistory.map((entry) => (
            <button key={entry} type="button" onClick={() => { setValue(entry); setHistoryOpen(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10">{entry}</button>
          )) : <p className="px-3 py-4 text-sm text-white/60">No entries for this menu.</p>}
        </div>
      ) : null}

      <div className="flex h-14 items-center overflow-hidden rounded-2xl border border-white/50 bg-slate-950/50 text-white shadow-2xl backdrop-blur-xl">
        <button type="button" aria-label="Show typed-entry history" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)} className="grid h-full w-14 shrink-0 place-items-center border-r border-white/20 text-xl hover:bg-white/10">↶</button>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }}
          placeholder={config.placeholder}
          aria-label={config.placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/60"
        />
        <button type="button" aria-label={config.submitLabel} title={config.submitLabel} disabled={!value.trim() || loading} onClick={() => void submit()} className="grid h-full w-14 shrink-0 place-items-center border-l border-white/20 text-xl hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{loading ? '…' : '⌕'}</button>
      </div>
    </div>
  );
}

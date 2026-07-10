'use client';

import { useState, type ReactNode } from 'react';
import DynamicMapInput, { type DynamicMapAction, type MapMenu } from './DynamicMapInput';

type Props = {
  children: ReactNode;
  panels: Partial<Record<MapMenu, ReactNode>>;
  onCommand: (action: DynamicMapAction) => void | Promise<void>;
};

const MENU_ITEMS: Array<{ id: MapMenu; label: string; icon: string; side: 'left' | 'right' }> = [
  { id: 'route', label: 'Route planner', icon: '↗', side: 'left' },
  { id: 'radar', label: 'Dog radar', icon: '◉', side: 'right' },
  { id: 'reports', label: 'Reports', icon: '!', side: 'right' },
  { id: 'route-memory', label: 'Route memory', icon: '⌁', side: 'left' },
  { id: 'walk-details', label: 'Walk details', icon: '＋', side: 'left' }
];

export default function UnifiedMapShell({ children, panels, onCommand }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MapMenu>('route');
  const [panelOpen, setPanelOpen] = useState(false);
  const item = MENU_ITEMS.find((entry) => entry.id === activeMenu) ?? MENU_ITEMS[0];

  function selectMenu(menu: MapMenu) {
    setActiveMenu(menu);
    setPanelOpen(true);
    setMenuOpen(false);
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
    if (!menuOpen) setPanelOpen(false);
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-slate-950">
      <div className="absolute inset-0">{children}</div>

      <div className="pointer-events-auto absolute left-4 top-4 z-50">
        <button
          type="button"
          aria-label={menuOpen ? 'Close map overlay menu' : 'Open map overlay menu'}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className="grid h-14 w-14 place-items-center rounded-full border border-white/50 bg-slate-950/50 text-2xl text-white shadow-2xl backdrop-blur-xl transition active:scale-95"
        >
          {menuOpen ? '×' : '☰'}
        </button>

        {menuOpen ? (
          <div className="absolute left-0 top-16 grid gap-2 rounded-3xl border border-white/40 bg-slate-950/50 p-2 text-white shadow-2xl backdrop-blur-xl">
            {MENU_ITEMS.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectMenu(entry.id)}
                className={`flex min-w-48 items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${entry.id === activeMenu ? 'bg-white/25' : 'bg-white/5 hover:bg-white/15'}`}
                style={{ transform: `translateY(${index * 0}px)` }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-base font-bold">{entry.icon}</span>
                <span>{entry.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {panelOpen && panels[activeMenu] ? (
        <aside className={`pointer-events-auto absolute top-20 z-40 max-h-[calc(100dvh-11rem)] w-[min(88vw,24rem)] overflow-auto rounded-3xl border border-white/40 bg-slate-950/50 p-4 text-white shadow-2xl backdrop-blur-xl ${item.side === 'left' ? 'left-4' : 'right-4'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{item.label}</h2>
            <button
              type="button"
              aria-label={`Close ${item.label}`}
              onClick={() => setPanelOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:bg-white/10"
            >
              ×
            </button>
          </div>
          {panels[activeMenu]}
        </aside>
      ) : null}

      <DynamicMapInput activeMenu={activeMenu} onSubmit={onCommand} />
    </main>
  );
}

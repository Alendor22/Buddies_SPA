'use client';

import { useState, type ReactNode } from 'react';
import DynamicMapInput, { type DynamicMapAction, type MapMenu } from './DynamicMapInput';

type Props = {
  children: ReactNode;
  panels: Partial<Record<MapMenu, ReactNode>>;
  onCommand: (action: DynamicMapAction) => void | Promise<void>;
};

const MENU_ITEMS: Array<{ id: MapMenu; label: string; side: 'left' | 'right' }> = [
  { id: 'route', label: 'Route planner', side: 'left' },
  { id: 'radar', label: 'Dog radar', side: 'right' },
  { id: 'reports', label: 'Reports', side: 'right' },
  { id: 'route-memory', label: 'Route memory', side: 'left' },
  { id: 'walk-details', label: 'Walk details', side: 'left' }
];

export default function UnifiedMapShell({ children, panels, onCommand }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MapMenu>('route');
  const [panelOpen, setPanelOpen] = useState(true);
  const item = MENU_ITEMS.find((entry) => entry.id === activeMenu) ?? MENU_ITEMS[0];

  function selectMenu(menu: MapMenu) {
    setActiveMenu(menu);
    setPanelOpen(true);
    setMenuOpen(false);
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-slate-950">
      <div className="absolute inset-0">{children}</div>

      <div className="pointer-events-auto absolute left-4 top-4 z-40">
        <button type="button" aria-label="Open map menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/50 bg-slate-950/50 text-xl text-white shadow-xl backdrop-blur-xl">☰</button>
        {menuOpen ? (
          <div className="mt-2 w-52 rounded-2xl border border-white/40 bg-slate-950/50 p-2 text-white shadow-2xl backdrop-blur-xl">
            {MENU_ITEMS.map((entry) => (
              <button key={entry.id} type="button" onClick={() => selectMenu(entry.id)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${entry.id === activeMenu ? 'bg-white/20' : 'hover:bg-white/10'}`}>{entry.label}</button>
            ))}
          </div>
        ) : null}
      </div>

      {panelOpen && panels[activeMenu] ? (
        <aside className={`pointer-events-auto absolute top-20 z-30 max-h-[calc(100dvh-11rem)] w-[min(88vw,24rem)] overflow-auto rounded-3xl border border-white/40 bg-slate-950/50 p-4 text-white shadow-2xl backdrop-blur-xl ${item.side === 'left' ? 'left-4' : 'right-4'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{item.label}</h2>
            <button type="button" aria-label={`Collapse ${item.label}`} onClick={() => setPanelOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/20 hover:bg-white/10">{item.side === 'left' ? '‹' : '›'}</button>
          </div>
          {panels[activeMenu]}
        </aside>
      ) : (
        <button type="button" onClick={() => setPanelOpen(true)} className={`pointer-events-auto absolute top-24 z-30 rounded-xl border border-white/40 bg-slate-950/50 px-3 py-2 text-sm text-white shadow-xl backdrop-blur-xl ${item.side === 'left' ? 'left-4' : 'right-4'}`}>{item.side === 'left' ? '›' : '‹'} {item.label}</button>
      )}

      <DynamicMapInput activeMenu={activeMenu} onSubmit={onCommand} />
    </main>
  );
}

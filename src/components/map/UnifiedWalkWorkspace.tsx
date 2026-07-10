'use client';

import { useMemo, useState, type ReactNode } from 'react';
import UnifiedMapShell from './UnifiedMapShell';
import type { DynamicMapAction } from './DynamicMapInput';
import type { ActiveDogMapItem, HeatCellMapItem, ReportMapItem } from './LiveMapLayers';

type RouteMemory = {
  id: string;
  name: string;
  dogName: string;
  occurrences: number;
  confidence: number;
};

type Props = {
  planner: ReactNode;
  walkDetails: ReactNode;
  actions: ReactNode;
  activeDogs: ActiveDogMapItem[];
  heatCells: HeatCellMapItem[];
  reports: ReportMapItem[];
  routeMemories: RouteMemory[];
};

export default function UnifiedWalkWorkspace({ planner, walkDetails, actions, activeDogs, heatCells, reports, routeMemories }: Props) {
  const [feedback, setFeedback] = useState('');

  const radarPanel = useMemo(() => (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/10 p-3"><p className="text-white/60">Active</p><p className="mt-1 text-2xl font-bold">{activeDogs.length}</p></div>
        <div className="rounded-xl bg-white/10 p-3"><p className="text-white/60">Buddies</p><p className="mt-1 text-2xl font-bold">{activeDogs.filter((dog) => dog.isBuddy).length}</p></div>
        <div className="rounded-xl bg-white/10 p-3"><p className="text-white/60">Heat cells</p><p className="mt-1 text-2xl font-bold">{heatCells.length}</p></div>
      </div>
      <p className="rounded-xl bg-cyan-200/10 p-3 text-xs text-cyan-100">Live markers and heat intensity use canonical device_loc telemetry from the rolling activity window.</p>
      {activeDogs.length ? activeDogs.map((dog) => (
        <article key={dog.id} className="rounded-xl border border-white/15 bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-bold text-slate-900 ${dog.isBuddy ? 'ring-4 ring-cyan-200 shadow-[0_0_20px_rgba(125,211,252,.8)]' : ''}`}>{dog.avatar || dog.dogName.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0"><p className="font-semibold">{dog.dogName}</p><p className="truncate text-xs text-white/60">{dog.breed || 'Breed unavailable'} · {dog.status} · score {dog.walkingScore}</p><p className="mt-1 text-[11px] text-white/45">{dog.device_loc.lat.toFixed(5)}, {dog.device_loc.lng.toFixed(5)}</p></div>
          </div>
        </article>
      )) : <p className="rounded-xl bg-white/10 p-3 text-white/70">No active dog presences yet.</p>}
    </div>
  ), [activeDogs, heatCells]);

  const reportPanel = useMemo(() => (
    <div className="grid gap-2 text-sm">
      {reports.length ? reports.map((report) => <article key={report.id} className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="font-semibold">{report.title}</p><p className="mt-1 text-xs uppercase text-white/60">{report.type}</p><p className="mt-1 text-[11px] text-white/45">{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</p></article>) : <p className="rounded-xl bg-white/10 p-3 text-white/70">No live reports.</p>}
    </div>
  ), [reports]);

  const memoryPanel = useMemo(() => (
    <div className="grid gap-2 text-sm">
      {routeMemories.length ? routeMemories.map((route) => <article key={route.id} className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="font-semibold">{route.name}</p><p className="mt-1 text-xs text-white/60">{route.dogName} · {route.occurrences} walks · confidence {route.confidence}</p></article>) : <p className="rounded-xl bg-white/10 p-3 text-white/70">Route memory begins after repeated saved walks.</p>}
    </div>
  ), [routeMemories]);

  async function handleCommand(action: DynamicMapAction) {
    setFeedback(`${action.menu.replace('-', ' ')}: ${action.value}`);
    window.dispatchEvent(new CustomEvent('buddies:map-command', { detail: action }));
  }

  return (
    <UnifiedMapShell
      onCommand={handleCommand}
      panels={{
        route: <div className="grid gap-3 text-sm"><p className="text-white/75">Short press sets Start. Long press drops a flag. Drag route handles to shape the temporary route.</p>{feedback ? <p className="rounded-xl bg-white/10 p-3">{feedback}</p> : null}</div>,
        radar: radarPanel,
        reports: reportPanel,
        'route-memory': memoryPanel,
        'walk-details': <div className="grid gap-4">{walkDetails}{actions}</div>
      }}
    >
      <div className="h-full w-full overflow-auto bg-slate-100 pb-24" data-device-loc-dogs={activeDogs.length} data-device-loc-heat-cells={heatCells.length} data-live-reports={reports.length}>{planner}</div>
    </UnifiedMapShell>
  );
}

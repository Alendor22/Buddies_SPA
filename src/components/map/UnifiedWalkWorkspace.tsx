'use client';

import { useMemo, useState, type ReactNode } from 'react';
import UnifiedMapShell from './UnifiedMapShell';
import type { DynamicMapAction } from './DynamicMapInput';

type ActiveDog = {
  id: string;
  dogName: string;
  breed: string | null;
  status: string;
  walkingScore: number;
  isBuddy: boolean;
};

type Report = {
  id: string;
  title: string;
  type: string;
};

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
  activeDogs: ActiveDog[];
  reports: Report[];
  routeMemories: RouteMemory[];
};

export default function UnifiedWalkWorkspace({ planner, walkDetails, actions, activeDogs, reports, routeMemories }: Props) {
  const [feedback, setFeedback] = useState('');

  const radarPanel = useMemo(() => (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/10 p-3"><p className="text-white/60">Active dogs</p><p className="mt-1 text-2xl font-bold">{activeDogs.length}</p></div>
        <div className="rounded-xl bg-white/10 p-3"><p className="text-white/60">Nearby buddies</p><p className="mt-1 text-2xl font-bold">{activeDogs.filter((dog) => dog.isBuddy).length}</p></div>
      </div>
      {activeDogs.length ? activeDogs.map((dog) => (
        <article key={dog.id} className="rounded-xl border border-white/15 bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-bold text-slate-900 ${dog.isBuddy ? 'ring-4 ring-cyan-200 shadow-[0_0_20px_rgba(125,211,252,.8)]' : ''}`}>{dog.dogName.slice(0, 2).toUpperCase()}</div>
            <div><p className="font-semibold">{dog.dogName}</p><p className="text-xs text-white/60">{dog.breed || 'Breed unavailable'} · {dog.status} · score {dog.walkingScore}</p></div>
          </div>
        </article>
      )) : <p className="rounded-xl bg-white/10 p-3 text-white/70">No active dog presences yet.</p>}
    </div>
  ), [activeDogs]);

  const reportPanel = useMemo(() => (
    <div className="grid gap-2 text-sm">
      {reports.length ? reports.map((report) => <article key={report.id} className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="font-semibold">{report.title}</p><p className="mt-1 text-xs uppercase text-white/60">{report.type}</p></article>) : <p className="rounded-xl bg-white/10 p-3 text-white/70">No live reports.</p>}
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
      <div className="h-full w-full overflow-auto bg-slate-100 pb-24">{planner}</div>
    </UnifiedMapShell>
  );
}

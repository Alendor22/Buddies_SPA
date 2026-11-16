'use client';

import Link from 'next/link';
import { useState } from 'react';

const APP_SECTIONS = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/dogs', label: 'Dog profiles', icon: '🐶' },
  { href: '/dashboard/buddies', label: 'Buddies', icon: '👥' },
  { href: '/dashboard/social', label: 'Social', icon: '◎' },
  { href: '/dashboard/walks', label: 'Walks', icon: '↝' },
  { href: '/dashboard/messages', label: 'Messages', icon: '✉' },
  { href: '/dashboard/lost/report', label: 'Lost dog', icon: '!' },
  { href: '/dashboard/notifications', label: 'Alerts', icon: '🔔' },
  { href: '/scanner', label: 'Scan DogID', icon: '⌗' }
];

export default function MapAppNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 sm:left-5">
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="map-app-sections"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/35 bg-slate-950/75 px-4 text-sm font-bold text-white shadow-xl backdrop-blur-xl active:bg-slate-800"
        >
          <span aria-hidden="true">{open ? '×' : '☰'}</span>
          {open ? 'Close menu' : 'App menu'}
        </button>

        {open ? (
          <nav
            id="map-app-sections"
            aria-label="App sections"
            className="grid max-h-[min(65dvh,32rem)] w-[min(19rem,calc(100vw-1.5rem))] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-white/20 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-2xl"
          >
            {APP_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white active:bg-white/20"
              >
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.label}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

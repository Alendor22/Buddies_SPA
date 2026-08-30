'use client';

import Link from 'next/link';
import { useState } from 'react';

type FeatureItem = {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
};

type FeaturesRibbonProps = {
  pathname: string;
  signedIn: boolean;
  notificationCount: number;
};

const publicFeatures: FeatureItem[] = [
  { href: '/', label: 'Home', icon: '⌂', match: (pathname) => pathname === '/' },
  { href: '/map', label: 'Map', icon: '⌖', match: (pathname) => pathname.startsWith('/map') },
  { href: '/scanner', label: 'Scanner', icon: '⌗', match: (pathname) => pathname.startsWith('/scanner') },
  { href: '/dogs', label: 'Profiles', icon: '🐶', match: (pathname) => pathname.startsWith('/dogs') },
];

const memberFeatures: FeatureItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦', match: (pathname) => pathname === '/dashboard' },
  { href: '/dashboard/buddies', label: 'Buddies', icon: '👥', match: (pathname) => pathname.startsWith('/dashboard/buddies') },
  { href: '/dashboard/check-ins', label: 'Check-ins', icon: '✓', match: (pathname) => pathname.startsWith('/dashboard/check-ins') },
  { href: '/dashboard/walks', label: 'Walks', icon: '↝', match: (pathname) => pathname.startsWith('/dashboard/walks') },
  { href: '/dashboard/messages', label: 'Messages', icon: '✉', match: (pathname) => pathname.startsWith('/dashboard/messages') },
  { href: '/dashboard/buddies/invite', label: 'Invite', icon: '+', match: (pathname) => pathname.startsWith('/dashboard/buddies/invite') },
  { href: '/dashboard/lost/report', label: 'Lost Dog', icon: '!', match: (pathname) => pathname.startsWith('/dashboard/lost') },
  { href: '/dashboard/notifications', label: 'Alerts', icon: '🔔', match: (pathname) => pathname.startsWith('/dashboard/notifications') },
];

function FeatureLink({ item, pathname, count }: { item: FeatureItem; pathname: string; count?: number }) {
  const active = item.match(pathname);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
      {count && count > 0 ? (
        <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none ${active ? 'bg-white text-slate-900' : 'bg-red-600 text-white'}`}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export default function FeaturesRibbon({ pathname, signedIn, notificationCount }: FeaturesRibbonProps) {
  const [expanded, setExpanded] = useState(true);
  const features = signedIn ? [...publicFeatures, ...memberFeatures] : publicFeatures;

  return (
    <div className="border-t bg-slate-50/95">
      <div className="mx-auto max-w-6xl px-3 py-2 sm:px-6">
        <div className="flex items-center justify-start gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="features-ribbon"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            Features
          </button>
          {!expanded ? <span className="truncate text-xs font-medium text-slate-500">Feature navigation collapsed</span> : null}
        </div>

        {expanded ? (
          <nav id="features-ribbon" aria-label="Features" className="mt-2 flex justify-start gap-2 overflow-x-auto pb-1">
            {features.map((item) => (
              <FeatureLink
                key={item.href}
                item={item}
                pathname={pathname}
                count={item.href === '/dashboard/notifications' ? notificationCount : undefined}
              />
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

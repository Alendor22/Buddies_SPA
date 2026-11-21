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
  { href: '/scanner', label: 'Scanner', icon: '⌗', match: (pathname) => pathname.startsWith('/scanner') },
  { href: '/dogs', label: 'Profiles', icon: '🐶', match: (pathname) => pathname.startsWith('/dogs') },
];

const memberFeatures: FeatureItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦', match: (pathname) => pathname === '/dashboard' },
  { href: '/dashboard/lost/report', label: 'Lost Dog', icon: '!', match: (pathname) => pathname.startsWith('/dashboard/lost') },
  { href: '/find-dog', label: 'Find Lost Dog', icon: '🔎', match: (pathname) => pathname.startsWith('/find-dog') },
  { href: '/dashboard/notifications', label: 'Alerts', icon: '🔔', match: (pathname) => pathname.startsWith('/dashboard/notifications') },
];

const socialFeatures: FeatureItem[] = [
  { href: '/dashboard/social', label: 'Social hub · packs & meetups', icon: '◎', match: (pathname) => pathname === '/dashboard/social' || pathname.startsWith('/dashboard/social/') },
  { href: '/dashboard/buddies', label: 'Buddy requests', icon: '👥', match: (pathname) => pathname.startsWith('/dashboard/buddies') && !pathname.startsWith('/dashboard/buddies/invite') },
  { href: '/dashboard/buddies/invite', label: 'Invite dogs', icon: '+', match: (pathname) => pathname.startsWith('/dashboard/buddies/invite') },
  { href: '/dashboard/walks', label: 'Walks & invitations', icon: '↝', match: (pathname) => pathname.startsWith('/dashboard/walks') },
  { href: '/dashboard/messages', label: 'Conversations', icon: '✉', match: (pathname) => pathname.startsWith('/dashboard/messages') },
];

const mapFeatures: FeatureItem[] = [
  { href: '/map', label: 'Live map', icon: '⌖', match: (pathname) => pathname.startsWith('/map') },
  { href: '/dashboard/social-map', label: 'Neighborhood activity', icon: '◎', match: (pathname) => pathname.startsWith('/dashboard/social-map') },
  { href: '/dashboard/check-ins', label: 'Dog check-ins', icon: '✓', match: (pathname) => pathname.startsWith('/dashboard/check-ins') },
];

function FeatureLink({ item, pathname, count, onNavigate }: { item: FeatureItem; pathname: string; count?: number; onNavigate: () => void }) {
  const active = item.match(pathname);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition ${
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
  const [expanded, setExpanded] = useState(false);
  const [mapsExpanded, setMapsExpanded] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
  const features = signedIn ? [...publicFeatures, ...memberFeatures] : publicFeatures;
  const mapsActive = mapFeatures.some((item) => item.match(pathname));
  const socialActive = socialFeatures.some((item) => item.match(pathname));

  return (
    <div className="pointer-events-none fixed left-3 top-20 z-[70] max-w-[calc(100vw-1.5rem)] sm:left-6 sm:top-20 sm:max-w-[min(56rem,calc(100vw-3rem))]">
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="features-ribbon"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-4 text-sm font-bold text-slate-900 shadow-lg backdrop-blur active:bg-slate-100"
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          Features
        </button>

        {expanded ? (
          <nav
            id="features-ribbon"
            aria-label="Features"
            className="flex max-h-[min(70vh,34rem)] max-w-full flex-wrap justify-start gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur"
          >
            <section aria-label="Maps" className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-2">
              <button type="button" aria-expanded={mapsExpanded} onClick={() => setMapsExpanded((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm ${mapsActive ? 'border-cyan-900 bg-cyan-900 text-white' : 'border-cyan-200 bg-white text-cyan-950'}`}>
                <span aria-hidden="true">⌖</span><span>Maps</span><span aria-hidden="true">{mapsExpanded ? '▾' : '▸'}</span>
              </button>
              {mapsExpanded ? <div className="flex flex-wrap gap-2">{mapFeatures.filter((item) => signedIn || item.href === '/map').map((item) => <FeatureLink key={item.href} item={item} pathname={pathname} onNavigate={() => { setExpanded(false); setMapsExpanded(false); }} />)}</div> : null}
            </section>
            {signedIn ? <section aria-label="Social" className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-2">
              <button type="button" aria-expanded={socialExpanded} onClick={() => setSocialExpanded((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm ${socialActive ? 'border-violet-900 bg-violet-900 text-white' : 'border-violet-200 bg-white text-violet-950'}`}>
                <span aria-hidden="true">◎</span><span>Social</span><span aria-hidden="true">{socialExpanded ? '▾' : '▸'}</span>
              </button>
              {socialExpanded ? <div className="flex flex-wrap gap-2">{socialFeatures.map((item) => <FeatureLink key={item.href} item={item} pathname={pathname} onNavigate={() => { setExpanded(false); setSocialExpanded(false); }} />)}</div> : null}
            </section> : null}
            {features.map((item) => (
              <FeatureLink
                key={item.href}
                item={item}
                pathname={pathname}
                count={item.href === '/dashboard/notifications' ? notificationCount : undefined}
                onNavigate={() => setExpanded(false)}
              />
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

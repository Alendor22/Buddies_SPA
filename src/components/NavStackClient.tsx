'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useSyncExternalStore, useState } from 'react';

type StackEntry = { path: string; title: string; ts: number };

const STORAGE_KEY = 'buddies_nav_stack_v24';
const MAX_STACK = 12;
const EMPTY_STACK: StackEntry[] = [];
let stackSnapshot: StackEntry[] | null = null;
const stackListeners = new Set<() => void>();

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/dashboard/buddies/invite')) return 'Invite Buddy';
  if (pathname.startsWith('/dashboard/buddies')) return 'Buddies';
  if (pathname.startsWith('/dashboard/notifications')) return 'Alerts';
  if (pathname.startsWith('/dashboard/menu') || pathname.startsWith('/dashboard/account')) return 'Account';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/dogs/new')) return 'Add Profile';
  if (pathname.startsWith('/dogs/edit')) return 'Edit Profile';
  if (pathname.includes('/qr')) return 'QR Profile';
  if (pathname.startsWith('/dogs/')) return 'Dog Profile';
  if (pathname.startsWith('/dogs')) return 'Profiles';
  if (pathname.startsWith('/auth/login')) return 'Sign in';
  if (pathname.startsWith('/auth/register')) return 'Create account';
  if (pathname.startsWith('/logout')) return 'Signed out';
  return 'Buddies';
}

function readStack(): StackEntry[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StackEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.path && entry?.title) : [];
  } catch {
    return [];
  }
}

function writeStack(stack: StackEntry[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
  } catch {
    // ignore storage failures on private/mobile browsers
  }
}

function getStackSnapshot() {
  if (stackSnapshot === null) stackSnapshot = readStack();
  return stackSnapshot;
}

function getServerStackSnapshot() {
  return EMPTY_STACK;
}

function subscribeToStack(listener: () => void) {
  stackListeners.add(listener);
  return () => stackListeners.delete(listener);
}

function recordPath(pathname: string) {
  const current: StackEntry = { path: pathname, title: titleForPath(pathname), ts: Date.now() };
  const previous = readStack();
  const last = previous[previous.length - 1];
  const next = last?.path === pathname ? [...previous.slice(0, -1), current] : [...previous, current];
  const bounded = next.slice(-MAX_STACK);
  writeStack(bounded);
  stackSnapshot = bounded;
  stackListeners.forEach((listener) => listener());
}

export function useNavStack(pathname: string) {
  const stack = useSyncExternalStore(subscribeToStack, getStackSnapshot, getServerStackSnapshot);

  useEffect(() => {
    recordPath(pathname);
  }, [pathname]);

  return stack;
}

export default function NavStackClient() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const stack = useNavStack(pathname);
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => [...stack].reverse().filter((entry) => entry.path !== pathname).slice(0, 5), [stack, pathname]);

  if (recent.length === 0) return null;

  return (
    <div className="fixed left-4 top-24 z-50 sm:hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg">
        Stack
      </button>
      {open ? (
        <div className="mt-2 w-64 rounded-2xl border bg-white p-3 shadow-2xl">
          <p className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">Recent pages</p>
          <div className="grid gap-1">
            {recent.map((entry) => (
              <button
                key={`${entry.path}-${entry.ts}`}
                type="button"
                onClick={() => { setOpen(false); router.push(entry.path); }}
                className="rounded-xl px-3 py-2 text-left text-sm font-medium active:bg-slate-100"
              >
                <span className="block truncate">{entry.title}</span>
                <span className="block truncate text-xs font-normal text-slate-500">{entry.path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

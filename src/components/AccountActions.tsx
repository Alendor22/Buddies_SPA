'use client';

import { UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

type AccountActionsProps = {
  fallbackSignedIn?: boolean;
  notificationCount?: number;
};

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
      {count}
    </span>
  );
}

export default function AccountActions({ fallbackSignedIn = false, notificationCount = 0 }: AccountActionsProps) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const signedIn = isSignedIn ?? fallbackSignedIn;

  if (signedIn) {
    return (
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" aria-label="Account actions">
        <UserButton />
        <Badge count={notificationCount} />
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Account actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold text-slate-800 active:bg-slate-100"
      >
        ♙
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-13 z-50 w-44 overflow-hidden rounded-xl border bg-white p-1.5 shadow-xl">
          <Link
            role="menuitem"
            href="/sign-in"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link
            role="menuitem"
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Create account
          </Link>
        </div>
      ) : null}
    </div>
  );
}

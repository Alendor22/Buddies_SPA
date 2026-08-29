'use client';

import { useClerk } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function LogoutClient() {
  const { signOut } = useClerk();

  useEffect(() => {
    void signOut({ redirectUrl: '/' });
  }, [signOut]);

  return <p className="text-sm text-slate-600">Signing out securely…</p>;
}

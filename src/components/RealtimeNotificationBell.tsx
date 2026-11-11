'use client';

import type * as Ably from 'ably';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getRealtimeClient } from '@/lib/realtime';
import { channels } from '@/lib/realtime';

type IncomingNotification = { notificationId?: string; href?: string; title?: string; body?: string };

export default function RealtimeNotificationBell() {
  const { isSignedIn, userId } = useAuth();

  if (!isSignedIn || !userId) return null;
  return <AuthenticatedNotificationBell key={userId} userId={userId} />;
}

function AuthenticatedNotificationBell({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [toast, setToast] = useState<IncomingNotification | null>(null);
  const wasOnMessagesPage = useRef(pathname.startsWith('/dashboard/messages'));

  useEffect(() => {
    let channel: Ably.RealtimeChannel | null = null;
    let disposed = false;
    const loadCount = async () => {
      const response = await fetch('/api/notifications/unread', { cache: 'no-store' });
      if (response.ok && !disposed) {
        const data = await response.json();
        setCount(data.count ?? 0);
        setMessageCount(data.messageCount ?? 0);
      }
    };
    const onNotification = (message: Ably.Message) => {
      const data = (message.data ?? {}) as IncomingNotification;
      setCount((value) => value + 1);
      setMessageCount((value) => value + 1);
      setToast(data);
      window.setTimeout(() => { if (!disposed) setToast(null); }, 5000);
    };
    void loadCount();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadCount();
    }, 3000);
    try {
      channel = getRealtimeClient().channels.get(channels.userNotifications(userId));
      void channel.subscribe('notification.created', onNotification);
    } catch {
      channel = null;
    }
    return () => {
      disposed = true;
      window.clearInterval(poll);
      channel?.unsubscribe('notification.created', onNotification);
    };
  }, [userId]);

  useEffect(() => {
    const wasOnMessagesPageBeforeNavigation = wasOnMessagesPage.current;
    const isOnMessagesPage = pathname.startsWith('/dashboard/messages');
    wasOnMessagesPage.current = isOnMessagesPage;
    if (!wasOnMessagesPageBeforeNavigation || isOnMessagesPage) return;

    let cancelled = false;
    async function refreshMessageCount() {
      try {
        const response = await fetch('/api/notifications/unread', { cache: 'no-store' });
        if (response.ok && !cancelled) {
          const data = await response.json();
          setMessageCount(data.messageCount ?? 0);
        }
      } catch {
        // The regular unread-count poll will reconcile if this refresh fails.
      }
    }
    void refreshMessageCount();
    return () => { cancelled = true; };
  }, [pathname]);

  const visibleMessageCount = pathname.startsWith('/dashboard/messages') ? 0 : messageCount;

  return (
    <>
      <Link href="/dashboard/messages" aria-label={visibleMessageCount ? `${visibleMessageCount} unread messages` : 'Messages'} className="relative shrink-0 rounded-full border px-3 py-2 text-sm font-medium">
        Messages
        {visibleMessageCount > 0 ? <span className="absolute -right-1 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-5 text-white">{visibleMessageCount > 99 ? '99+' : visibleMessageCount}</span> : null}
      </Link>
      <Link href="/dashboard/notifications" aria-label={count ? `${count} unread notifications` : 'Notifications'} className="relative shrink-0 rounded-full border px-3 py-2 text-sm font-medium">
        Alerts
        {count > 0 ? <span className="absolute -right-1 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-5 text-white">{count > 99 ? '99+' : count}</span> : null}
      </Link>
      {toast ? (
        <div role="status" className="fixed right-4 top-20 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <p className="text-sm font-semibold">{toast.title ?? 'New message'}</p>
          {toast.body ? <p className="mt-1 truncate text-sm text-slate-600">{toast.body}</p> : null}
          <Link href={toast.href ?? '/dashboard/messages'} className="mt-3 inline-block text-sm font-semibold text-blue-700">Open messages</Link>
        </div>
      ) : null}
    </>
  );
}

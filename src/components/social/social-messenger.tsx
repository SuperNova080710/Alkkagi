'use client';

import { createBrowserClient } from '@supabase/ssr';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { dmRequest, DmApiError } from '@/components/messages/message-api';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { SocialDrawer } from './social-drawer';
import { parseSocialInbox, SOCIAL_INBOX_CHANGED, type SocialInbox } from './social-inbox';
import './social-messenger.css';

const privatePages = /^\/(lobby|ranked|rooms|omok|chess|profile|players|friends|messages|cosmetics)(?:\/|$)/;

export function SocialMessenger() {
  const pathname = usePathname();
  return privatePages.test(pathname) ? <SignedInMessenger pathname={pathname}/> : null;
}

function SignedInMessenger({ pathname }: { pathname: string }) {
  const [inbox, setInbox] = useState<SocialInbox | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const requestRefresh = useCallback(() => setRefresh(value => value + 1), []);
  const userId = inbox?.userId;
  const messagesEnabled = inbox?.messages !== undefined;

  useEffect(() => {
    const controller = new AbortController();
    dmRequest<unknown>('/api/social/inbox', { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setInbox(parseSocialInbox(data, Date.now()));
        setLoadFailed(false);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof DmApiError && error.status === 401) setInbox(null);
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, [refresh, pathname]);

  useEffect(() => {
    const visibleRefresh = () => {
      if (document.visibilityState === 'visible') requestRefresh();
    };
    window.addEventListener('focus', visibleRefresh);
    window.addEventListener(SOCIAL_INBOX_CHANGED, requestRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    const interval = window.setInterval(visibleRefresh, 20_000);
    return () => {
      window.removeEventListener('focus', visibleRefresh);
      window.removeEventListener(SOCIAL_INBOX_CHANGED, requestRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
      window.clearInterval(interval);
    };
  }, [requestRefresh]);

  useEffect(() => {
    const config = getSupabaseConfig();
    if (!config || !userId || !messagesEnabled) return;
    const db = createBrowserClient(config.url, config.key);
    const channel = db.channel('social-inbox-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, requestRefresh)
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [userId, messagesEnabled, requestRefresh]);

  useEffect(() => {
    if (!inbox?.invites.length) return;
    const nextExpiry = Math.min(...inbox.invites.map(invite => Date.parse(invite.expiresAt)));
    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setInbox(current => current && {
        ...current, invites: current.invites.filter(invite => Date.parse(invite.expiresAt) > now),
      });
    }, Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [inbox]);

  return inbox && <SocialDrawer key={inbox.userId} inbox={inbox} pathname={pathname}
    loadFailed={loadFailed} onRefresh={requestRefresh}/>;
}

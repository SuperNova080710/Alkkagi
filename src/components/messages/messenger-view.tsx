'use client';

import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { shouldSubmitChatOnEnter } from '@/lib/chat/keyboard';
import {
  DmApiError, canSendDm, dmBodyLength, dmConversationPath, dmErrorMessage, dmMutation,
  dmRequest, isDmPeerId, normalizedDmBody,
  type DmFriends, type DmHistory, type DmInboxItem, type DmPeer, type DmSent,
} from './message-api';

type Props = { userId: string; initialPeer: string | null };
const endpoint = (peerId: string) => '/api/messages/' + encodeURIComponent(peerId);

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
}

export function MessengerView({ userId, initialPeer }: Props) {
  const [friends, setFriends] = useState<DmPeer[]>([]);
  const [inbox, setInbox] = useState<DmInboxItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [selected, setSelected] = useState(initialPeer);
  const [history, setHistory] = useState<DmHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(initialPeer));
  const [threadError, setThreadError] = useState<unknown>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [listRefresh, setListRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [activity, setActivity] = useState('');
  const pendingRequest = useRef<{ body: string; requestId: string } | null>(null);
  const readCursor = useRef<{ peerId: string; id: string } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scrollRestore = useRef<{ height: number; top: number } | null>(null);
  const activeThread = history?.threadId;

  const refreshAll = useCallback(() => {
    setListRefresh(count => count + 1);
    setHistoryRefresh(count => count + 1);
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([
      dmRequest<DmFriends>('/api/friends'),
      dmRequest<DmInboxItem[]>('/api/messages'),
    ]).then(([contacts, threads]) => {
      if (!current) return;
      setFriends(contacts.friends);
      setInbox(threads);
      setListError(null);
      setLoadingList(false);
    }).catch(error => {
      if (!current) return;
      // Fail closed: do not display a potentially stale friend or inbox list.
      setFriends([]); setInbox([]); setListError(error); setLoadingList(false);
    });
    return () => { current = false; };
  }, [listRefresh]);

  useEffect(() => {
    if (!selected || !isDmPeerId(selected)) return;
    let current = true;
    dmRequest<DmHistory>(endpoint(selected) + '?limit=30').then(data => {
      if (!current) return;
      setHistory(data); setLoadingHistory(false); setThreadError(null);
    }).catch(error => {
      if (!current) return;
      // Do not retain messages after unfriending/blocking (404) or session expiry.
      setHistory(null); setLoadingHistory(false); setThreadError(error);
      if (error instanceof DmApiError && error.status === 404) setListRefresh(n => n + 1);
    });
    return () => { current = false; };
  }, [selected, historyRefresh]);

  useEffect(() => {
    if (!selected || !history?.messages.length) return;
    // The server gives newest-first. Never turn bigint IDs into JavaScript numbers.
    const newestIncoming = history.messages.find(message => message.senderId !== userId);
    if (!newestIncoming || readCursor.current?.peerId === selected &&
      readCursor.current.id === newestIncoming.id) return;
    const peer = selected, id = newestIncoming.id;
    readCursor.current = { peerId: peer, id };
    dmMutation(endpoint(peer) + '/read', 'PUT', { messageId: id })
      .then(() => setListRefresh(count => count + 1))
      .catch(() => {
        if (readCursor.current?.peerId === peer && readCursor.current.id === id)
          readCursor.current = null;
      });
  }, [selected, userId, history]);

  useEffect(() => {
    const element = listRef.current;
    if (!element || !history) return;
    const saved = scrollRestore.current;
    if (saved) {
      element.scrollTop = saved.top + element.scrollHeight - saved.height;
      scrollRestore.current = null;
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const onFocus = () => refreshAll();
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshAll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    if (!url || !key) return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    const db = createBrowserClient(url, key);
    const threads = db.channel('dm-inbox-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_threads' },
        () => setListRefresh(n => n + 1)).subscribe();
    const messages = activeThread ? db.channel('dm-messages-' + activeThread)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: 'thread_id=eq.' + activeThread,
      }, () => refreshAll()).subscribe() : null;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      void db.removeChannel(threads);
      if (messages) void db.removeChannel(messages);
    };
  }, [activeThread, userId, refreshAll]);

  function selectPeer(peerId: string) {
    if (!isDmPeerId(peerId) || selected === peerId) return;
    setSelected(peerId); setHistory(null); setThreadError(null); setLoadingHistory(true);
    setDraft(''); setSendError(null); setActivity(''); pendingRequest.current = null;
    readCursor.current = null; scrollRestore.current = null;
    window.history.replaceState(null, '', dmConversationPath(peerId));
  }

  async function loadOlder() {
    if (!selected || !history?.hasMore || olderLoading || !history.messages.length) return;
    setOlderLoading(true);
    setThreadError(null);
    try {
      const before = history.messages[history.messages.length - 1].id;
      const page = await dmRequest<DmHistory>(endpoint(selected) + '?before=' + encodeURIComponent(before) + '&limit=30');
      if (page.threadId !== history.threadId) { refreshAll(); return; }
      const element = listRef.current;
      if (element) scrollRestore.current = { height: element.scrollHeight, top: element.scrollTop };
      setHistory(previous => {
        if (!previous || previous.threadId !== page.threadId) return previous;
        const known = new Set(previous.messages.map(message => message.id));
        return {
          ...previous,
          messages: [...previous.messages, ...page.messages.filter(message => !known.has(message.id))],
          hasMore: page.hasMore,
        };
      });
    } catch (error) {
      if (error instanceof DmApiError && (error.status === 404 || error.status === 401)) {
        setHistory(null); setListRefresh(n => n + 1);
      }
      setThreadError(error);
    } finally { setOlderLoading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending || !canSendDm(draft)) return;
    const body = normalizedDmBody(draft);
    const requestId = pendingRequest.current?.body === body
      ? pendingRequest.current.requestId : crypto.randomUUID();
    pendingRequest.current = { body, requestId };
    const restoreFocus = document.activeElement === composer.current;
    setSending(true); setSendError(null);
    try {
      await dmMutation<DmSent>(endpoint(selected), 'POST', { body, requestId });
      pendingRequest.current = null; setDraft(''); setActivity('메시지를 전송했습니다.');
      refreshAll();
    } catch (error) {
      setSendError(error);
      if (error instanceof DmApiError && (error.status === 404 || error.status === 401)) {
        setHistory(null); setListRefresh(n => n + 1);
      }
    } finally {
      setSending(false);
      if (restoreFocus) composer.current?.focus({ preventScroll: true });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSubmitChatOnEnter({
      key: event.key, shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      keyCode: event.nativeEvent.keyCode, repeat: event.repeat,
    })) return;
    event.preventDefault();
    if (sending || !canSendDm(draft)) return;
    event.currentTarget.form?.requestSubmit();
  }

  const choices = friends.map(person => ({
    ...person, recent: inbox.find(row => row.userId === person.id),
  })).sort((a, b) => {
    const aTime = a.recent?.lastAt ?? '';
    const bTime = b.recent?.lastAt ?? '';
    return bTime.localeCompare(aTime) || a.nickname.localeCompare(b.nickname, 'ko');
  });
  const person = choices.find(item => item.id === selected);
  const authError = listError instanceof DmApiError && listError.status === 401
    || threadError instanceof DmApiError && threadError.status === 401
    || sendError instanceof DmApiError && sendError.status === 401;

  if (authError) return <section className="arena-panel arena-dm-unavailable">
    <h2>로그인이 필요합니다</h2><p role="alert">세션이 만료되었습니다. 다시 로그인해 주세요.</p>
    <Link href="/login" className="arena-button">로그인하기</Link>
  </section>;

  return <section className="arena-dm-shell" aria-label="친구 메신저">
    <aside className="arena-panel arena-dm-inbox" aria-label="친구 대화 목록">
      <div className="arena-dm-heading">
        <div><h2>친구와 대화</h2><p>친구만 메시지를 주고받을 수 있습니다.</p></div>
        <button type="button" className="arena-dm-reload" onClick={refreshAll} disabled={loadingList}>새로고침</button>
      </div>
      {loadingList && <p role="status" className="arena-muted">친구와 대화를 불러오고 있습니다…</p>}
      {listError && <p role="alert" className="arena-dm-error">{dmErrorMessage(listError)}</p>}
      {!loadingList && !listError && !choices.length && <div className="arena-dm-empty">
        <p>아직 대화할 친구가 없습니다.</p>
        <Link href="/friends" className="arena-text-link">친구 목록에서 요청하기 ›</Link>
      </div>}
      <ul className="arena-dm-peers">
        {choices.map(item => <li key={item.id}>
          <button type="button" aria-current={selected === item.id ? 'true' : undefined}
            className={'arena-dm-peer' + (selected === item.id ? ' is-selected' : '')}
            onClick={() => selectPeer(item.id)}>
            <span className="arena-dm-avatar" aria-hidden="true">●</span>
            <span className="arena-dm-peer-copy">
              <strong>{item.nickname}</strong>
              <span>{item.recent?.lastMessage ?? '새 대화 시작하기'}</span>
            </span>
            {Number.isFinite(item.recent?.unreadCount) && (item.recent?.unreadCount ?? 0) > 0 &&
              <span className="arena-dm-unread" aria-label={`읽지 않은 메시지 ${item.recent?.unreadCount}개`}>
                {item.recent?.unreadCount}
              </span>}
          </button>
        </li>)}
      </ul>
      <Link href="/friends" className="arena-text-link">친구 관리로 돌아가기 ›</Link>
    </aside>

    <section className="arena-panel arena-dm-thread" aria-label="선택한 대화">
      {selected ? <>
        <header className="arena-dm-thread-heading">
          <div><h2>{person?.nickname ?? '대화 상대'}</h2><p>친구 전용 1:1 메시지</p></div>
          {person && <Link href={'/players/' + person.id} className="arena-text-link">프로필 ›</Link>}
        </header>
        {loadingHistory && !history && <p role="status" className="arena-muted">대화를 불러오고 있습니다…</p>}
        {threadError && <div className="arena-dm-error" role="alert">
          <p>{dmErrorMessage(threadError)}</p>
          <button type="button" onClick={refreshAll}>다시 시도</button>
        </div>}
        {history && <>
          {history.hasMore && <button type="button" className="arena-dm-older" onClick={() => void loadOlder()} disabled={olderLoading}>
            {olderLoading ? '불러오는 중…' : '이전 메시지 더 보기'}
          </button>}
          <ol className="arena-dm-messages" ref={listRef} aria-label="대화 내용" aria-live="polite" aria-relevant="additions text">
            {!history.messages.length && <li className="arena-dm-empty">첫 메시지를 보내 대화를 시작해 보세요.</li>}
            {[...history.messages].reverse().map(message =>
              <li key={message.id} className={'arena-dm-message' + (message.senderId === userId ? ' is-mine' : '')}>
                <span className="arena-dm-message-author">{message.senderId === userId ? '나' : person?.nickname ?? '친구'}</span>
                <p>{message.body}</p>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              </li>)}
          </ol>
          <form onSubmit={event => void submit(event)} className="arena-dm-compose">
            <label htmlFor="arena-dm-body">메시지 입력</label>
            <textarea id="arena-dm-body" ref={composer} rows={3} maxLength={1000}
              value={draft} onChange={event => {setDraft(event.target.value);pendingRequest.current=null;setSendError(null);}}
              onKeyDown={onKeyDown} readOnly={sending} placeholder="친구에게 메시지를 보내세요."
              aria-describedby="arena-dm-shortcut arena-dm-limit"/>
            <div className="arena-dm-compose-bottom">
              <div><p id="arena-dm-shortcut">Enter 전송 · Shift+Enter 줄바꿈</p>
                <p id="arena-dm-limit" aria-live="off">{dmBodyLength(draft)}/500자</p></div>
              <button type="submit" className="arena-button" disabled={!canSendDm(draft) || sending}>
                {sending ? '전송 중…' : '전송'}
              </button>
            </div>
            {sendError && <p role="alert" className="arena-dm-error">{dmErrorMessage(sendError)}</p>}
            <p role="status" className="arena-dm-feedback">{activity}</p>
          </form>
        </>}
      </> : <div className="arena-dm-welcome"><div className="arena-dm-welcome-mark" aria-hidden="true">● ●</div>
        <h2>친구를 선택해 주세요</h2><p>친구 목록에서 대화 상대를 선택하면 메시지를 주고받을 수 있습니다.</p>
      </div>}
    </section>
  </section>;
}

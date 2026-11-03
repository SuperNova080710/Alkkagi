'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { OmokChatPanel, OmokMatchPanel } from './omok-match-panels';
import './omok-live.css';
import {
  isRecord, isUuid, omokErrorText, omokRequest, parseMatch, parseMessages, parseRoom,
  preserveOmokChatRetry,
  type MatchSnapshot, type OmokChatRecord,
} from './omok-client-api';
import type { OmokPosition } from './omok-board-view';

type ProposedMove = { requestId: string; turnNo: number; row: number; col: number };

export function OmokMatchClient({ matchId, currentUserId, kind = 'casual' }: {
  matchId: string; currentUserId: string; kind?: 'casual' | 'ranked';
}) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchSnapshot | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<OmokChatRecord[]>([]);
  const [error, setError] = useState('');
  const [chatError, setChatError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryMove, setRetryMove] = useState<ProposedMove | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [myRematchVote, setMyRematchVote] = useState(false);
  const lock = useRef(false);
  const moveRequest = useRef<ProposedMove | null>(null);
  const chatRequest = useRef<{ body: string; requestId: string } | null>(null);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const serial = ++sequence.current;
    try {
      const payload = await omokRequest<unknown>('/api/omok/matches/' + matchId);
      const snapshot = parseMatch(payload);
      if (serial !== sequence.current) return;
      setMatch(snapshot); setReconnecting(false); setError('');
      if (moveRequest.current && snapshot.turnNo !== moveRequest.current.turnNo) {
        moveRequest.current = null; setRetryMove(null);
      }
      if (snapshot.roomId) {
        try {
          const room = parseRoom(await omokRequest<unknown>('/api/omok/rooms/' + snapshot.roomId));
          if (serial === sequence.current) {
            setNames(Object.fromEntries(room.players.map(p => [p.userId, p.nickname])));
            if (room.matchId && room.matchId !== matchId && kind === 'casual')
              router.replace('/omok/matches/' + room.matchId);
          }
        } catch { /* Match and ownership remain authoritative if room metadata is unavailable. */ }
      }
    } catch (cause) {
      if (serial === sequence.current) {
        setError(omokErrorText(cause));
        setReconnecting(true);
      }
    } finally { if (serial === sequence.current) setLoading(false); }
  }, [matchId, router, kind]);

  const loadChat = useCallback(async () => {
    try {
      const data = await omokRequest<unknown>('/api/omok/matches/' + matchId + '/messages');
      setMessages(parseMessages(data)); setChatError('');
    } catch (cause) { setChatError(omokErrorText(cause)); }
  }, [matchId]);

  useEffect(() => {
    const sequenceRef = sequence;
    queueMicrotask(() => { void load(); void loadChat(); });
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') { void load(); void loadChat(); }
    }, 4000);
    const refresh = () => { void load(); void loadChat(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    // Ranked timeout settlement requests an immediate server-authoritative refresh.
    window.addEventListener('omok:refresh', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const db = url && key ? createBrowserClient(url, key) : null;
    const channel = db?.channel('omok-match:' + matchId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'omok_matches', filter: 'id=eq.' + matchId,
      }, () => { void load(); })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'omok_moves', filter: 'match_id=eq.' + matchId,
      }, () => { void load(); })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'omok_match_messages', filter: 'match_id=eq.' + matchId,
      }, () => { void loadChat(); })
      .subscribe(state => { if (state === 'SUBSCRIBED') refresh(); });
    return () => {
      sequenceRef.current++;
      window.clearInterval(poll);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('omok:refresh', refresh);
      document.removeEventListener('visibilitychange', visible);
      if (db && channel) void db.removeChannel(channel);
    };
  }, [matchId, load, loadChat]);

  async function sendMove(move: ProposedMove) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      await omokRequest<unknown>('/api/omok/matches/' + matchId + '/move', {
        method: 'POST', body: move,
      });
      moveRequest.current = null; setRetryMove(null);
      await load();
    } catch (cause) {
      setError(omokErrorText(cause));
      const unknownOutcome = !isRecord(cause) && !(cause instanceof Error) ? true :
        ('code' in Object(cause) && ['NETWORK_ERROR','GAME_SERVICE_UNAVAILABLE'].includes(
          String((cause as { code?: string }).code)));
      if (unknownOutcome) setRetryMove(move);
      else { moveRequest.current = null; setRetryMove(null); }
      await load();
    } finally { lock.current = false; setPending(false); }
  }

  function propose(position: OmokPosition) {
    if (!match || match.status !== 'active' || match.turnUserId !== currentUserId ||
      lock.current || retryMove || moveRequest.current) return;
    const proposal = { requestId: crypto.randomUUID(), turnNo: match.turnNo,
      row: position.row, col: position.col };
    moveRequest.current = proposal;
    void sendMove(proposal);
  }
  async function forfeit() {
    if (!match || lock.current || !window.confirm('정말 기권하시겠습니까? 이 경기는 패배 처리됩니다.')) return;
    lock.current = true; setPending(true); setError('');
    try {
      await omokRequest('/api/omok/matches/' + matchId + '/forfeit', { method: 'POST' });
      await load();
    } catch (e) { setError(omokErrorText(e)); await load(); }
    finally { lock.current = false; setPending(false); }
  }
  async function rematch() {
    if (!match?.roomId || lock.current || myRematchVote) return;
    lock.current = true; setPending(true); setError('');
    try {
      const response = await omokRequest<unknown>('/api/omok/rooms/' + match.roomId + '/rematch',
        { method: 'POST' });
      if (!isRecord(response)) throw Error('INVALID_REMATCH_RESPONSE');
      setReadyCount(typeof response.readyCount === 'number' ? response.readyCount : 0);
      setMyRematchVote(true);
      if (response.status === 'started' && isUuid(response.matchId))
        router.replace('/omok/matches/' + response.matchId);
      else await load();
    } catch (e) { setError(omokErrorText(e)); await load(); }
    finally { lock.current = false; setPending(false); }
  }
  async function sendChat(body: string): Promise<boolean> {
    if (chatRequest.current && chatRequest.current.body !== body) {
      setChatError('이전 메시지의 전송 결과가 불확실합니다. 같은 메시지를 먼저 재시도해 주세요.');
      return false;
    }
    const active = chatRequest.current ?? { body, requestId: crypto.randomUUID() };
    chatRequest.current = active;
    setChatError('');
    try {
      await omokRequest('/api/omok/matches/' + matchId + '/messages',
        { method: 'POST', body: active });
      chatRequest.current = null;
      await loadChat();
      return true;
    } catch (e) {
      // A definite HTTP 4xx rejection cannot commit a message. Network,
      // timeout and server errors remain ambiguous and reuse the request ID.
      if (!preserveOmokChatRetry(e)) chatRequest.current = null;
      setChatError(omokErrorText(e));
      return false;
    }
  }
  if (loading && !match) return <p className="arena-omok-live-panel" role="status">오목 경기 정보를 불러오는 중…</p>;
  if (!match) return <section className="arena-omok-live-panel">
    <p role="alert" className="arena-omok-live-error">{error || '경기 정보를 확인할 수 없습니다.'}</p>
    <button type="button" className="arena-button" onClick={() => void load()}>다시 조회</button>
    <Link href="/omok" className="arena-button arena-button--outline">오목 로비</Link>
  </section>;
  const players = [
    { id: match.blackId, nickname: names[match.blackId] || '흑돌 플레이어', stone: 'black' as const },
    { id: match.whiteId, nickname: names[match.whiteId] || '백돌 플레이어', stone: 'white' as const },
  ];
  return <div className="arena-omok-live-stack">
    <OmokMatchPanel board={match.board} lastMove={match.lastMove}
      players={players} currentUserId={currentUserId} turnUserId={match.turnUserId}
      status={match.status} winnerId={match.winnerId} finishReason={match.finishReason}
      error={error} pending={pending || !!retryMove} reconnecting={reconnecting}
      rematchReadyCount={readyCount} myRematchVote={myRematchVote}
      onPlace={propose} onForfeit={forfeit}
      onRematch={kind === 'casual' && match.roomId ? rematch : undefined}
      onReturn={() => router.push(kind === 'ranked' ? '/omok/ranked' : '/omok')}/>
    {retryMove && <div role="alert" className="arena-omok-live-panel">
      <p>착수 결과가 불확실합니다. 같은 요청 번호로 재시도하거나 최신 서버 상태를 확인해 주세요.</p>
      <button type="button" className="arena-button" disabled={pending}
        onClick={() => void sendMove(retryMove)}>같은 착수 재시도</button>
      <button type="button" className="arena-button arena-button--outline"
        onClick={() => void load()}>서버 상태 다시 조회</button>
    </div>}
    <OmokChatPanel messages={messages.map(m => ({
      id: m.id, senderId: m.sender_id,
      senderName: names[m.sender_id] || '플레이어', body: m.body,
    }))} currentUserId={currentUserId} error={chatError}
      onSend={sendChat} disabled={reconnecting}/>
    {kind === 'ranked' && <p className="arena-omok-panel-hint">
      오목 랭크 점수는 정산 후 랭크 화면에서 확인할 수 있습니다. 기존 알까기 RP와 별개입니다.
    </p>}
  </div>;
}

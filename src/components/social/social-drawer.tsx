'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { friendActionRequest, friendErrorMessage, friendMutation } from '@/components/friends/friend-api';
import { MessengerView } from '@/components/messages/messenger-view';
import { inviteTime, isRoomUuid, RoomInviteError, roomInviteError, roomInviteMutation,
  type RoomInviteResponded } from '@/components/rooms/room-invite-api';
import { socialInviteGames } from '@/lib/social/inbox';
import { unreadMessages, type SocialInbox, type SocialInvite, type SocialRequest } from './social-inbox';

type Tab = 'messages' | 'invites' | 'requests';

function InboxActions({ label, pending, onRespond }: {
  label: string; pending: boolean; onRespond: (accept: boolean) => void;
}) {
  return <div className="arena-social-actions">
    <button type="button" disabled={pending} aria-label={label + ' 수락'} onClick={() => onRespond(true)}>수락</button>
    <button type="button" disabled={pending} aria-label={label + ' 거절'} onClick={() => onRespond(false)}>거절</button>
  </div>;
}

export function SocialDrawer({ inbox, pathname, loadFailed, onRefresh }: {
  inbox: SocialInbox; pathname: string; loadFailed: boolean; onRefresh: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const drawerId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('requests');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const unread = unreadMessages(inbox);
  const invites = inbox.invites.length;
  const requests = inbox.requests?.length ?? 0;
  const newItems = unread + invites + requests;

  useEffect(() => {
    if (previousPath.current !== pathname) dialog.current?.close();
    previousPath.current = pathname;
  }, [pathname]);

  function show() {
    if (!dialog.current || dialog.current.open) return;
    setTab(invites > 0 ? 'invites' : requests > 0 ? 'requests'
      : inbox.messages !== undefined ? 'messages' : inbox.inviteGames.length ? 'invites' : 'requests');
    setOpen(true);
    dialog.current.showModal();
    closeButton.current?.focus({ preventScroll: true });
    onRefresh();
  }

  function close() {
    dialog.current?.close();
  }

  async function respond(operation: () => Promise<string>, errorText: (reason: unknown) => string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure('');
    setNotice('');
    try {
      setNotice(await operation());
    } catch (reason) {
      setFailure(errorText(reason));
    } finally {
      busy.current = false;
      setPending(false);
      onRefresh();
    }
  }

  function respondInvite(invite: SocialInvite, accept: boolean) {
    const game = socialInviteGames[invite.game];
    void respond(async () => {
      const result = await roomInviteMutation<RoomInviteResponded>(
        game.api + '/' + encodeURIComponent(invite.id) + '/respond', { accept },
      );
      if (!accept && result?.status === 'declined') return '대전 초대를 거절했습니다.';
      if (!accept || result?.status !== 'accepted' || !isRoomUuid(result.roomId))
        throw new RoomInviteError(503, 'ROOM_INVITE_SERVICE_UNAVAILABLE');
      close();
      router.push(game.rooms + result.roomId);
      return '';
    }, roomInviteError);
  }

  function respondFriend(request: SocialRequest, accept: boolean) {
    void respond(async () => {
      const action = friendActionRequest({ kind: accept ? 'accept' : 'reject', ...request });
      const result = await friendMutation<{ status: string }>(action.path, action.method, action.body);
      if (result?.status !== (accept ? 'accepted' : 'rejected')) throw new Error('Invalid friend response');
      return accept ? '친구 요청을 수락했습니다.' : '친구 요청을 거절했습니다.';
    }, friendErrorMessage);
  }

  function select(tab: Tab) {
    setTab(tab);
    setFailure('');
    setNotice('');
    onRefresh();
  }

  function tabButton(value: Tab, label: string, count: number) {
    return <button type="button" aria-pressed={tab === value} onClick={() => select(value)}>
      {label}{count > 0 && <span className="arena-social-count">{count > 99 ? '99+' : count}</span>}
    </button>;
  }

  let content: ReactNode;
  if (tab === 'messages') {
    content = <MessengerView userId={inbox.userId} initialPeer={null} embedded onNavigate={close}/>;
  } else if (tab === 'invites') {
    content = <>
      {inbox.unavailableGames.length > 0 && <p role="alert" className="arena-social-error">
        {inbox.unavailableGames.map(game => socialInviteGames[game].label).join('·')} 초대를 불러오지 못했습니다.{' '}
        <button type="button" onClick={onRefresh}>다시 시도</button>
      </p>}
      {!invites && inbox.unavailableGames.length === 0 && <p className="arena-social-empty">받은 대전 초대가 없습니다.</p>}
      <ul className="arena-social-list">
        {inbox.invites.map(invite => <li key={invite.game + ':' + invite.id}>
          <div>
            <div className="arena-social-invite-heading">
              <span className={'arena-social-game arena-social-game--' + invite.game}>{socialInviteGames[invite.game].label}</span>
              <strong>{invite.inviterNickname || '친구'}</strong>
            </div>
            <time dateTime={invite.expiresAt}>만료 {inviteTime(invite.expiresAt)}</time>
          </div>
          <InboxActions label={socialInviteGames[invite.game].label + ' ' + invite.inviterNickname + '님의 초대'}
            pending={pending} onRespond={accept => respondInvite(invite, accept)}/>
        </li>)}
      </ul>
    </>;
  } else {
    content = <>
      {inbox.requests === null && <p role="alert" className="arena-social-error">
        친구 요청을 불러오지 못했습니다. <button type="button" onClick={onRefresh}>다시 시도</button>
      </p>}
      {inbox.requests?.length === 0 && <p className="arena-social-empty">받은 친구 요청이 없습니다.</p>}
      <ul className="arena-social-list">
        {inbox.requests?.map(request => <li key={request.id}>
          <Link href={'/players/' + request.userId} onClick={close}>{request.nickname}</Link>
          <InboxActions label={request.nickname + '님의 친구 요청'} pending={pending}
            onRespond={accept => respondFriend(request, accept)}/>
        </li>)}
      </ul>
    </>;
  }

  return <div className="arena-social">
    <button ref={launcher} className="arena-social-launcher" type="button" onClick={show}
      aria-label={newItems ? '친구 메신저, 새 알림 있음' : '친구 메신저'} aria-haspopup="dialog"
      aria-expanded={open} aria-controls={drawerId}>
      <span className="arena-social-icon" aria-hidden="true"><span/></span>
      {newItems > 0 && <span className="arena-social-dot" aria-hidden="true"/>}
    </button>
    <dialog ref={dialog} id={drawerId} className="arena-social-dialog" aria-labelledby={titleId}
      onClose={() => { setOpen(false); launcher.current?.focus({ preventScroll: true }); }}>
      <div className="arena-social-morph-icon" aria-hidden="true"><span className="arena-social-icon"><span/></span></div>
      <div className="arena-social-drawer">
        <header className="arena-social-header">
          <div className="arena-social-title">
            <span className="arena-social-icon" aria-hidden="true"><span/></span>
            <h2 id={titleId}>친구 메신저</h2>
          </div>
          <button ref={closeButton} className="arena-social-close" type="button" aria-label="메신저 닫기" onClick={close}>×</button>
        </header>
        <div className="arena-social-tabs" role="group" aria-label="메신저 메뉴">
          {inbox.messages !== undefined && tabButton('messages', '메시지', unread)}
          {inbox.inviteGames.length > 0 && tabButton('invites', '대전 초대', invites)}
          {tabButton('requests', '친구 요청', requests)}
        </div>
        <div className="arena-social-content">
          {loadFailed && <p role="alert" className="arena-social-error">
            알림을 새로고침하지 못했습니다. <button type="button" onClick={onRefresh}>다시 시도</button>
          </p>}
          {failure && <p role="alert" className="arena-social-error">{failure}</p>}
          {notice && <p role="status" className="arena-social-notice">{notice}</p>}
          {open && content}
        </div>
        <footer className="arena-social-footer"><Link href="/friends" onClick={close}>친구 관리 ›</Link></footer>
      </div>
    </dialog>
  </div>;
}

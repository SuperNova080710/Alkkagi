import { socialInviteGames, type SocialGame } from '@/lib/social/inbox';
import { isDmInbox, type DmInboxItem } from '@/components/messages/message-api';
import { isReceivedRoomInvite, isRoomUuid, type ReceivedRoomInvite } from '@/components/rooms/room-invite-api';

export const SOCIAL_INBOX_CHANGED = 'arena:social-inbox-changed';

export function notifySocialInboxChanged() {
  window.dispatchEvent(new Event(SOCIAL_INBOX_CHANGED));
}

export type SocialRequest = { id: string; userId: string; nickname: string };
export type SocialInvite = ReceivedRoomInvite & { game: SocialGame };
export type SocialInbox = {
  userId: string;
  requests: SocialRequest[] | null;
  messages?: DmInboxItem[] | null;
  invites: SocialInvite[];
  inviteGames: SocialGame[];
  unavailableGames: SocialGame[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRequest(value: unknown): value is SocialRequest {
  return isRecord(value) && isRoomUuid(value.id) && isRoomUuid(value.userId) &&
    typeof value.nickname === 'string';
}

export function parseSocialInbox(value: unknown, now: number): SocialInbox {
  if (!isRecord(value) || !isRoomUuid(value.userId) || !isRecord(value.invites))
    throw new Error('Invalid social inbox');

  const invites: SocialInvite[] = [];
  const inviteGames: SocialGame[] = [];
  const unavailableGames: SocialGame[] = [];
  for (const game of Object.keys(socialInviteGames) as SocialGame[]) {
    if (!Object.hasOwn(value.invites, game)) continue;
    inviteGames.push(game);
    const incoming = value.invites[game];
    if (!Array.isArray(incoming) || !incoming.every(isReceivedRoomInvite)) {
      unavailableGames.push(game);
      continue;
    }
    for (const invite of incoming) {
      if (Date.parse(invite.expiresAt) > now) invites.push({ ...invite, game });
    }
  }
  invites.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    userId: value.userId,
    requests: Array.isArray(value.requests) && value.requests.every(isRequest) ? value.requests : null,
    messages: value.messages === undefined ? undefined : isDmInbox(value.messages) ? value.messages : null,
    invites, inviteGames, unavailableGames,
  };
}

export function unreadMessages(inbox: SocialInbox) {
  return inbox.messages?.reduce((sum, thread) => sum + thread.unreadCount, 0) ?? 0;
}

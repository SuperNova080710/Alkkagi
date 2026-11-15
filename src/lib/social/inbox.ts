export const socialInviteGames = {
  alkkagi: { label: '알까기', api: '/api/room-invites', rooms: '/rooms/' },
  omok: { label: '오목', api: '/api/omok/invites', rooms: '/omok/rooms/' },
  chess: { label: '체스', api: '/api/chess/invites', rooms: '/chess/rooms/' },
} as const;

export type SocialGame = keyof typeof socialInviteGames;

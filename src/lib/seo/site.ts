/**
 * One canonical public origin for Google Search and social previews.
 * Keep it stable across Vercel deployment aliases/branch previews.
 */
export const SITE_ORIGIN = 'https://alkkagi-alpha.vercel.app';
export const SITE_NAME = 'Alkkagi Arena | 알까기 아레나';
export const SITE_TITLE = '온라인 알까기 게임 | 알까기 아레나';
export const SITE_DESCRIPTION =
  '설치 없이 브라우저에서 즐기는 온라인 1:1 알까기 게임. 친구와 방을 만들고 대결하거나 AI 연습전과 랜덤 랭크 매칭에 도전하세요.';

/** Only canonical Vercel production is eligible for indexing. */
export function isSearchProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

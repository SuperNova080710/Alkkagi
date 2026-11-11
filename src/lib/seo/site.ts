/**
 * One canonical public origin for Google Search and social previews.
 * Keep it stable across Vercel deployment aliases/branch previews.
 */
export const SITE_ORIGIN = 'https://alkkagi-alpha.vercel.app';
export const SITE_NAME = '한판아레나';
export const SITE_NAME_EN = 'HANPAN ARENA';
export const SITE_TITLE = `무료 온라인 오목·체스·알까기 게임 | ${SITE_NAME}`;
export const SITE_DESCRIPTION =
  '설치 없이 브라우저에서 오목·체스·알까기를 만나보세요. 로그인 후 이용 가능한 종목에서 친구와 일반전을 즐기거나 AI 연습전과 랭크전에 도전하세요.';

/** Only canonical Vercel production is eligible for indexing. */
export function isSearchProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

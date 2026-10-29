import Link from 'next/link';
export function PlayerFeedback({ status, retry }: { status: number; retry: () => void }) {
  return <div className="arena-directory-feedback"><p role="alert">{status === 401
    ? '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.'
    : status === 404 ? '프로필을 찾을 수 없거나 공개되지 않은 플레이어입니다.'
    : status === 400 ? '입력한 검색어나 프로필 주소를 확인해 주세요.'
    : '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}</p>
    {status === 401 ? <Link href="/login" className="arena-button">로그인하기</Link>
      : status !== 404 && status !== 400 ? <button type="button" className="arena-button arena-button--outline" onClick={retry}>다시 시도</button> : null}
    <Link href="/players" className="arena-text-link">플레이어 검색으로</Link>
  </div>;
}

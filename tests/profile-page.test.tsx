import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { maybeSingle, eq } = vi.hoisted(() => ({ maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/auth/user', () => ({ requireUser: async () => ({ id: 'signed-in-user' }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  from: () => ({ select: () => ({ eq }) }),
}) }));
vi.mock('@/components/profile/nickname-form', () => ({ NicknameForm: ({ initial }: { initial: string }) => <input aria-label="닉네임" defaultValue={initial}/> }));
import ProfilePage from '../src/app/profile/page';

describe('signed-in profile recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); eq.mockReturnValue({ maybeSingle }); });

  it('retries the protected profile page instead of sending a valid session to login', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'query unavailable' } });
    const failed = renderToStaticMarkup(await ProfilePage());
    expect(failed).toContain('잠시 후 다시 시도해 주세요');
    expect(failed).toContain('action="/profile"');
    expect(failed).toContain('method="get"');
    expect(failed).toContain('type="submit"');
    expect(failed).toContain('href="/lobby"');
    expect(failed).not.toContain('href="/login"');
    expect(failed).not.toContain('다시 로그인');
    expect(eq).toHaveBeenCalledWith('id', 'signed-in-user');

    maybeSingle.mockResolvedValue({ data: { nickname: '복구된플레이어', rating: 1234 }, error: null });
    const recovered = renderToStaticMarkup(await ProfilePage());
    expect(recovered).toContain('복구된플레이어');
    expect(recovered).toContain('1,234');
    expect(recovered).not.toContain('role="alert"');
  });

  it('distinguishes an absent profile from a temporary query error without promising re-login recovery', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain('계정에 연결된 프로필 정보가 없습니다');
    expect(html).toContain('계정 데이터 확인이 필요합니다');
    expect(html).not.toContain('잠시 후 다시 시도해 주세요');
    expect(html).not.toContain('href="/login"');
    expect(html).toContain('action="/profile"');
    expect(html).toContain('href="/lobby"');
  });
});

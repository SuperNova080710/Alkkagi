import {describe,expect,it,vi} from 'vitest';
vi.mock('@/app/profile/actions',()=>({checkNickname:vi.fn(),saveNickname:vi.fn()}));
import {renderToStaticMarkup} from 'react-dom/server';
import {NicknameForm} from '../src/components/profile/nickname-form';
describe('nickname settings UI',()=>{
 it('shows explicit availability check and disables save without verification',()=>{
  const html=renderToStaticMarkup(<NicknameForm initial="player_000000000011"/>);
  expect(html).toContain('중복 확인');
  expect(html).toContain('닉네임 저장');
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('현재 설정된 닉네임');
 });
});

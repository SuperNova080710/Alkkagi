import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('src/app/qa/two-account/page.tsx');
const view=read('src/components/qa/two-account-qa.tsx');
const proxy=read('src/proxy.ts');
const docs=read('docs/hosted-two-account-e2e.md');

describe('browser-only production A/B QA safety (#196)',()=>{
  it('fails closed unless explicitly enabled on the exact approved project',()=>{
    expect(page).toContain("process.env.OPS_TWO_ACCOUNT_QA_ENABLED!=='true'");
    expect(page).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://igjvccohxthmgbfilzxi.supabase.co'");
    expect(page).toContain('notFound()');
    expect(page.indexOf('notFound()')).toBeLessThan(page.indexOf('await requireUser()'));
    expect(page).toContain('await requireUser()');
    expect(page).toContain('index:false');
    expect(page).toContain("dynamic='force-dynamic'");
    expect(proxy).toContain("'/qa/:path*'");
  });

  it('uses only the current user SSR identity and existing same-origin API',()=>{
    expect(page).toContain('userId={user.id}');
    expect(view).toContain("credentials:'same-origin'");
    expect(view).toContain('db.auth.getUser()');
    expect(view).toContain('data.user?.id!==userId');
    expect(view).not.toContain('SUPABASE_SECRET_KEY');
    expect(view).not.toContain('SERVICE_ROLE_KEY');
    expect(view).not.toContain('auth.admin.');
    expect(view).not.toContain('signUp(');
    expect(view).not.toContain('signInWithPassword(');
    expect(view).not.toContain('.delete(');
    expect(view).not.toContain('apply_migration');
  });

  it('never initiates an approved write on mount, and requires an opt-in checkbox',()=>{
    expect(view).toContain('const [approved,setApproved]=useState(false)');
    expect(view).toContain('if(writes&&!approved)');
    expect(view).toContain('disabled={busy||disabled||(write&&!approved)}');
    expect(view).toContain('<input type="checkbox" checked={approved}');
    expect(view).toMatch(/button\('친구 요청',sendFriend,true/);
    expect(view).toMatch(/button\('A: 테스트 DM 한 건 보내기',sendMessage,true/);
    expect(view).toMatch(/button\('A: 친구 방 초대 발송',inviteFriend,true/);
    expect(view).toMatch(/button\('B: 초대 수락·seat 2 확인',acceptInvite,true/);
    expect(view).toMatch(/button\('내 기본 코스메틱 생성·장착 확인',checkCosmetics,true/);
    const effects=[...view.matchAll(/useEffect\(\(\)=>/g)];
    expect(effects).toHaveLength(1);
    expect(view).toContain('realtime.current?.cleanup()');
  });

  it('checks real B JWT Realtime INSERT equals A message ID and B API history',()=>{
    expect(view).toContain('createBrowserClient(url,key)');
    expect(view).toContain('db.realtime.setAuth(data.session.access_token)');
    expect(view).toContain("'postgres_changes'");
    expect(view).toContain("event:'INSERT'");
    expect(view).toContain("table:'dm_messages'");
    expect(view).toContain('events.some(e=>e.id===checkId&&e.body===checkMarker)');
    expect(view).toContain('history.messages.some(e=>e.id===checkId&&e.body===checkMarker)');
    expect(view).toContain('REALTIME_INSERT_NOT_OBSERVED');
  });

  it('validates ownership and XP uniqueness from a real finished casual match',()=>{
    expect(view).toContain(".eq('room_id',room)");
    expect(view).toContain("match.status!=='finished'");
    expect(view).toContain("match.mode!=='casual'");
    expect(view).toContain(".eq('source_kind','casual')");
    expect(view).toContain("rewards?.length!==1");
    expect(view).toContain('xpBefore+expected');
    expect(view).not.toContain(".from('matches').update(");
    expect(view).not.toContain(".from('xp_events').insert(");
  });

  it('does not leak credentials to QA logs or automatically delete test data',()=>{
    expect(view).not.toContain('console.log');
    expect(view).not.toContain('localStorage');
    expect(view).not.toContain('sessionStorage');
    expect(view).not.toContain('JSON.stringify(error)');
    expect(view).toContain('서버 API');
    expect(docs).toContain('OPS_TWO_ACCOUNT_QA_ENABLED');
    expect(docs).toContain('배포·환경변수 변경은 별도 승인');
  });
});

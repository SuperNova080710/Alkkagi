import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';

const path=new URL('./e2e/hosted-two-account.mjs',import.meta.url);
const source=readFileSync(path,'utf8');

describe('hosted real-account E2E safe runner (#196)',()=>{
  it('is a valid Node 24 module without requiring user credentials',()=>{
    const result=spawnSync(process.execPath,['--check',path.pathname],{encoding:'utf8',timeout:10000});
    expect(result.status,result.stderr).toBe(0);
  });
  it('pins exact production project and accepts only publishable/anon API keys',()=>{
    expect(source).toContain("https://igjvccohxthmgbfilzxi.supabase.co");
    expect(source).toContain("payload.role,'anon'");
    expect(source).toContain("key.startsWith('sb_publishable_')");
    expect(source).not.toMatch(/createClient\([^,]*,\s*process\.env\.SUPABASE_SECRET_KEY/);
    expect(source).not.toMatch(/\.auth\.admin\./);
    expect(source).not.toMatch(/\.auth\.signUp\(/);
  });
  it('requires local TTY credentials and explicit consent before writes',()=>{
    expect(source).toContain('process.stdin.isTTY');
    expect(source).toContain('process.stdout.isTTY');
    expect(source).toContain('--approved-writes');
    expect(source).toContain("if(mode==='prepare')");
    expect(source).not.toMatch(/process\.env\.(E2E_PASSWORD|E2E_EMAIL|SERVICE_ROLE_KEY)/);
  });
  it('uses real user RPC and RLS instead of privileged database writes',()=>{
    for(const functionName of [
      'send_friend_request','respond_friend_request','send_direct_message',
      'create_casual_room','send_room_friend_invite',
      'respond_room_friend_invite','get_my_cosmetics','get_player_experience',
    ])expect(source).toContain(functionName);
    expect(source).not.toMatch(/\.from\(['"]matches['"]\)\.update\(/);
    expect(source).not.toMatch(/\.from\(['"]xp_events['"]\)\.insert\(/);
    expect(source).not.toMatch(/\.from\(['"]auth\.users['"]\)/);
    expect(source).not.toMatch(/\.from\(['"]\w+['"]\)\.delete\(/);
  });
  it('requires a WebSocket event with the same DM ID, not just a successful RPC',()=>{
    expect(source).toContain("'postgres_changes'");
    expect(source).toContain("event:'INSERT'");
    expect(source).toContain("events.get(body)===String(sent.id)");
    expect(source).toContain("REALTIME_NOT_DELIVERED");
  });
  it('writes only private local state and does not revoke other sessions',()=>{
    expect(source).toContain("mode:0o700");
    expect(source).toContain("mode:0o600,flag:'wx'");
    expect(source).toContain("scope:'local'");
    expect(source).not.toContain('uploadArtifact');
    expect(source).not.toContain('apply_migration');
  });
});

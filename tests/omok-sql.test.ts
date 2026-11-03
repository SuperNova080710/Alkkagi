import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../supabase/migrations/202611030001_omok_casual.sql', import.meta.url), 'utf8');

describe('Omok schema contract (static; PG17 execution is a separate integration gate)', () => {
  it('introduces distinct Omok tables without rewriting Alkkagi matches', () => {
    for (const table of ['omok_rooms','omok_room_players','omok_matches','omok_moves']) {
      expect(sql).toContain('create table public.' + table);
      expect(sql).toContain('alter table public.' + table + ' enable row level security');
    }
    expect(sql).not.toMatch(/alter table public\.(matches|shots|ranked_queue|profiles)\b/i);
  });

  it('keeps writes in authenticated and verified SQL RPCs', () => {
    for (const func of [
      'create_omok_room', 'join_omok_room', 'get_omok_room', 'leave_omok_room',
      'start_omok_match', 'play_omok_move', 'forfeit_omok_match',
    ]) {
      expect(sql).toContain('create function public.' + func);
    }
    expect(sql).toMatch(/revoke all on public\.omok_rooms,public\.omok_room_players,public\.omok_matches,public\.omok_moves/);
    expect(sql).toMatch(/from public,anon,authenticated/);
    expect(sql).toMatch(/to authenticated;/);
    expect(sql).toMatch(/select \* into game from public\.omok_matches where id=p_match_id for update/);
    expect(sql).toMatch(/unique\(match_id,request_id\)/);
    expect(sql).toMatch(/if game\.turn_no<>p_turn/);
    expect(sql).toMatch(/if game\.board->idx <> 'null'::jsonb/);
  });

  it('uses membership checks without recursive seat RLS', () => {
    expect(sql).toContain('create policy omok_room_players_self');
    expect(sql).not.toContain('create policy omok_room_players_members');
    expect(sql).toContain('using(user_id=(select auth.uid()))');
    expect(sql).toContain('create policy omok_matches_members');
  });
});

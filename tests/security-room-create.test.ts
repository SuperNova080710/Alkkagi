import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const actorA = '11111111-1111-4111-8111-111111111111';
const actorB = '22222222-2222-4222-8222-222222222222';
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = (i: number) => 'ABCDEFG' + chars[i];

async function buildDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users(id) values
      ('${actorA}'), ('${actorB}');
  `);
  for (const migration of [
    '202610280001_initial_schema.sql',
    '202610280002_casual_rooms.sql',
    '202610290004_security_room_create_limits.sql',
  ]) {
    await db.exec(readFileSync(
      new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8',
    ));
  }
  return db;
}

async function as(db: PGlite, id: string) {
  await db.exec(`reset role;
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${id}', false);
  `);
}

async function createRoom(db: PGlite, i: number) {
  const result = await db.query<{ create_casual_room: string }>(
    'select public.create_casual_room($1::text) as create_casual_room',
    [roomCode(i)],
  );
  return result.rows[0].create_casual_room;
}

async function leaveRoom(db: PGlite, id: string) {
  await db.query('select public.leave_casual_room($1::uuid)', [id]);
}

describe('Security S1: server-side limits for direct room creation RPC', () => {
  it('keeps the existing authenticated RPC contract and denies anonymous calls/table writes', async () => {
    const db = await buildDatabase();
    try {
      await as(db, actorA);
      const roomId = await createRoom(db, 0);
      expect(roomId).toMatch(/^[0-9a-f-]{36}$/i);

      await expect(db.query(
        "insert into public.rooms(code, owner_id) values ('ABCDEFGH', $1::uuid)",
        [actorA],
      )).rejects.toThrow(/permission denied/i);

      await db.exec('reset role; set role anon;');
      await expect(db.query(
        "select public.create_casual_room('ABCDEFGJ')",
      )).rejects.toThrow(/permission denied/i);
    } finally {
      await db.close();
    }
  }, 30000);

  it('blocks a sixth live waiting room without creating a partial room', async () => {
    const db = await buildDatabase();
    try {
      await as(db, actorA);
      for (let i = 0; i < 5; i++) await createRoom(db, i);
      await expect(createRoom(db, 5)).rejects.toThrow('ROOM_ACTIVE_LIMIT');

      await db.exec('reset role;');
      const counts = await db.query<{ total: string }>(
        'select count(*)::text as total from public.rooms',
      );
      expect(counts.rows[0].total).toBe('5');
      const seats = await db.query<{ total: string }>(
        'select count(*)::text as total from public.room_players',
      );
      expect(seats.rows[0].total).toBe('5');
    } finally {
      await db.close();
    }
  }, 30000);

  it('enforces 10 creations per 10 minutes even after closing rooms; limits are per owner', async () => {
    const db = await buildDatabase();
    try {
      await as(db, actorA);
      for (let i = 0; i < 10; i++) {
        const roomId = await createRoom(db, i);
        await leaveRoom(db, roomId);
      }
      await expect(createRoom(db, 10)).rejects.toThrow('ROOM_RATE_LIMIT');

      await as(db, actorB);
      expect(await createRoom(db, 10)).toMatch(/^[0-9a-f-]{36}$/i);

      await db.exec('reset role;');
      const counts = await db.query<{ id: string; total: string }>(
        `select owner_id as id, count(*)::text as total
         from public.rooms group by owner_id order by owner_id`,
      );
      expect(counts.rows).toEqual([
        { id: actorA, total: '10' },
        { id: actorB, total: '1' },
      ]);
    } finally {
      await db.close();
    }
  }, 30000);

  it('validates the invite code before changing state and retains the per-user row lock', async () => {
    const db = await buildDatabase();
    try {
      await as(db, actorA);
      await expect(db.query(
        "select public.create_casual_room('ABCD123')",
      )).rejects.toThrow('INVALID_CODE');
      expect(await createRoom(db, 0)).toMatch(/^[0-9a-f-]{36}$/i);
    } finally {
      await db.close();
    }

    // PGlite uses a single connection; a real multi-connection race test
    // remains separate. Assert the migration retains its serialization guard.
    const migration = readFileSync(new URL(
      '../supabase/migrations/202610290004_security_room_create_limits.sql',
      import.meta.url,
    ), 'utf8');
    expect(migration).toMatch(/from public\.profiles where id = v_user for update/i);
    expect(migration).toMatch(/v_checked_at := clock_timestamp\(\)/);
  }, 30000);
});

import { describe, expect, it } from 'vitest';
import {
  createOmokInviteCode, isOmokUuid, normalizeOmokInvite, parseOmokMove, parseOmokMessage, omokRpcError,
} from '../src/lib/omok/http';

describe('Omok API input contracts', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('validates strict identifiers and invite codes', () => {
    expect(isOmokUuid(id)).toBe(true);
    for (const invalid of ['', '111', '../secret', 'g'.repeat(36), null]) {
      expect(isOmokUuid(invalid)).toBe(false);
    }
    expect(normalizeOmokInvite('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeOmokInvite(' AB CD EF GH ')).toBe('ABCDEFGH');
    for (const invalid of [null, 'OOOOOOOO', '11111111', 'abc', 'ab&cdefg']) {
      expect(normalizeOmokInvite(invalid)).toBeNull();
    }
    for (let i = 0; i < 20; i++) expect(normalizeOmokInvite(createOmokInviteCode())).toHaveLength(8);
  });

  it('accepts only bounded, integer move inputs with a request UUID', () => {
    const valid = { requestId:id,turnNo:1,row:0,col:14 };
    expect(parseOmokMove(valid)).toEqual(valid);
    for (const input of [
      null, [], {}, { ...valid, row:-1 }, { ...valid, col:15 },
      { ...valid, row:0.5 }, { ...valid, col:NaN },
      { ...valid, turnNo:0 }, { ...valid, turnNo:226 },
      { ...valid, turnNo:'1' }, { ...valid, requestId:'invalid' },
    ]) expect(parseOmokMove(input)).toBeNull();
  });

  it('bounds and trims chat messages', () => {
    expect(parseOmokMessage({ body: ' hello ', requestId:id }))
      .toEqual({ body:'hello', requestId:id });
    for(const invalid of [{body:' ',requestId:id},{body:'x'.repeat(281),requestId:id},
      {body:'fine',requestId:'x'},null,[]]) expect(parseOmokMessage(invalid)).toBeNull();
  });

  it('does not leak unexpected database errors to clients', () => {
    expect(omokRpcError({message:'ROOM_FULL'})).toEqual({error:'ROOM_FULL',status:409});
    expect(omokRpcError({message:'permission denied for table private.admin'}))
      .toEqual({error:'GAME_SERVICE_UNAVAILABLE',status:503});
  });
});

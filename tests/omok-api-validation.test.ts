import { describe, expect, it } from 'vitest';
import { isUuid, normalizeOmokRoomCode, parseOmokMoveRequest } from '../src/lib/omok/validation';
const id='11111111-1111-4111-8111-111111111111';

describe('Omok server request input boundaries',()=>{
  it('normalizes only valid 8-character room codes',()=>{
    expect(normalizeOmokRoomCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeOmokRoomCode('ABCD\nEFGH')).toBe('ABCDEFGH');
    for(const invalid of [null,1,{},'','AAAAAAA','ABCDEFGHI','AAAA0AAA','OOOOOOOO','IIIIIIII'])
      expect(normalizeOmokRoomCode(invalid)).toBeNull();
  });
  it('validates UUID match and request IDs',()=>{
    expect(isUuid(id)).toBe(true);
    expect(isUuid('bad')).toBe(false);
  });
  it('accepts legal edge intersections and turn counter',()=>{
    expect(parseOmokMoveRequest({turnNo:1,requestId:id,row:0,col:0}))
      .toEqual({turnNo:1,requestId:id,row:0,col:0});
    expect(parseOmokMoveRequest({turnNo:225,requestId:id,row:14,col:14})?.turnNo).toBe(225);
  });
  it('rejects malformed, out-of-range or forged request values',()=>{
    const valid={turnNo:1,requestId:id,row:0,col:0};
    for(const patch of [
      {turnNo:0},{turnNo:226},{turnNo:1.5},{turnNo:'1'},
      {row:-1},{row:15},{row:NaN},{row:2.5},{row:'0'},
      {col:-1},{col:15},{col:Infinity},{col:'1'},
      {requestId:'invalid'},{requestId:0},
    ]) expect(parseOmokMoveRequest({...valid,...patch})).toBeNull();
    expect(parseOmokMoveRequest(null)).toBeNull();
    expect(parseOmokMoveRequest([])).toBeNull();
  });
});

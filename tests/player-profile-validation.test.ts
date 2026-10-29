import {describe,it,expect} from 'vitest';
import {PLAYER_UUID,playerSearchLimit,playerSearchQuery,playerVisibilitySettings}
 from '../src/lib/players/validation';

describe('Player API input validation and safe contract',()=>{
 it('validates IDs without accepting suffix injection',()=>{
  expect(PLAYER_UUID.test('00000000-0000-0000-0000-000000000011')).toBe(true);
  for(const id of ['','not-a-uuid','00000000-0000-0000-0000-000000000011?q=1']){
   expect(PLAYER_UUID.test(id)).toBe(false);
  }
 });
 it('accepts only useful nickname terms, trims whitespace, preserves literal underscores',()=>{
  expect(playerSearchQuery(' 오리온 ')).toBe('오리온');
  expect(playerSearchQuery('Alpha__One')).toBe('Alpha__One');
  for(const invalid of [null,'','a','%','%_','ab%','a/b','x'.repeat(25),'😄']){
   expect(playerSearchQuery(invalid)).toBe(null);
  }
 });
 it('caps results and rejects malformed limits',()=>{
  expect(playerSearchLimit(null)).toBe(10);
  expect(playerSearchLimit('1')).toBe(1);
  expect(playerSearchLimit('20')).toBe(20);
  for(const invalid of ['','0','21','2.5','10abc','-1','100','1e2']){
   expect(playerSearchLimit(invalid)).toBe(null);
  }
 });
 it('requires exactly two boolean visibility settings',()=>{
  expect(playerVisibilitySettings({discoverable:true,showRankedStats:false})).toBe(true);
  for(const invalid of [null,[],{}, {discoverable:1,showRankedStats:false},
   {discoverable:true,showRankedStats:null},
   {discoverable:true,showRankedStats:false,user_id:'victim'}]){
   expect(playerVisibilitySettings(invalid)).toBe(false);
  }
 });
});

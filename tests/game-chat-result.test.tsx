import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/app/ranked/actions',()=>({changeRankedQueue:vi.fn()}));
vi.mock('@/app/matches/chat-actions',()=>({sendMatchMessage:vi.fn()}));
import {GameResult} from '../src/components/game/game-result';
import {MatchChat} from '../src/components/game/match-chat';
const a='00000000-0000-0000-0000-000000000011';
const b='11111111-1111-1111-1111-111111111112';
const base={
 mode:'casual' as const,matchId:'00000000-0000-0000-0000-000000001234',
 roomId:'00000000-0000-0000-0000-000000002345',
 winnerId:a,userId:a,rating:null,rematchReadyCount:0,myRematchVote:false,
 rematchAction:()=>{},rematchPending:false,rematchError:'',animating:false,
};
describe('game result overlay and in-match chat SSR',()=>{
 it('shows win then lobby/rematch actions below the outcome',()=>{
  const html=renderToStaticMarkup(<GameResult {...base}/>);
  expect(html).toContain('승리');
  expect(html.indexOf('승리')).toBeLessThan(html.indexOf('로비로 돌아가기'));
  expect(html.indexOf('로비로 돌아가기')).toBeLessThan(html.indexOf('재도전 · 다시하기'));
  expect(html).toContain('0/2');
 });
 it('shows loss with authoritative ranked delta and requeue button',()=>{
  const html=renderToStaticMarkup(<GameResult {...base} mode="ranked" winnerId={b}
   rating={{before_rating:1000,after_rating:984,delta:-16}}/>);
  expect(html).toContain('패배');
  expect(html).toContain('-16');
  expect(html).toContain('1,000');
  expect(html).toContain('984');
  expect(html).toContain('재도전 · 새 랭크 매칭');
 });
 it('shows draw and pending settlement explicitly',()=>{
  const html=renderToStaticMarkup(<GameResult {...base} mode="ranked"
   winnerId={null} rating={null}/>);
  expect(html).toContain('무승부');
  expect(html).toContain('정산 결과 확인 중');
 });
 it('labels own and opponent messages with safe text',()=>{
  const html=renderToStaticMarkup(<MatchChat matchId={base.matchId} userId={a}
   firstPlayerId={a} secondPlayerId={b}
   players={[{seat:1,nickname:'나비'},{seat:2,nickname:'태양'}]}
   messages={[{id:'1',sender_id:a,body:'안녕',created_at:'2026-10-29T00:00:00Z'},
   {id:'2',sender_id:b,body:'<script>alert(1)</script>',created_at:'2026-10-29T00:00:01Z'}]}
   status="active"/>);
  expect(html).toContain('대전 채팅');
  expect(html).toContain('태양');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('maxLength="280"');
 });
});

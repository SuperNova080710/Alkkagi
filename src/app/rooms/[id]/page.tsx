import Link from 'next/link';
import {CopyInvite} from '@/components/rooms/copy-invite';
import {notFound,redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';
import {validBoard} from '@/lib/game/engine';
import {GameBoard} from '@/components/game/game-board';
import {RoomRefresh} from '@/components/rooms/room-refresh';
import {AddAiOpponent} from '@/components/rooms/add-ai-opponent';
import {SendFriendRoomInvite} from '@/components/rooms/send-friend-room-invite';
import {leaveRoom} from '../actions';
import {startGame} from '../start';
import {type TurnShot} from '@/lib/game/turn-history';
export const dynamic='force-dynamic';
type Room={id:string;code:string;status:string;yourSeat:number;rematchReadyCount?:number;myRematchVote?:boolean;players:{seat:number;nickname:string}[]};
export default async function RoomPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
 const user=await requireUser();
 const {id}=await params,query=await searchParams;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const {data,error}=await db.rpc('get_casual_room',{p_room_id:id});
 if(error||!data||typeof data!=='object'||Array.isArray(data))notFound();
 const room=data as Room;
 if(!Array.isArray(room.players))notFound();
 const {data:aiMatch}=await db.from('ai_matches').select('room_id').eq('room_id',id).maybeSingle();
 if(aiMatch)redirect('/rooms/'+id+'/ai');
 const {data:match}=await db.from('matches').select('id,status,turn_user_id,turn_no,player1_id,player2_id,winner_id,board_state,turn_deadline,finished_at')
  .eq('room_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 const [{data:history},{data:chatHistory}]=match?await Promise.all([db.from('shots')
  .select('id,turn_no,player_id,piece_id,input,result_state,created_at')
  .eq('match_id',match.id).order('turn_no',{ascending:false}).limit(100),
  db.from('match_messages').select('id,sender_id,body,created_at')
   .eq('match_id',match.id).order('created_at',{ascending:false}).limit(100)
 ]):[{data:null},{data:null}];
 const shots=((history??[]) as TurnShot[]).reverse();
 const messages=((chatHistory??[]) as import('@/components/game/match-chat').MatchMessage[]).reverse();
 const hasMatch=Boolean(match&&validBoard(match.board_state));
 return <div className={hasMatch ? 'arena arena-match' : 'arena'}>
  <main className={hasMatch
   ? 'game-page game-page--playing mx-auto max-w-6xl px-4 py-4 sm:px-6'
   : 'arena-waiting arena-waiting--v2 mx-auto max-w-5xl px-4 py-5 sm:px-6'}>
   <Link href="/lobby" className="game-page-back arena-room-back">← 로비로 돌아가기</Link>
   <header className="game-page-header arena-room-heading">
    <div><p className="arena-section-kicker">CASUAL MATCH · ALKKAGI ARENA</p>
     <h1>친구와 한 판</h1>
     {!hasMatch && <p className="arena-room-lead">친구를 초대하거나 AI를 추가해 승부를 시작하세요.</p>}
    </div>
    {hasMatch ? <div className="arena-room-playing-code"><p>초대 코드</p><strong>{room.code}</strong></div>
      : <CopyInvite code={room.code}/>}
   </header>
   {match&&validBoard(match.board_state)
    ? <GameBoard key={match.id} match={{...match,board_state:match.board_state}} userId={user.id}
       roomId={room.id} players={room.players} rematchReadyCount={room.rematchReadyCount??0}
       myRematchVote={room.myRematchVote??false} shots={shots} messages={messages}
       cosmeticsEnabled={process.env.COSMETICS_UI_ENABLED === 'true'}/>
    : <div className="arena-room-wait-layout">
      <section className="arena-panel arena-room-stage" aria-labelledby="room-stage-heading">
       <div className="arena-room-stage-head">
        <h2 id="room-stage-heading">참가자 <span>{room.players.length}/2</span></h2>
        <span className="arena-room-status">{room.status==='waiting'?'대기 중':'방 상태 확인'}</span>
       </div>
       <ol className="arena-room-seats">
        {[1,2].map(seat=><li key={seat} className={room.yourSeat===seat?'is-mine':''}>
         <span className="arena-room-seat-number">{seat===1?'01':'02'}</span>
         <div><span className="arena-room-seat-role">{seat===1?'선공':'후공'}</span>
          <strong>{room.players.find(p=>p.seat===seat)?.nickname??'친구 기다리는 중'}</strong>
          {room.yourSeat===seat&&<span className="arena-room-self">나</span>}
         </div>
        </li>)}
       </ol>
       <RoomRefresh roomId={id}/>
       {room.status==='waiting'&&room.players.length===2&&room.yourSeat===1&&
        <form action={startGame} className="arena-room-main-action">
         <input type="hidden" name="id" value={id}/>
         <button type="submit" className="arena-button arena-button--gold">경기 시작</button>
        </form>}
       {room.status==='waiting'&&room.players.length<2&&
        <p className="arena-room-wait-note">초대 코드 또는 친구 초대를 전달하면 상대가 참가할 수 있습니다.</p>}
       {room.status==='waiting'&&<form action={leaveRoom} className="arena-room-leave">
        <input type="hidden" name="id" value={id}/>
        <button type="submit" className="arena-button arena-button--outline">
         {room.yourSeat===1?'방 닫기':'방 나가기'}
        </button>
       </form>}
       {query.error&&<p role="alert" className="arena-invite-error">
        경기를 시작할 수 없습니다. 새로고침 후 다시 시도해 주세요.</p>}
      </section>
      {room.status==='waiting'&&room.players.length<2&&room.yourSeat===1&&
       <aside className="arena-room-side" aria-label="상대 추가">
        {process.env.ROOM_INVITES_UI_ENABLED==='true'&&process.env.FRIENDS_UI_ENABLED==='true'&&
         <SendFriendRoomInvite roomId={room.id}/>}
        <AddAiOpponent roomId={room.id}/>
       </aside>}
     </div>}
  </main>
 </div>;
}

'use client';

import { useRef, useState } from 'react';
import { OmokChatPanel } from '@/components/omok/omok-match-panels';
import { chessRequest, useChessSnapshot } from './client';

type Message = {id:string; sender_id:string; body:string};

export function ChessMatchChat({matchId,userId}: {matchId:string; userId:string}) {
  const path='/matches/'+matchId+'/messages';
  const {data,error,refresh}=useChessSnapshot<Message[]>(path,matchId,'messages');
  const [sendError,setSendError]=useState('');
  const retry=useRef<{body:string; requestId:string} | null>(null);
  const sending=useRef(false);

  async function send(body:string) {
    if (sending.current) return false;
    sending.current=true;
    setSendError('');
    try {
      if (retry.current?.body!==body) retry.current={body,requestId:crypto.randomUUID()};
      await chessRequest<{id:string}>(path,retry.current);
      retry.current=null;
      await refresh();
      return true;
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : '메시지를 전송하지 못했습니다.');
      return false;
    } finally {
      sending.current=false;
    }
  }

  return <OmokChatPanel game="chess" currentUserId={userId}
    messages={(data ?? []).map(message=>({
      id:message.id,senderId:message.sender_id,senderName:'상대',body:message.body,
    }))}
    error={sendError || error} onSend={send}/>;
}

'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';

export type RematchState = { error: string };
export async function requestRematch(previous: RematchState, formData: FormData): Promise<RematchState> {
 void previous;
 await requireUser();
 const roomId = formData.get('roomId');
 if (typeof roomId !== 'string' ||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId))
  return { error: '올바르지 않은 방입니다.' };
 try {
  const { error } = await (await createClient()).rpc('request_casual_rematch', { p_room_id: roomId });
  if (error) return { error: '재대전 요청을 처리하지 못했습니다. 방에 다시 입장해 주세요.' };
 } catch { return { error: '재대전 서버에 연결하지 못했습니다.' }; }
 revalidatePath('/rooms/' + roomId);
 redirect('/rooms/' + roomId);
}

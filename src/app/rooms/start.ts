'use server';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {createClient} from '@/lib/supabase/server';

export async function startGame(form:FormData):Promise<void>{
 await requireUser();
 const id=form.get('id');
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))redirect('/lobby');
 let success=false;
 try{
  const {error}=await (await createClient()).rpc('start_casual_match',{p_room_id:id});
  success=!error;
 }catch{success=false;}
 redirect('/rooms/'+id+(success?'':'?error=start'));
}

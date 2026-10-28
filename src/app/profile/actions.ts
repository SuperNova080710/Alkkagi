'use server';
import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { validNickname } from '@/lib/profile/nickname';
type NicknameResponse={
 success:boolean;
 message:string;
 nickname?:string;
};
function dbError(message:string):string {
 if(message.includes('NICKNAME_TAKEN')||message.includes('profiles_nickname_unique_ci')||message.includes('duplicate key'))
  return '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.';
 if(message.includes('NICKNAME_INVALID')||message.includes('profiles_nickname_format'))
  return '닉네임 형식이 올바르지 않습니다.';
 return '현재 닉네임을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.';
}
export async function checkNickname(value:string):Promise<NicknameResponse>{
 await requireUser();
 if(!validNickname(value))return {success:false,message:'한글·영문·숫자·밑줄(_) 2~24자로 입력하세요.'};
 try {
  const {data,error}=await (await createClient()).rpc('check_nickname_available',{p_nickname:value});
  if(error)return {success:false,message:dbError(error.message)};
  return data===true
   ?{success:true,message:'사용 가능한 닉네임입니다.'}
   :{success:false,message:'이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.'};
 }catch{return {success:false,message:'중복 확인 서버에 연결하지 못했습니다.'};}
}
export async function saveNickname(value:string):Promise<NicknameResponse>{
 await requireUser();
 if(!validNickname(value))return {success:false,message:'한글·영문·숫자·밑줄(_) 2~24자로 입력하세요.'};
 try{
  const {data,error}=await (await createClient()).rpc('set_my_nickname',{p_nickname:value});
  if(error)return {success:false,message:dbError(error.message)};
  if(typeof data!=='string')return {success:false,message:'닉네임 저장 결과를 확인할 수 없습니다.'};
  return {success:true,message:'닉네임을 저장했습니다.',nickname:data};
 }catch{return {success:false,message:'닉네임 저장 중 연결 오류가 발생했습니다.'};}
}

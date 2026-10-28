import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
export function createAdminClient(){
 const config=getSupabaseConfig(),key=process.env.SUPABASE_SECRET_KEY;
 if(!config||!key)throw new Error('Server game credentials missing');
 return createClient(config.url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

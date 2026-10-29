import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { NicknameForm } from '@/components/profile/nickname-form';
import { ProfileView } from '@/components/profile/profile-view';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const user = await requireUser();
  const { data: profile, error } = await (await createClient())
    .from('profiles').select('nickname,rating').eq('id', user.id).maybeSingle();
  if (error || !profile) return <ProfileView profile={null}/>;
  return <ProfileView profile={profile} editor={<NicknameForm initial={profile.nickname}/>}/>;
}

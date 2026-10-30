import { requireUser } from '@/lib/auth/user';
import { createClient } from '@/lib/supabase/server';
import { NicknameForm } from '@/components/profile/nickname-form';
import { ProfileView } from '@/components/profile/profile-view';
import { VisibilitySettings } from '@/components/profile/visibility-settings';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const user = await requireUser();
  const { data: profile, error } = await (await createClient())
    .from('profiles').select('nickname,rating').eq('id', user.id).maybeSingle();
  if (error) return <ProfileView profile={null} unavailableReason="query-error"/>;
  if (!profile) return <ProfileView profile={null} unavailableReason="missing"/>;
  return <ProfileView profile={profile} editor={<NicknameForm initial={profile.nickname}/>} settings={<VisibilitySettings/>} experienceEnabled={process.env.EXPERIENCE_UI_ENABLED === "true"}/>;
}

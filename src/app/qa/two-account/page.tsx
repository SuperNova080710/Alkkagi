import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth/user';
import {ArenaShell} from '@/components/ui/arena';
import {TwoAccountQa} from '@/components/qa/two-account-qa';
import {resolveQaPair} from '@/lib/qa/two-account-guards';

export const dynamic='force-dynamic';
export const metadata={title:'운영 2계정 QA',robots:{index:false,follow:false}};

// This is deliberately OFF on all deployments until the operator explicitly
// approves a separate QA deployment and sets the server-only environment gate.
// A production Supabase URL alone is NEVER sufficient to expose this page.
export default async function TwoAccountQaPage(){
  if(process.env.OPS_TWO_ACCOUNT_QA_ENABLED!=='true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://igjvccohxthmgbfilzxi.supabase.co')
    notFound();
  const user=await requireUser();
  const pair=resolveQaPair(process.env.OPS_TWO_ACCOUNT_QA_USER_IDS,user.id);
  if(!pair)notFound();
  return <ArenaShell current="lobby">
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header><p className="text-xs uppercase tracking-widest">Operator only · manual test</p>
        <h1 className="text-2xl font-bold">운영 2계정 E2E 검증</h1>
        <p>기존 계정 A/B로 서로 다른 브라우저에서 접속하세요. 모든 쓰기는 명시적인 버튼을 눌러야 실행됩니다.</p>
      </header>
      <TwoAccountQa userId={user.id} pair={pair}/>
    </div>
  </ArenaShell>;
}

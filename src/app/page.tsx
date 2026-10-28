import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 sm:px-12">
      <p className="text-sm font-bold tracking-[0.2em] text-emerald-300">ALKKAGI ARENA</p>
      <h1 className="mt-6 text-5xl leading-tight font-black tracking-tight sm:text-7xl">
        알 다섯 개.<br />한 판의 승부.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
        친구와 마주 앉아 즐기던 알까기, 이제 브라우저에서 만납니다.
        방향을 잡고, 힘을 조절하고, 상대의 알을 밀어내세요.
      </p>
      <div className="mt-8 flex gap-4"><Link href="/login" className="rounded-lg bg-emerald-300 px-6 py-3 font-bold text-slate-950">로그인</Link><Link href="/signup" className="rounded-lg border border-slate-600 px-6 py-3 font-bold">회원가입</Link></div>
      <section aria-labelledby="status-title" className="mt-12 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-sm font-semibold text-emerald-300">개발 중</span>
        <h2 id="status-title" className="mt-5 text-xl font-bold">첫 대전을 준비하고 있습니다</h2>
        <p className="mt-3 leading-7 text-slate-300">
          회원가입과 로그인으로 계정을 준비하세요. 방 만들기와 대전 기능은 순차적으로 추가됩니다.
        </p>
        <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
          <li className="rounded-lg bg-slate-800 p-4">01 · 친구와 1:1 일반전</li>
          <li className="rounded-lg bg-slate-800 p-4">02 · 초대 코드로 방 참가</li>
          <li className="rounded-lg bg-slate-800 p-4">03 · 랭크 매칭과 순위 경쟁</li>
        </ul>
      </section>
      <p className="mt-8 text-sm text-slate-400">설치 없이, 브라우저에서. 실제 플레이는 추후 제공됩니다.</p>
    </main>
  );
}

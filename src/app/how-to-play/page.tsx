import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArenaShell } from '@/components/ui/arena';

export const metadata: Metadata = {
  title: '알까기 게임 규칙·조작법 | 알까기 아레나',
  description: '온라인 알까기 게임을 처음 시작하나요? 알 5개로 승부하는 규칙, 마우스·터치·키보드 조작, 방 코드 참가, AI 연습전과 랭크전의 차이를 알아보세요.',
  alternates: { canonical: 'https://alkkagi-alpha.vercel.app/how-to-play' },
  robots: process.env.VERCEL_ENV === 'production'
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

const steps = [
  {
    number: '01',
    title: '내 알을 고르세요',
    body: '자기 차례에 남아 있는 내 알을 선택합니다. 시작할 때는 각자 5개씩 가지고 있습니다.',
  },
  {
    number: '02',
    title: '반대 방향으로 당기세요',
    body: '선택한 알을 발사하려는 방향의 반대로 드래그한 뒤 놓습니다. 당긴 거리로 세기를 조절합니다.',
  },
  {
    number: '03',
    title: '상대 알을 밖으로 밀어내세요',
    body: '알끼리 부딪치면 움직입니다. 보드 밖으로 나간 알은 탈락하며, 자기 알도 떨어질 수 있습니다.',
  },
] as const;

const modes = [
  {
    label: '일반전',
    headline: '친구와 약속한 한 판',
    body: '방을 만들면 8자리 초대 코드가 생성됩니다. 친구가 코드를 입력해 참가하면 방장이 경기를 시작할 수 있습니다.',
    tone: 'casual',
  },
  {
    label: 'AI 연습전',
    headline: '내 속도로 조준 연습',
    body: '로비에서 AI 연습방을 만든 다음 대기실에서 AI 상대를 추가하세요. 쉬움·보통·어려움 중 난이도를 고를 수 있으며 랭크 RP에는 반영되지 않습니다.',
    tone: 'ai',
  },
  {
    label: '랭크전',
    headline: '다른 플레이어와 순위 경쟁',
    body: '랭크 메뉴에서 매칭을 시작합니다. 경기 결과가 RP와 랭킹에 반영되며, 일반전·AI 연습전은 RP에 영향을 주지 않습니다.',
    tone: 'ranked',
  },
] as const;

const faqs = [
  {
    question: '게임을 설치해야 하나요?',
    answer: '아니요. 브라우저에서 플레이할 수 있습니다. 대전방에 들어가려면 회원가입 및 로그인이 필요합니다.',
  },
  {
    question: '마우스가 없어도 조작할 수 있나요?',
    answer: '터치 화면에서는 손가락으로 알을 뒤로 끌어 발사할 수 있습니다. 게임 화면의 「키보드 조작」을 열어 알·방향·세기를 선택하고 발사하는 방법도 있습니다.',
  },
  {
    question: '내 알도 보드 밖으로 떨어질 수 있나요?',
    answer: '네. 자기 알도 충돌이나 발사로 밖에 나가면 탈락합니다. 상대 알이 모두 없어지고 내 알이 남으면 이기며, 두 사람의 알이 모두 없으면 무승부입니다.',
  },
  {
    question: '친구와 하려면 어디서 코드를 입력하나요?',
    answer: '로그인 후 로비에서 「방 만들기 · 코드로 참가」를 선택하세요. 받은 8자리 코드를 입력하면 친구의 방에 참가할 수 있습니다.',
  },
  {
    question: 'AI와 연습하면 랭킹 점수가 바뀌나요?',
    answer: '아니요. AI 연습전과 일반전은 랭크 RP에 영향을 주지 않습니다. RP 순위를 겨루려면 랭크전 매칭을 이용하세요.',
  },
] as const;

export default function HowToPlayPage() {
  return <ArenaShell>
    <article className="arena-guide">
      <header className="arena-guide-hero">
        <div className="arena-guide-hero-copy">
          <p className="arena-section-kicker">ALKKAGI PLAYBOOK · 처음 시작하는 분께</p>
          <h1>알까기, 어떻게 하는 게임인가요?</h1>
          <p>다섯 개의 알로 시작하는 한 판. 내 알을 튕겨 상대 알을 보드 밖으로 밀어내는 온라인 대전입니다.</p>
          <nav className="arena-guide-jump" aria-label="가이드 목차">
            <a href="#guide-controls">조작법</a>
            <a href="#guide-modes">대전 종류</a>
            <a href="#guide-faq">자주 묻는 질문</a>
          </nav>
          <div className="arena-guide-cta">
            <Link href="/lobby" className="arena-button">로그인하고 대전 시작 <span aria-hidden="true">›</span></Link>
            <Link href="/" className="arena-guide-home-link">홈으로 돌아가기</Link>
          </div>
        </div>
        <div className="arena-guide-hero-visual" aria-hidden="true">
          <Image src="/art/casual.webp" width={720} height={520} sizes="(max-width: 760px) 100vw, 480px" alt="" />
          <span>5 : 5</span>
        </div>
      </header>

      <section id="guide-controls" className="arena-guide-section" aria-labelledby="guide-controls-title">
        <div className="arena-guide-section-heading">
          <p className="arena-section-kicker">HOW TO PLAY</p>
          <h2 id="guide-controls-title">내 차례에 알을 골라, 뒤로 당겨 발사하세요.</h2>
          <p>마우스와 터치 조작 모두 같은 방식입니다. 상대 알이 하나도 남지 않도록 밀어내세요.</p>
        </div>
        <ol className="arena-guide-steps">
          {steps.map(step => <li className="arena-guide-step arena-panel" key={step.number}>
            <span className="arena-guide-step-number" aria-hidden="true">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>)}
        </ol>
        <div className="arena-guide-tip">
          <div>
            <h3>키보드로도 플레이할 수 있습니다</h3>
            <p>경기 화면에서 <strong>키보드 조작</strong>을 열고 발사할 알, 방향, 세기를 선택한 뒤 <strong>발사</strong> 버튼을 누르세요.</p>
          </div>
          <span aria-hidden="true">↖ ↑ ↗</span>
        </div>
      </section>

      <section className="arena-guide-section" aria-labelledby="guide-rules-title">
        <div className="arena-guide-section-heading">
          <p className="arena-section-kicker">THE RULES</p>
          <h2 id="guide-rules-title">승부는 남아 있는 알로 결정됩니다.</h2>
          <p>상대 알을 모두 밖으로 밀어내고 내 알을 남기면 승리합니다. 두 편 모두 알이 없어지면 무승부입니다.</p>
        </div>
        <div className="arena-guide-rules">
          <div className="arena-panel">
            <strong>5개씩</strong>
            <span>시작하는 알</span>
          </div>
          <div className="arena-panel">
            <strong>한 번씩</strong>
            <span>차례대로 발사</span>
          </div>
          <div className="arena-panel">
            <strong>밖으로</strong>
            <span>나간 알은 탈락</span>
          </div>
        </div>
      </section>

      <section id="guide-modes" className="arena-guide-section" aria-labelledby="guide-modes-title">
        <div className="arena-guide-section-heading">
          <p className="arena-section-kicker">CHOOSE YOUR MODE</p>
          <h2 id="guide-modes-title">어떤 한 판을 시작할까요?</h2>
          <p>친구와 함께할지, AI와 연습할지, RP 순위를 겨룰지 선택할 수 있습니다.</p>
        </div>
        <div className="arena-guide-modes">
          {modes.map(mode => <section key={mode.tone} className={'arena-guide-mode arena-guide-mode--' + mode.tone}>
            <p className="arena-guide-mode-label">{mode.label}</p>
            <h3>{mode.headline}</h3>
            <p>{mode.body}</p>
          </section>)}
        </div>
      </section>

      <section id="guide-faq" className="arena-guide-section" aria-labelledby="guide-faq-title">
        <div className="arena-guide-section-heading">
          <p className="arena-section-kicker">FAQ</p>
          <h2 id="guide-faq-title">자주 묻는 질문</h2>
        </div>
        <div className="arena-guide-faq">
          {faqs.map(item => <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>)}
        </div>
      </section>

      <footer className="arena-guide-bottom">
        <div>
          <p className="arena-section-kicker">READY TO PLAY?</p>
          <h2>이제 직접 한 판 해보세요.</h2>
          <p>로그인 후 로비에서 원하는 대전을 선택할 수 있습니다.</p>
        </div>
        <Link href="/lobby" className="arena-button">대전 로비로 이동 <span aria-hidden="true">›</span></Link>
      </footer>
    </article>
  </ArenaShell>;
}

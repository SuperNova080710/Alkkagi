'use client';
import { useState } from 'react';
export function CopyInvite({ code }: { code: string }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(code); setMessage('초대 코드를 복사했습니다.'); }
    catch { setMessage('복사하지 못했습니다. 위 코드를 선택해 복사해 주세요.'); }
  }
  return <div className="arena-invite"><p>초대 코드</p><strong>{code}</strong>
    <button type="button" className="arena-button arena-button--outline" onClick={copy}>코드 복사</button>
    <p role="status" className="arena-muted">{message || '친구에게 코드를 보내 주세요.'}</p>
  </div>;
}

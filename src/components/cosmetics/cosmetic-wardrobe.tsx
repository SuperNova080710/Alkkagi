'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArenaPanel } from '@/components/ui/arena';
import { usePlayerResource } from '@/components/players/use-player-resource';
import { CosmeticPreview } from './cosmetic-preview';
import {
  COSMETIC_STYLES, cosmeticErrorText, cosmeticUnlockLabel, equipCosmetic,
  type CosmeticInventory, type CosmeticItem, type CosmeticLoadout, type CosmeticSlot,
} from './cosmetic-api';

const groups = [
  { slot: 'piece', heading: '나만의 알', description: '외형만 바뀌고 충돌 판정과 발사 성능은 동일합니다.' },
  { slot: 'avatar', heading: '나만의 캐릭터', description: '프로필에 보여줄 캐릭터를 선택하세요.' },
] as const;

function canEquip(item: CosmeticItem): boolean {
  return item.owned && !item.equipped && Object.prototype.hasOwnProperty.call(COSMETIC_STYLES, item.code) &&
    COSMETIC_STYLES[item.code as keyof typeof COSMETIC_STYLES].slot === item.slot;
}

export function CosmeticCollection({
  inventory, busyCode, onEquip,
}: {
  inventory: CosmeticInventory;
  busyCode?: string | null;
  onEquip: (code: string) => void;
}) {
  const { items, loadout, rankedWins, level } = inventory;
  return <>
    <ArenaPanel title="현재 장착" className="arena-cosmetics-current">
      <div className="arena-cosmetics-loadout">
        <div><CosmeticPreview code={loadout.pieceCode} slot="piece"/>
          <div><span>나의 알</span><strong>{COSMETIC_STYLES[
            (Object.prototype.hasOwnProperty.call(COSMETIC_STYLES, loadout.pieceCode) &&
              COSMETIC_STYLES[loadout.pieceCode as keyof typeof COSMETIC_STYLES].slot === 'piece'
              ? loadout.pieceCode : 'piece-classic') as keyof typeof COSMETIC_STYLES].name}</strong></div></div>
        <div><CosmeticPreview code={loadout.avatarCode} slot="avatar"/>
          <div><span>나의 캐릭터</span><strong>{COSMETIC_STYLES[
            (Object.prototype.hasOwnProperty.call(COSMETIC_STYLES, loadout.avatarCode) &&
              COSMETIC_STYLES[loadout.avatarCode as keyof typeof COSMETIC_STYLES].slot === 'avatar'
              ? loadout.avatarCode : 'avatar-classic') as keyof typeof COSMETIC_STYLES].name}</strong></div></div>
      </div>
    </ArenaPanel>
    {groups.map(({ slot, heading, description }) => {
      const list = items.filter(item => item.slot === slot);
      return <section className="arena-cosmetics-section" aria-label={heading} key={slot}>
        <header><h2>{heading}</h2><p>{description}</p></header>
        {list.length ? <ul className="arena-cosmetics-grid">
          {list.map(item => <li key={item.code} className={'arena-cosmetics-item' +
            (item.equipped ? ' is-equipped' : '') + (!item.owned ? ' is-locked' : '')}>
            <div className="arena-cosmetics-item-art">
              <CosmeticPreview code={item.code} slot={slot}/>
              <span className="arena-cosmetics-state">{item.equipped ? '장착 중' : item.owned ? '보유' : '잠김'}</span>
            </div>
            <div className="arena-cosmetics-item-content">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <p className="arena-cosmetics-condition">{cosmeticUnlockLabel(item, rankedWins, level)}</p>
            </div>
            <button type="button"
              className="arena-button arena-cosmetics-equip"
              disabled={busyCode != null || !canEquip(item)}
              onClick={() => onEquip(item.code)}
              aria-label={item.name + (item.equipped ? ' 장착 중' : item.owned ? ' 장착하기' : ' 잠김')}>
              {busyCode === item.code ? '장착 처리 중…' :
                item.equipped ? '장착 중' : !item.owned ? '잠김' :
                canEquip(item) ? '장착하기' : '지원 준비 중'}
            </button>
          </li>)}
        </ul> : <p className="arena-muted">표시할 {heading} 아이템이 없습니다.</p>}
      </section>;
    })}
  </>;
}

/** Back-end authoritative inventory/equip UI. No local unlock or fake item grants. */
export function CosmeticWardrobe() {
  const { data, error, loading, retry } =
    usePlayerResource<CosmeticInventory>('/api/cosmetics/me');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmedLoadout, setConfirmedLoadout] = useState<CosmeticLoadout | null>(null);

  async function onEquip(code: string) {
    if (busyCode || !data?.items.some(item => item.code === code && canEquip(item))) return;
    setBusyCode(code);
    setErrorText('');
    setNotice('');
    try {
      // The server determines ownership/unlock status; client never writes inventory rows.
      const next = await equipCosmetic(code);
      setConfirmedLoadout(next);
      setNotice('장착이 변경되었습니다. 최신 인벤토리를 확인합니다.');
      retry();
    } catch (cause) {
      setErrorText(cosmeticErrorText(cause));
      if (cause instanceof Error) {
        // A locked or withdrawn item may have changed while the page was open.
        retry();
      }
    } finally {
      setBusyCode(null);
    }
  }

  const validData = data && data.loadout && Array.isArray(data.items) &&
    Number.isFinite(data.level) && Number.isFinite(data.rankedWins) ? data : null;
  const shown = validData && confirmedLoadout
    ? { ...validData, loadout: confirmedLoadout } : validData;
  return <div className="arena-cosmetics-wardrobe">
    {loading && <p role="status" className="arena-muted">보유 아이템을 불러오고 있습니다…</p>}
    {error != null && <ArenaPanel title="꾸미기 정보를 확인할 수 없습니다">
      <p role="alert">{error === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' :
        error === 503 ? '꾸미기 기능 준비 중입니다. 운영 환경이 준비되면 이용할 수 있습니다.' :
          '아이템 목록을 불러오지 못했습니다.'}</p>
      {error === 401 ? <Link className="arena-text-link" href="/login">로그인하기 ›</Link> :
        <button className="arena-button arena-button--outline" type="button" onClick={retry}>다시 시도</button>}
    </ArenaPanel>}
    {data && !validData && <p role="alert" className="arena-cosmetics-warning">
      아이템 정보 형식이 올바르지 않습니다. 새로고침 후 다시 확인해 주세요.</p>}
    {shown && <CosmeticCollection inventory={shown} busyCode={busyCode} onEquip={code => { void onEquip(code); }}/>}
    <p className="arena-cosmetics-alert" role="status" aria-live="polite">{notice}</p>
    {errorText && <div className="arena-cosmetics-warning" role="alert">{errorText}
      <button type="button" onClick={() => { setErrorText(''); setConfirmedLoadout(null); retry(); }}>다시 조회</button>
    </div>}
  </div>;
}

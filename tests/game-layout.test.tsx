import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { GameFeedback } from '../src/components/game/game-feedback';

describe('game board layout stability', () => {
 const render = (power: number | null, pending: boolean, error = '') =>
  renderToStaticMarkup(<GameFeedback power={power} pending={pending} error={error}/>);
 it('keeps both layout slots mounted during idle, drag, server pending and errors', () => {
  for (const [power, pending, error] of [
   [null, false, ''], [50, false, ''], [null, true, ''], [null, false, 'SHOT_CONFLICT'],
  ] as const) {
   const html = render(power, pending, error);
   expect(html.match(/class="game-shot-feedback/g)).toHaveLength(1);
   expect(html.match(/class="game-shot-power/g)).toHaveLength(1);
   expect(html.match(/class="game-shot-status/g)).toHaveLength(1);
  }
 });
 it('shows strength only while dragging and shows server and error feedback', () => {
  expect(render(null, false)).toContain('visibility:hidden');
  expect(render(50, false)).toContain('visibility:visible');
  expect(render(null, true)).toContain('서버에서 판정 중입니다');
  expect(render(null, false, 'SHOT_CONFLICT')).toContain('role="alert"');
 });
 it('reserves desktop heading and HUD height independent of content', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(css).toMatch(/\.game-page--playing \.game-screen-heading\s*\{[^}]*flex:\s*0 0 4\.5rem;/);
  expect(css).toMatch(/\.game-page--playing \.game-screen-bottom\s*\{[^}]*flex:\s*0 0 6\.5rem;/);
  expect(css).toMatch(/\.game-shot-feedback\s*\{[^}]*grid-template-rows:\s*1\.5rem 1\.5rem;/);
 });
});

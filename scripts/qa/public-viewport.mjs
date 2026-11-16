#!/usr/bin/env node
/**
 * #104 real-browser public UI QA. Uses Node 24 WebSocket + installed Chrome.
 * NO production access, authenticated test users, third-party browsers or API keys.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { build } from 'esbuild';

const viewports = [
  ['desktop-1280x720', 1280, 720], ['desktop-1024x768', 1024, 768], ['desktop-1366x768', 1366, 768],
  ['desktop-1440x900', 1440, 900], ['wide-1920x900', 1920, 900],
  ['wide-1920x960', 1920, 960], ['wide-1920x1080', 1920, 1080],
  ['mobile-320x720', 320, 720], ['mobile-390x844', 390, 844],
  ['tablet-768x1024', 768, 1024],
  // Approximates the *layout width* of zooming 1920x1080 to 200%.
  // NOT a measurement of Chrome's actual browser Zoom 200% behaviour.
  ['zoom-equivalent-960x540', 960, 540],
];
const routes = ['/', '/how-to-play', '/login', '/signup', '/games/omok', '/games/chess', '/games/alkkagi'];
const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:3107').replace(/\/$/, '');
const realZoom = process.env.QA_CHROME_ZOOM === '200';
const outdir = resolve(process.env.QA_OUTPUT_DIR || 'artifacts/ui-viewport-qa');

function browserExecutable() {
  for (const name of [process.env.QA_CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    try { execFileSync(name, ['--version'], { stdio: 'ignore', timeout: 5000 }); return name; }
    catch { /* Try the next preinstalled executable; never download anything. */ }
  }
  throw new Error('Preinstalled Chrome/Chromium is required (QA_CHROME_BIN)');
}
async function until(callback, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const result = await callback(); if (result) return result; }
    catch { /* Startup/navigation not ready. */ }
    await sleep(130);
  }
  throw Error('Browser/Next.js startup or navigation timed out');
}
class BrowserSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.waiting = new Map();
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message.id || !this.waiting.has(message.id)) return;
      const task = this.waiting.get(message.id);
      this.waiting.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(Error(task.method + ': ' + JSON.stringify(message.error)));
      else task.resolve(message.result || {});
    });
    socket.addEventListener('close', () => {
      for (const task of this.waiting.values()) task.reject(Error('Chrome disconnected'));
      this.waiting.clear();
    });
  }
  call(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(Error('Chrome CDP timed out: ' + method));
      }, 15000);
      this.waiting.set(id, { resolve: resolveResult, reject, timer, method });
      this.socket.send(JSON.stringify({
        id, method, params, ...(sessionId ? { sessionId } : {}),
      }));
    });
  }
  async eval(js, sessionId) {
    const result = await this.call('Runtime.evaluate', {
      expression: js, returnByValue: true, awaitPromise: true,
    }, sessionId);
    if (result.exceptionDetails) throw Error('Browser evaluation failed: ' + result.exceptionDetails.text);
    return result.result?.value;
  }
}
function measure() {
  const doc = document.documentElement;
  const body = document.body;
  const width = Math.max(doc.scrollWidth, body.scrollWidth);
  const height = Math.max(doc.scrollHeight, body.scrollHeight);
  const badRects = [...document.querySelectorAll('body *')].filter(el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.position !== 'fixed' &&
      rect.width > 0 && rect.height > 0 &&
      (rect.left < -1 || rect.right > doc.clientWidth + 1);
  }).slice(0, 12).map(el => ({
    tag: el.tagName.toLowerCase(),
    className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
    left: Math.round(el.getBoundingClientRect().left),
    right: Math.round(el.getBoundingClientRect().right),
  }));
  const internalScrolls = [...document.querySelectorAll('main *')].filter(el => {
    const style = getComputedStyle(el);
    return el.scrollHeight > el.clientHeight + 1 &&
      (style.overflowY === 'auto' || style.overflowY === 'scroll');
  }).slice(0, 12).map(el => ({
    className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
    contentHeight: el.scrollHeight, clientHeight: el.clientHeight,
  }));
  return {
    path: location.pathname, title: document.title,
    viewport: { width: doc.clientWidth, height: doc.clientHeight },
    document: { width, height },
    horizontalOverflowPx: Math.max(0, width - doc.clientWidth),
    verticalOverflowPx: Math.max(0, height - doc.clientHeight),
    h1Count: document.querySelectorAll('h1').length,
    mainCount: document.querySelectorAll('main').length,
    skipLink: !!document.querySelector('a[href="#arena-content"]'),
    focus: {
      tag: document.activeElement?.tagName?.toLowerCase() || null,
      href: document.activeElement?.getAttribute('href') || null,
    },
    badRects, internalScrolls,
  };
}
async function main() {
  await mkdir(outdir, { recursive: true });
  const temporary = await mkdtemp(join(tmpdir(), 'alkkagi-ui-chrome-'));
  const children = [];
  let session;
  try {
    if (!process.env.QA_BASE_URL) {
      const next = spawn(process.execPath, [
        'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3107',
      ], { stdio: 'ignore', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
      children.push(next);
      await until(async () => next.exitCode === null &&
        (await fetch(base, { redirect: 'manual' })).status === 200);
    }
    const browser = spawn(browserExecutable(), [
      ...(realZoom ? ['--window-size=1920,1080', '--window-position=0,0'] : ['--headless=new']),
      '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
      '--user-data-dir=' + temporary, 'about:blank',
    ], { stdio: 'ignore' });
    children.push(browser);
    const port = await until(async () => {
      const value = (await readFile(join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      return Number(value) || null;
    }, 20000);
    const version = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((yes, no) => {
      socket.addEventListener('open', yes, { once: true });
      socket.addEventListener('error', no, { once: true });
    });
    session = new BrowserSession(socket);
    const { targetId } = await session.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await session.call('Target.attachToTarget', { targetId, flatten: true });
    await session.call('Page.enable', {}, sessionId);
    await session.call('Runtime.enable', {}, sessionId);

    const fixture = await build({
      entryPoints: ['scripts/qa/fixtures/social-thread.tsx'],
      write: false, bundle: true, format: 'iife', jsx: 'automatic',
      alias: { 'next/link': resolve('scripts/qa/fixtures/chess-next-shim.tsx'),
        'next/navigation': resolve('scripts/qa/fixtures/chess-next-shim.tsx') },
      define: { 'process.env.NODE_ENV': '"production"',
        'process.env.NEXT_PUBLIC_SUPABASE_URL': 'undefined',
        'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': 'undefined' },
    });
    const drawerStyle = await readFile('src/components/social/social-messenger.css', 'utf8');
    const results = [];
    const selectedViewports = realZoom
      ? [['chrome-zoom-200', 1920, 1080]]
      : viewports.slice(0, Number(process.env.QA_VIEWPORT_LIMIT || viewports.length));
    let expectedZoomRatio;
    for (const [label, width, height] of selectedViewports) {
      if (!realZoom) await session.call('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: label.startsWith('mobile-') ? 2 : 1,
        mobile: label.startsWith('mobile-'),
      }, sessionId);
      for (const path of routes.slice(0, Number(process.env.QA_ROUTE_LIMIT || routes.length))) {
        const url = base + path;
        const response = await fetch(url, { redirect: 'follow' });
        await session.call('Page.navigate', { url }, sessionId);
        await until(async () => (await session.eval('document.readyState', sessionId)) === 'complete', 18000);
        if (realZoom && expectedZoomRatio === undefined) {
          const initialRatio = await session.eval('devicePixelRatio', sessionId);
          await session.call('Page.bringToFront', {}, sessionId);
          const windows = execFileSync('xdotool', ['search', '--sync', '--onlyvisible', '--class', 'chrom'], {
            encoding: 'utf8', timeout: 10000,
          }).trim().split('\n');
          execFileSync('xdotool', ['windowfocus', '--sync', windows.at(-1)], { timeout: 10000 });
          execFileSync('xdotool', ['key', '--clearmodifiers', '--delay', '180', ...Array(5).fill('ctrl+equal')], {
            timeout: 10000,
          });
          expectedZoomRatio = initialRatio * 2;
          await until(async () => await session.eval('devicePixelRatio', sessionId) === expectedZoomRatio, 10000);
        }
        await sleep(250);
        await session.call('Input.dispatchKeyEvent', {
          type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
        }, sessionId);
        await session.call('Input.dispatchKeyEvent', {
          type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
        }, sessionId);
        const m = await session.eval('(' + measure.toString() + ')()', sessionId);
        const failures = [];
        if (realZoom && await session.eval('devicePixelRatio', sessionId) !== expectedZoomRatio) {
          failures.push('Chrome tab zoom is no longer 200%');
        }
        if (m.focus.href !== '#arena-content') failures.push('Skip link is not the first keyboard focus target');
        if (path === '/' && ['wide-1920x1080', 'mobile-320x720', 'zoom-equivalent-960x540', 'chrome-zoom-200'].includes(label)) {
          await session.eval(`(() => {
            delete document.documentElement.dataset.qaMessenger;
            const style = document.createElement('style');
            style.id = 'qa-messenger-style';
            style.textContent = ${JSON.stringify(drawerStyle)};
            document.head.append(style);
          })()`, sessionId);
          await session.eval(fixture.outputFiles[0].text, sessionId);
          const report = await until(() => session.eval('document.documentElement.dataset.qaMessenger', sessionId), 8000);
          if (report !== 'PASS') failures.push('Messenger geometry: ' + report);
          else console.log('PASS ' + label + ' messenger: thread and tab slides preserve the composer and independent history scroll');
        }
        if (path === '/') {
          const refracted = await until(async () => await session.eval(`
            Boolean(document.querySelector('.arena-header-glass[data-lg-refract="surface"]'))
          `, sessionId), 5000).catch(() => false);
          if (!refracted) failures.push('Liquid Glass did not build the Chromium backdrop filter');
          const aligned = await session.eval(`(() => {
            const nav = document.querySelector('.arena-nav[data-indicator-ready]');
            const pill = nav?.querySelector('.arena-nav-indicator')?.getBoundingClientRect();
            const current = nav?.querySelector('[aria-current="location"]')?.getBoundingClientRect();
            return Boolean(pill && current && pill.width > 0 &&
              Math.abs(pill.left - current.left - 1) < 2 &&
              Math.abs(pill.right - current.right + 1) < 2);
          })()`, sessionId);
          if (!aligned) failures.push('Sliding indicator is missing or off its active link');
          const home = await session.eval(`(() => {
            const grid = document.querySelector('.arena-platform-grid');
            if (!grid) return null;
            const links = [...grid.querySelectorAll('a')].map(link => link.getAttribute('href'));
            return {
              columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
              wide: matchMedia('(min-width: 1024px)').matches,
              links,
            };
          })()`, sessionId);
          if (!home) failures.push('Missing platform game grid');
          if (home && home.columns !== (home.wide ? 3 : 1)) failures.push('Unexpected game grid columns');
          if (home && process.env.QA_EXPECT_ALL_GAMES === 'true' &&
              JSON.stringify(home.links) !== JSON.stringify(['/omok', '/chess', '/lobby'])) {
            failures.push('Missing or reordered lobby destinations');
          }
          if (home?.wide && m.viewport.height >= 768 && m.verticalOverflowPx > 1) {
            failures.push('Home vertical overflow ' + m.verticalOverflowPx + 'px');
          }
        }
        if (label === 'wide-1920x1080') {
          if (m.verticalOverflowPx > 1) failures.push('Full HD document scroll ' + m.verticalOverflowPx + 'px');
          if (path === '/login') {
            const navParity = await session.eval(`(() => {
              const header = document.querySelector('.arena-header');
              const tabs = [...(header?.querySelectorAll('.arena-nav a') ?? [])];
              if (!header || tabs.length === 0) return false;
              const bounds = () => tabs.map(tab => {
                const {x, y, width, height} = tab.getBoundingClientRect();
                return [x, y, width, height];
              });
              const initial = bounds();
              if (initial.some(([, , width, height]) => width !== 88 || height !== 44)) return false;
              const account = document.createElement('div');
              account.className = 'arena-account';
              account.textContent = '로그아웃';
              header.append(account);
              const matches = JSON.stringify(bounds()) === JSON.stringify(initial);
              account.remove();
              return matches;
            })()`, sessionId);
            if (!navParity) failures.push('Header links changed position or size when the account action appeared');
            const motion = await session.eval(`(async () => {
              const dialog = document.createElement('dialog');
              dialog.className = 'arena-dialog';
              dialog.textContent = '대전 선택';
              dialog.style.setProperty('--arena-panel-origin-x', '200px');
              dialog.style.setProperty('--arena-panel-origin-y', '240px');
              document.querySelector('#arena-content').append(dialog);
              dialog.showModal();
              await new Promise(requestAnimationFrame);
              getComputedStyle(dialog).transform;
              const entering = dialog.getAnimations().some(animation =>
                animation.transitionProperty === 'transform' && animation.effect.getTiming().duration === 330);
              await new Promise(resolve => setTimeout(resolve, 380));
              dialog.close();
              getComputedStyle(dialog).transform;
              const exiting = dialog.getAnimations().some(animation =>
                animation.transitionProperty === 'transform' && animation.effect.getTiming().duration === 330);
              dialog.remove();
              return entering && exiting;
            })()`, sessionId);
            if (!motion) failures.push('Shared modal does not transition in and out at 330 ms');
          }
        }
        if (response.status !== 200) failures.push('HTTP ' + response.status);
        if (m.path !== path) failures.push('Unexpected redirect: ' + m.path);
        if (m.horizontalOverflowPx > 1) failures.push('Horizontal overflow ' + m.horizontalOverflowPx + 'px');
        if (m.h1Count !== 1 || m.mainCount !== 1 || !m.skipLink) failures.push('Missing h1/main/skip-link semantics');
        const safePath = path === '/' ? 'home' : path.slice(1);
        if (realZoom || failures.length || ['wide-1920x900', 'mobile-320x720', 'zoom-equivalent-960x540'].includes(label)) {
          const screenshot = await session.call('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: false,
          }, sessionId);
          await writeFile(join(outdir, safePath.replaceAll('/', '-') + '-' + label + '.png'), Buffer.from(screenshot.data, 'base64'));
        }
        if (label === 'wide-1920x1080' && path === '/') {
          await session.eval(`document.querySelector('.arena-nav a[href="/how-to-play"]').click()`, sessionId);
          const slid = await until(() => session.eval(`location.pathname === '/how-to-play' &&
            document.getElementById('arena-content').getAnimations().some(animation => animation.id === 'arena-page-slide')
          `, sessionId), 8000).catch(() => false);
          if (!slid) failures.push('Main menu navigation did not play the page slide');
          else console.log('PASS ' + label + ' main menu page slide');
        }
        results.push({ viewport: label, cssPixels: [width, height], path,
          httpStatus: response.status, ...m, failures });
        console.log((failures.length ? 'FAIL ' : 'PASS ') + label + ' ' + path +
          ' horizontal=' + m.horizontalOverflowPx + 'px vertical=' + m.verticalOverflowPx + 'px');
        for (const failure of failures) console.error('  - ' + failure);
      }
    }
    const summary = {
      generatedAt: new Date().toISOString(),
      scope: realZoom
        ? 'Local Next.js public routes at actual Chrome tab zoom 200%.'
        : 'Local Next.js public routes at fixed CSS viewports. Zoom-equivalent width is not browser tab zoom.',
      total: results.length, failed: results.filter(r => r.failures.length).length, results,
    };
    await writeFile(join(outdir, 'results.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log('PUBLIC QA RESULTS ' + (summary.total - summary.failed) + '/' + summary.total);
    if (summary.failed) process.exitCode = 1;
  } finally {
    if (session) session.socket.close();
    for (const proc of children.reverse()) if (proc.exitCode === null) proc.kill('SIGTERM');
    await sleep(150);
    await rm(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error('UI viewport browser QA failed:', error); process.exitCode = 1; });

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const net = require('node:net');
const { chromium } = require('@playwright/test');
const { createApp } = require('../dist/create-app');
const { createDatabaseClient } = require('../dist/database/client');
const { databaseUrl } = require('../dist/database/config');
const { assertSmokeTurn, saveReportAndCleanup } = require('./chatbot-smoke-assertions.cjs');

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const ended = once(child, 'exit');
  if (process.platform === 'win32') {
    const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await once(kill, 'exit');
  } else child.kill('SIGTERM');
  await ended;
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error('Local smoke process exited');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw Error('Local readiness deadline');
}

test('approved browser live smoke through real internal APIs and local database', { timeout: 150000 }, async () => {
  assert.equal(process.env.ALLOW_BROWSER_LIVE, '1', 'Explicit live approval required');
  const target = new URL(databaseUrl());
  assert.ok(target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/restaurant');
  for (const port of [3110, 3111, 8111]) await new Promise((done, reject) => {
    const s = net.createServer(); s.once('error', () => reject(Error('Dedicated port occupied')));
    s.listen(port, '127.0.0.1', () => s.close(done));
  });
  const names = ['STAFF_ORIGIN','INTERNAL_TOOL_SERVICE_TOKEN','INTERNAL_CONTEXT_SECRET','ASSISTANT_GATEWAY_TOKEN','ASSISTANT_ORIGIN'];
  const previous = Object.fromEntries(names.map(n => [n, process.env[n]]));
  process.env.STAFF_ORIGIN = 'http://127.0.0.1:3110';
  process.env.ASSISTANT_ORIGIN = 'http://127.0.0.1:8111';
  for (const n of names.slice(1,4)) process.env[n] = randomBytes(32).toString('hex');
  const config = ['apps/web/next-env.d.ts','apps/web/tsconfig.json'].map(path => ({path, content: readFileSync(path)}));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = `docs/images/chatbot-live-browser/${stamp}`;
  mkdirSync(dir, {recursive:true}); mkdirSync('docs/evidence',{recursive:true});
  const report = { checked_at: new Date().toISOString(), source: 'real browser, live OpenRouter, real Nest internal API and local PostgreSQL', request_limit: 6, attempted_requests: 0, results: [], status: 'stopped' };
  const db = createDatabaseClient();
  let app, python, web, browser;
  try {
    const expectedMenu = await db.menuItem.findFirst({where:{tenant:{slug:'demo-padang'},isActive:true,name:{contains:'Rendang',mode:'insensitive'}},select:{name:true,price:true}});
    assert.ok(expectedMenu, 'Synthetic demo menu required');
    report.expected_menu = expectedMenu;
    const published = await db.knowledgeDocumentRevision.findMany({
      where: { status: 'published', document: { tenant: { slug: 'demo-padang', status: 'active' } } },
      select: { documentId: true, revision: true, title: true, document: { select: { activeRevision: true } } },
    });
    const expectedKnowledge = published.find(item => item.title === 'Apakah saya perlu akun untuk menggunakan website?' && item.revision === item.document.activeRevision);
    assert.ok(expectedKnowledge, 'Published current website guidance required');
    const before = await db.reservation.count();
    app = await createApp(); await app.listen(3111,'127.0.0.1');
    python = spawn(resolve('agno-v2/.venv/Scripts/python.exe'),[resolve('agno-v2/browser_live.py')],{env:{...process.env,AGNO_SERVICE_API_KEY:process.env.ASSISTANT_GATEWAY_TOKEN,RESTAURANT_API_BASE_URL:'http://127.0.0.1:3111'},stdio:'ignore'});
    await ready('http://127.0.0.1:8111/health',python);
    web = spawn(process.execPath,['apps/web/node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3110'],{env:{...process.env,NODE_ENV:'development',API_ORIGIN:'http://127.0.0.1:3111',WEB_DIST_DIR:`.next-browser-${randomUUID()}`},stdio:'ignore'});
    await ready('http://127.0.0.1:3110',web);
    browser = await chromium.launch(); const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3110'); await page.getByRole('button',{name:'Tanya restoran',exact:true}).click();
    for (const [name,message] of [['menu','Harga rendang?'],['faq','Apakah saya perlu akun untuk menggunakan website?'],['reservation','Mau reservasi']]) {
      await page.getByLabel('Pesan untuk asisten').fill(message);
      const observed = page.waitForResponse(r => r.url().endsWith('/chat/messages') && r.request().method()==='POST');
      await page.getByRole('button',{name:'Kirim',exact:true}).click();
      const result = await (await observed).json();
      report.attempted_requests += result.attempted_requests || 0;
      report.results.push({case:name,status:result.status,answer:result.message,attempted_requests:result.attempted_requests,diagnostics:result.diagnostics,cards:result.cards});
      await page.screenshot({path:`${dir}/${name}.png`});
      assertSmokeTurn(name, result, expectedMenu, expectedKnowledge);
      if((result.diagnostics||[]).some(d=>[401,402,403,429].includes(d.http_status))) throw Error('Provider stop condition');
    }
    await stop(python); python=null;
    await page.getByLabel('Pesan untuk asisten').fill('Info restoran?');
    const outage = page.waitForResponse(r=>r.url().endsWith('/chat/messages') && r.request().method()==='POST');
    await page.getByRole('button',{name:'Kirim',exact:true}).click();
    const fallback = await (await outage).json();
    assert.equal(fallback.status,'unavailable');
    await page.screenshot({path:`${dir}/runtime-offline.png`});
    await page.getByRole('button',{name:'Buka form reservasi',exact:true}).last().click();
    await page.getByLabel('Tanggal (WIB)').waitFor();
    await page.screenshot({path:`${dir}/reservation-form.png`});
    report.runtime_offline_form_accessible = true;
    assert.equal(await db.reservation.count(),before);
    report.reservation_count_unchanged = true; report.status='passed';
  } catch {
    report.reason='Smoke stopped: assertion, dependency or provider failure; private details suppressed';
    throw Error(report.reason);
  } finally {
    report.screenshot_directory=dir;
    await saveReportAndCleanup(
      () => writeFileSync(`docs/evidence/chatbot-live-browser-${stamp}.json`,JSON.stringify(report,null,2)+'\n'),
      async () => {
    try {if(browser) await browser.close();} finally {
      try {await stop(web); for(const f of config) writeFileSync(f.path,f.content);} finally {
        try {await stop(python);} finally {
          try {if(app) await app.close();} finally {
            try { await db.$disconnect(); } finally {
              for(const n of names) if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n];
            }
          }
        }
      }
    }
      });
  }
});

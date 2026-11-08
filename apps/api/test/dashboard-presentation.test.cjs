const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const react = require('../../web/node_modules/react');
const { renderToStaticMarkup } = require('../../web/node_modules/react-dom/server');

function dashboard(session) {
  const filename = resolve(__dirname, '../../web/app/dashboard/page.tsx');
  const instance = new Module(filename);
  instance.require = name => {
    if (name === 'react/jsx-runtime') return require('../../web/node_modules/react/jsx-runtime');
    if (name === 'next/link') return { default: ({ children, ...props }) => react.createElement('a', props, children) };
    if (name === 'next/navigation') return { redirect: path => { throw new Error(`redirect:${path}`); } };
    if (name === '../staff-session') return { staffSession: session };
    if (name === './dashboard.css') return {};
    if (name === './LogoutButton') return { default: () => react.createElement('button', null, 'Keluar') };
    if (name === './DashboardViews') return { default: ({ view }) => react.createElement('div', { 'data-view': view }) };
    if (name.startsWith('./')) return { default: () => react.createElement('div', { 'data-manager': name.slice(2) }) };
    throw new Error('Unexpected import');
  };
  instance._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return async tab => renderToStaticMarkup(await instance.exports.default({ searchParams: Promise.resolve({ tab }) }));
}

test('dashboard navigation keeps existing managers and exposes honest unwired screens', async () => {
  const render = dashboard(async () => ({ username: 'Synthetic operator', slug: 'synthetic-restaurant', role: 'owner' }));
  for (const [tab, target] of [['menu', 'MenuManager'], ['tables', 'TableManager'], ['hours', 'HoursManager'], ['profile', 'ProfileManager'], ['reservations', 'ReservationManager']]) {
    const html = await render(tab);
    assert.ok(html.includes(`data-manager="${target}"`));
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, ['menu', 'reservations'].includes(tab) ? 1 : 2);
  }
  assert.ok((await render(undefined)).includes('data-view="overview"'));
  assert.ok((await render('outlets')).includes('data-view="outlets"'));
  assert.ok((await render('unknown')).includes('data-view="overview"'));
  for (const tab of ['categories', 'audit']) {
    const html = await render(tab);
    assert.ok(html.includes('Belum terhubung'));
    assert.ok(html.includes('Data tidak ditampilkan sampai layanan ini terhubung.'));
    assert.ok(!html.includes('data-manager='));
  }
  const html = await render('menu');
  for (const label of ['Ikhtisar', 'Reservasi', 'Cabang restoran', 'Menu masakan', 'Kategori menu', 'Audit aktivitas']) assert.ok(html.includes(label));
  assert.ok(html.includes('href="#staff-content"'));
});

test('dashboard preserves unauthenticated redirect and dependency failure state', async () => {
  await assert.rejects(dashboard(async () => null)('menu'), /redirect:\/login/);
  const html = await dashboard(async () => { throw new Error('Synthetic unavailable'); })('menu');
  assert.ok(html.includes('Sesi belum dapat diperiksa.'));
  assert.ok(!html.includes('data-manager='));
  assert.ok(!html.includes('data-view='));
});

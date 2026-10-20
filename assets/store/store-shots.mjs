import { chromium } from 'playwright-core';
const ext = '/workspace/projects/463eca99-d995-4a68-8c09-e12065065003/repo/navill/.output/chrome-mv3';
const pu = new URL(process.env.HTTPS_PROXY || process.env.https_proxy);
const proxy = { server: `${pu.protocol}//${pu.host}`, username: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password) };
const ctx = await chromium.launchPersistentContext('/tmp/pwprofile-'+Date.now(), {
  executablePath: '/usr/bin/chromium', headless: true, proxy, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'zh-CN',
  args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-sandbox', '--lang=zh-CN'],
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto(`chrome-extension://${id}/newtab.html`);
await page.evaluate(async () => {
  const data = {
    'AI': { 对话: [['ChatGPT','https://chatgpt.com'],['Claude','https://claude.ai'],['Gemini','https://gemini.google.com'],['Perplexity','https://www.perplexity.ai']], 开发: [['OpenRouter','https://openrouter.ai'],['Hugging Face','https://huggingface.co'],['Ollama','https://ollama.com'],['Replicate','https://replicate.com']], 绘图: [['Midjourney','https://www.midjourney.com'],['Leonardo','https://leonardo.ai'],['Ideogram','https://ideogram.ai']] },
    '工作': { 开发: [['GitHub','https://github.com'],['Vercel','https://vercel.com'],['Cloudflare','https://dash.cloudflare.com']], 文档: [['Notion','https://www.notion.so'],['Figma','https://www.figma.com'],['Linear','https://linear.app']] },
    '影视': { 视频: [['YouTube','https://www.youtube.com'],['Netflix','https://www.netflix.com'],['B站','https://www.bilibili.com']], 资料: [['豆瓣电影','https://movie.douban.com'],['IMDb','https://www.imdb.com']] },
    '设计': { 灵感: [['Dribbble','https://dribbble.com'],['Behance','https://www.behance.net']] },
  };
  for (const [ws, drawers] of Object.entries(data)) {
    const f = await chrome.bookmarks.create({ parentId: '1', title: ws });
    for (const [d, list] of Object.entries(drawers)) { const df = await chrome.bookmarks.create({ parentId: f.id, title: d }); for (const [t,u] of list) await chrome.bookmarks.create({ parentId: df.id, title: t, url: u }); }
  }
});
await page.reload(); await page.waitForTimeout(800);
await page.getByRole('button', { name: '导入浏览器书签' }).click(); await page.waitForTimeout(800);
await page.getByRole('button', { name: '确认导入' }).click(); await page.waitForTimeout(3000);
await page.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...(settings||{}), surface: 'glass', theme: 'light' } }); });
await page.waitForTimeout(900);
const ai = page.getByRole('button', { name: 'AI', exact: true }).first();
if (await ai.count()) await ai.click(); else await page.getByText('AI', { exact: true }).first().click();
await page.waitForTimeout(6000);
await page.evaluate(() => { for (const el of document.querySelectorAll('div')) if (el.childElementCount===0 && el.textContent?.trim()==='拖到这里放到工作区顶层') el.style.visibility='hidden'; });
const clean = async () => { await page.mouse.move(1270, 400); await page.waitForTimeout(500); await page.evaluate(() => document.querySelectorAll('[data-starting-style]').forEach(e => e.removeAttribute('data-starting-style'))); await page.waitForTimeout(300); };
await clean(); await page.screenshot({ path: 'ss-1.png', animations: 'disabled' });
for (const h of ['https://chatgpt.com','https://claude.ai','https://gemini.google.com','https://openrouter.ai','https://huggingface.co','https://www.midjourney.com']) { const a = page.locator(`a[href^="${h}"]`).first(); await a.hover(); await page.waitForTimeout(150); await a.getByRole('button', { name: '收藏' }).click().catch(e=>console.log('star fail',h)); }
await page.getByRole('button', { name: '工作', exact: true }).first().click().catch(()=>page.getByText('工作',{exact:true}).first().click()); await page.waitForTimeout(3000);
await page.evaluate(async () => { const r = await new Promise(res => { const q = indexedDB.open('navill'); q.onsuccess = () => res(q.result); }); const all = await new Promise(res => { const t = r.transaction('bookmarks').objectStore('bookmarks').getAll(); t.onsuccess = () => res(t.result); }); const st = r.transaction('bookmarks','readwrite').objectStore('bookmarks'); all.forEach((b, i) => { b.openCount = (i * 7) % 11 + 1; b.lastOpenedAt = Date.now() - i*3600e3; st.put(b); }); await new Promise(res => st.transaction.oncomplete = res); });
await page.reload(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: '主页' }).click().catch(()=>page.getByText('主页',{exact:true}).first().click()); await page.waitForTimeout(5000);
await clean(); await page.screenshot({ path: 'ss-2.png', animations: 'disabled' });
await page.getByRole('button', { name: '更多操作' }).first().click(); await page.waitForTimeout(400);
await page.getByRole('menuitem', { name: '市场' }).click(); await page.waitForTimeout(6000);
await clean(); await page.screenshot({ path: 'ss-3.png', animations: 'disabled' });
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
await page.getByRole('button', { name: '更多操作' }).first().click(); await page.waitForTimeout(400);
await page.getByRole('menuitem', { name: '设置' }).click(); await page.waitForTimeout(1500);
await clean(); await page.screenshot({ path: 'ss-4.png', animations: 'disabled' });
console.log('done');
await ctx.close();

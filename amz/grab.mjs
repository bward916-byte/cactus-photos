import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.argv[2];
fs.mkdirSync('amz/json', { recursive: true }); fs.mkdirSync('amz/photos', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', viewport:{width:1400,height:1000} });
const page = await ctx.newPage();
const nodes = new Map(); let n = 0; const urls = [];
page.on('response', async r => {
  const u = r.url(); if (!u.includes('/drive/')) return;
  urls.push(r.status()+' '+u);
  try { const j = await r.json(); fs.writeFileSync(`amz/json/${n++}.json`, JSON.stringify({url:u, body:j}));
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o==='object') {
      if (o.id && (o.contentProperties?.image || o.contentProperties?.contentType?.startsWith?.('image'))) nodes.set(o.id, o);
      Object.values(o).forEach(walk); } };
    walk(j);
  } catch {}
});
await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
for (let i=0;i<40;i++){ await page.mouse.wheel(0, 3000); await page.waitForTimeout(800); }
await page.waitForTimeout(3000);
fs.writeFileSync('amz/urls.txt', urls.join('\n'));
await page.screenshot({ path: 'amz/screen.png' });
console.log('nodes', nodes.size);
const token = URL.split('/shared/')[1].split('?')[0];
const list = [];
for (const [id, o] of nodes) {
  const owner = o.ownerId || '';
  const t = `https://thumbnails-photos.amazon.com/v1/thumbnail/${id}?ownerId=${owner}&groupShareToken=${token}&viewBox=1600`;
  try { const r = await ctx.request.get(t); if (r.ok()) { fs.writeFileSync(`amz/photos/${id}.jpg`, await r.body()); } list.push({id, name:o.name, ok:r.ok(), date:o.contentProperties?.contentDate, loc:o.contentProperties?.location||null}); }
  catch(e){ list.push({id, err:String(e)}); }
}
fs.writeFileSync('amz/list.json', JSON.stringify(list, null, 1));
await browser.close();

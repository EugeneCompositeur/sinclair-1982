const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_EXEC || undefined });
  const page = await browser.newPage({ viewport: { width: 960, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8731/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tools/shot-boot.png', fullPage: true });
  // type PRINT "HELLO" via clicks: P, then SS+P, H,E,L,L,O, SS+P
  for (const step of [['P'],['SS'],['P'],['H'],['E'],['L'],['L'],['O'],['SS'],['P']]) {
    await page.click(`.cap[data-id="${step[0]}"]`);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/shot-typed.png', fullPage: true });
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();

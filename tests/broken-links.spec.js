// @ts-check
const { test, expect } = require('@playwright/test');

const PAGES = ['index.html', 'soy-candidato.html', 'soy-coach.html', 'blog.html', 'precios-coaching.html', 'login.html', 'registro.html', 'coaches.html'];

async function getInternalLinks(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:') &&
        !h.startsWith('javascript:') && !h.includes('wa.me') && !h.includes('whatsapp') &&
        !h.includes('stripe.com') && !h.includes('calendly.com') && !h.includes('linkedin.com') &&
        !h.includes('google.com') && !h.includes('github.com') && !h.includes('youtube.com') &&
        !h.includes('instagram.com') && !h.includes('tiktok.com'))
      .map(h => {
        if (h.includes('pathwaycareercoach.com')) {
          try { return new URL(h).pathname.replace(/^\//, ''); } catch { return h; }
        }
        return h.replace(/^\//, '');
      })
      .filter(h => h && !h.startsWith('http'))
      .filter((h, i, a) => a.indexOf(h) === i);
  });
}

test.describe('Links rotos', () => {
  for (const pageUrl of PAGES) {
    test(`${pageUrl} — sin links internos rotos`, async ({ page, request }) => {
      await page.goto(pageUrl);
      await page.waitForLoadState('domcontentloaded');
      const links = await getInternalLinks(page);
      const broken = [];
      const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
      for (const link of links) {
        try {
          const r = await request.get(`${BASE}${link}`);
          if (r.status() === 404) broken.push({ link, status: 404 });
        } catch {}
      }
      if (broken.length) console.log(`Links rotos en ${pageUrl}:`, broken);
      expect(broken).toEqual([]);
    });
  }
});

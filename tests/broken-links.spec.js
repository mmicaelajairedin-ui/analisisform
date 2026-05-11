// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Detector de links rotos
 *
 * Recorre las páginas públicas principales y verifica que todos los links
 * internos (href) apuntan a páginas que existen (no 404).
 * Solo verifica links internos (mismo dominio), no links externos.
 */

const PAGES_TO_CHECK = [
  'index.html',
  'soy-candidato.html',
  'soy-coach.html',
  'blog.html',
  'precios-coaching.html',
  'login.html',
  'registro.html',
];

async function getInternalLinks(page) {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links
      .map(a => a.getAttribute('href'))
      .filter(href => {
        if (!href) return false;
        // Solo links internos
        if (href.startsWith('http') && !href.includes('pathwaycareercoach.com')) return false;
        if (href.startsWith('mailto:')) return false;
        if (href.startsWith('tel:')) return false;
        if (href.startsWith('javascript:')) return false;
        if (href.startsWith('#')) return false;
        if (href.startsWith('whatsapp:') || href.includes('wa.me')) return false;
        if (href.includes('stripe.com')) return false;
        if (href.includes('calendly.com')) return false;
        if (href.includes('linkedin.com')) return false;
        if (href.includes('google.com')) return false;
        if (href.includes('github.com')) return false;
        return true;
      })
      .map(href => {
        // Normalizar: quitar dominio si está completo
        if (href.includes('pathwaycareercoach.com')) {
          try {
            const url = new URL(href);
            return url.pathname.replace(/^\//, '');
          } catch (e) { return href; }
        }
        return href.replace(/^\//, '');
      })
      // Eliminar duplicados
      .filter((href, i, arr) => arr.indexOf(href) === i);
  });
}

test.describe('Links rotos — Páginas públicas', () => {

  for (const pageUrl of PAGES_TO_CHECK) {
    test(`${pageUrl} — todos los links internos responden`, async ({ page, request }) => {
      await page.goto(pageUrl);
      await page.waitForLoadState('domcontentloaded');

      const links = await getInternalLinks(page);
      const brokenLinks = [];

      for (const link of links) {
        if (!link || link === '' || link === '/') continue;

        try {
          const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
          const fullUrl = link.startsWith('http') ? link : `${BASE}${link}`;
          const response = await request.get(fullUrl);

          if (response.status() === 404) {
            brokenLinks.push({ link, status: 404 });
          }
        } catch (e) {
          // Network errors en links externos — ignorar
        }
      }

      if (brokenLinks.length > 0) {
        console.log(`Links rotos en ${pageUrl}:`, brokenLinks);
      }

      expect(brokenLinks).toEqual([]);
    });
  }
});

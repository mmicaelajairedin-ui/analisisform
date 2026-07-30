const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });

  try {
    // Desktop view (1200px)
    const desktopContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    const filePath = 'file://' + path.resolve('/home/user/analisisform/owner-dashboard-v3.html');
    await desktopPage.goto(filePath);
    await desktopPage.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 500)); // Let animations settle
    await desktopPage.screenshot({ path: '/tmp/claude-0/-home-user-analisisform/6d9d5908-6296-579c-bd28-0fe4fc3a6e53/scratchpad/dashboard-desktop-1200.png' });
    await desktopContext.close();
    console.log('✓ Desktop screenshot (1200px) captured');

    // Tablet view (900px - middle of 768-1024 range)
    const tabletContext = await browser.newContext({ viewport: { width: 900, height: 1200 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(filePath);
    await tabletPage.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 500));
    await tabletPage.screenshot({ path: '/tmp/claude-0/-home-user-analisisform/6d9d5908-6296-579c-bd28-0fe4fc3a6e53/scratchpad/dashboard-tablet-900.png' });
    await tabletContext.close();
    console.log('✓ Tablet screenshot (900px) captured');

  } catch (error) {
    console.error('Error capturing screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();

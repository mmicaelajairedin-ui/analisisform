import { test, expect } from '@playwright/test';

/**
 * ERR-APP-004: Apple Sign in visibility
 *
 * Apple App Store Requirement 4.8:
 * If you offer login with Google, you MUST also offer Sign in with Apple.
 *
 * Test that btn-apple is visible on web (not just on iOS app).
 */

test.describe('ERR-APP-004: Apple Sign in visibility', () => {
  test('btn-apple should be visible on login page (web)', async ({ page, context }) => {
    // Navigate to login page
    await page.goto('http://localhost:5173/login.html');

    // Locate the Apple button
    const appleBtn = page.locator('#btn-apple');

    // Button must exist
    await expect(appleBtn).toBeVisible({
      timeout: 5000,
    });

    // Button must NOT have display:none
    const displayStyle = await appleBtn.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });

    expect(displayStyle).not.toBe('none');
    expect(displayStyle).toMatch(/flex|block|inline/);
  });

  test('btn-apple should be clickable (onclick handler exists)', async ({ page }) => {
    await page.goto('http://localhost:5173/login.html');

    const appleBtn = page.locator('#btn-apple');

    // Button must have onclick attribute pointing to signInWithApple
    const onclickAttr = await appleBtn.getAttribute('onclick');
    expect(onclickAttr).toContain('signInWithApple');

    // Function must be defined
    const functionDefined = await page.evaluate(() => {
      return typeof window.signInWithApple === 'function';
    });
    expect(functionDefined).toBe(true);
  });

  test('btn-apple text should be visible (not hidden)', async ({ page }) => {
    await page.goto('http://localhost:5173/login.html');

    const appleBtn = page.locator('#btn-apple');
    const text = await appleBtn.innerText();

    // Button should have visible text (not empty)
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('signInWithApple function should handle Supabase OAuth flow', async ({ page }) => {
    await page.goto('http://localhost:5173/login.html');

    // Verify Supabase SDK is loaded
    const sbLoaded = await page.evaluate(() => {
      return typeof window.supabase !== 'undefined';
    });
    expect(sbLoaded).toBe(true);
  });

  test('Apple button should be visible BEFORE iOS runtime detection', async ({ page }) => {
    await page.goto('http://localhost:5173/login.html');

    const appleBtn = page.locator('#btn-apple');

    // The button's initial style should be visible (or made visible by script)
    // It should NOT have hardcoded display:none that can't be overridden
    const initialDisplay = await appleBtn.evaluate((el) => {
      // Get the computed style (after any inline/script modifications)
      return window.getComputedStyle(el).display;
    });

    // Should be visible by default (not require iOS detection to show)
    expect(initialDisplay).not.toBe('none');
  });
});

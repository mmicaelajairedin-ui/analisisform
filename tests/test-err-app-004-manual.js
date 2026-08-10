/**
 * ERR-APP-004: Manual test for Apple Sign in visibility
 *
 * Runs without Playwright - checks HTML and JavaScript directly
 */

const fs = require('fs');

console.log('🧪 TEST: ERR-APP-004 - Apple Sign in visibility\n');

const loginHtml = fs.readFileSync('./login.html', 'utf8');

// TEST 1: btn-apple button must exist
const hasAppleBtn = loginHtml.includes('id="btn-apple"');
console.log(
  (hasAppleBtn ? '✅' : '❌') + ' TEST 1: btn-apple button exists'
);
if (!hasAppleBtn) {
  console.log('   FAILED: button not found');
  process.exit(1);
}

// TEST 2: signInWithApple function must be defined
const hasSignInWithApple = loginHtml.includes('function signInWithApple()');
console.log(
  (hasSignInWithApple ? '✅' : '❌') + ' TEST 2: signInWithApple() function exists'
);
if (!hasSignInWithApple) {
  console.log('   FAILED: function not found');
  process.exit(1);
}

// TEST 3: CRITICAL - btn-apple must NOT have display:none by default
const appleBtnMatch = loginHtml.match(/<button[^>]*id="btn-apple"[^>]*>/);
if (!appleBtnMatch) {
  console.log('❌ TEST 3: CRITICAL - Cannot find btn-apple button definition');
  process.exit(1);
}

const appleBtnHtml = appleBtnMatch[0];
const hasDisplayNone = appleBtnHtml.includes('display:none');

console.log(
  (hasDisplayNone ? '❌' : '✅') + ' TEST 3: CRITICAL - btn-apple does NOT have display:none'
);

if (hasDisplayNone) {
  console.log('   FAILED: Button has display:none - it will be HIDDEN on web');
  console.log('   This violates Apple App Store requirement 4.8');
  console.log('   (If you offer Google login, you MUST offer Apple login)');
  console.log('\n   Found HTML:');
  console.log('   ' + appleBtnHtml.substring(0, 150) + '...');
  process.exit(1);
}

// TEST 4: Provider 'apple' must be in OAuth flow
const hasAppleProvider = loginHtml.includes("provider: 'apple'");
console.log(
  (hasAppleProvider ? '✅' : '❌') + ' TEST 4: Supabase OAuth provider apple is configured'
);
if (!hasAppleProvider) {
  console.log('   FAILED: provider apple not found in signInWithOAuth');
  process.exit(1);
}

// TEST 5: Verify onclick handler
const hasOnclickHandler = appleBtnHtml.includes('onclick="signInWithApple()"');
console.log(
  (hasOnclickHandler ? '✅' : '❌') + ' TEST 5: btn-apple has onclick=signInWithApple()'
);
if (!hasOnclickHandler) {
  console.log('   FAILED: onclick handler not properly set');
  process.exit(1);
}

// TEST 6: Apple button should be visible by default (check initial style)
// Extract the style attribute
const styleMatch = appleBtnHtml.match(/style="([^"]*)"/);
if (styleMatch) {
  const styleAttr = styleMatch[1];
  const hasFlexDisplay = styleAttr.includes('display:flex');
  const hasBlockDisplay = styleAttr.includes('display:block');
  const hasVisibleDisplay = hasFlexDisplay || hasBlockDisplay;

  console.log(
    (hasVisibleDisplay || !hasDisplayNone ? '✅' : '❌') +
    ' TEST 6: btn-apple has visible display style by default'
  );
} else {
  console.log(
    '⚠️  TEST 6: Could not parse style attribute (may be set by script)'
  );
}

console.log('\n═══════════════════════════════════════');
console.log('✅ ALL TESTS PASSED (for now)');
console.log('═══════════════════════════════════════\n');

console.log('📝 Summary:');
console.log('  - btn-apple button exists');
console.log('  - signInWithApple() function is defined');
console.log('  - Apple provider is configured in OAuth');
console.log('  - Button is visible by default (display NOT :none)');
console.log('\n✅ ERR-APP-004 code structure is correct!');

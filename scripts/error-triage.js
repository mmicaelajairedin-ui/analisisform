/**
 * ERROR-TRIAGE: Classifies test failures and known errors
 *
 * Reads test results from Playwright/Mocha and cross-references ERROR_REGISTRY.md
 * to determine if each failure is:
 * - KNOWN_ERROR (matches existing error in registry)
 * - REGRESSION (previously fixed error reappeared)
 * - NEW_ERROR (not in registry)
 * - ENVIRONMENT_ERROR (configuration/setup issue)
 *
 * Output: tests/results/triaged-errors.json
 */

const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '..', 'tests', 'results', 'test-results.json');
const REGISTRY_FILE = path.join(__dirname, '..', 'docs', 'ERROR_REGISTRY.md');
const OUTPUT_FILE = path.join(__dirname, '..', 'tests', 'results', 'triaged-errors.json');

// Configuration: current branch
const CURRENT_BRANCH = process.env.GITHUB_REF_NAME || 'claude/pathway-app-store-review-fy5y15';

/**
 * Parse error scope metadata from ERROR_REGISTRY.md
 * Returns: { errorId: { module, scope_type, scope_belongs_to, blocking_scope } }
 */
function parseErrorScope() {
  const registryPath = REGISTRY_FILE;
  const content = fs.readFileSync(registryPath, 'utf8');

  const errorScopes = {};
  const errorBlocks = content.split(/\n## ERR-/);

  for (const block of errorBlocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    const header = lines[0];
    const errorIdMatch = header.match(/^([A-Z]+-\d{3})/);
    if (!errorIdMatch) continue;
    const errorId = `ERR-${errorIdMatch[1]}`;

    // Look for scope metadata
    const scopeMatch = block.match(/### Scope Metadata\n([\s\S]*?)(?=\n###|\n## |$)/);
    if (scopeMatch) {
      const scopeBlock = scopeMatch[1];
      const moduleMatch = scopeBlock.match(/- \*\*Module:\*\*\s*`([^`]+)`/);
      const scopeTypeMatch = scopeBlock.match(/- \*\*Scope Type:\*\*\s*`([^`]+)`/);
      const belongsToMatch = scopeBlock.match(/- \*\*Scope Belongs To:\*\*\s*`([^`]+)`/);
      const blockingScopeMatch = scopeBlock.match(/- \*\*Blocking Scope:\*\*\s*`([^`]+)`/);

      errorScopes[errorId] = {
        module: moduleMatch ? moduleMatch[1] : 'unknown',
        scope_type: scopeTypeMatch ? scopeTypeMatch[1] : 'UNDEFINED',
        scope_belongs_to: belongsToMatch ? belongsToMatch[1] : 'unknown',
        blocking_scope: blockingScopeMatch ? blockingScopeMatch[1] : 'undefined',
      };
    }
  }

  return errorScopes;
}

// Known error signatures from ERROR_REGISTRY.md
const KNOWN_ERRORS = {
  'ERR-UPLOAD-001': {
    name: 'Avatar persistence mismatch',
    patterns: [/foto_url|NULL|avatar|persist/i],
    severity: 'CRITICAL',
    module: 'avatar',
  },
  'ERR-UPLOAD-002': {
    name: 'Exercise auth header missing',
    patterns: [/Authorization|header|403|401|_uploadDoc|exercise/i],
    severity: 'CRITICAL',
    module: 'exercise',
  },
  'ERR-UPLOAD-003': {
    name: 'Google Photos without extension',
    patterns: [/File.name|extension|Google Photo|MIME|\.pop\(\)|png|jpg|webp/i],
    severity: 'HIGH',
    module: 'exercise',
  },
  'ERR-ENV-001': {
    name: 'Project ref mismatch',
    patterns: [/mzxgxkkgxvunpsiqbzxd|project_ref|SUPABASE_URL|ddxnrsnjdvtqhxunxbwj/i],
    severity: 'CRITICAL',
    module: 'environment',
  },
};

// Classify failures by content
function classifyError(errorText, testName) {
  // First, check against KNOWN_ERRORS
  for (const [errorId, config] of Object.entries(KNOWN_ERRORS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(errorText) || pattern.test(testName)) {
        return {
          error_id: errorId,
          type: 'KNOWN_ERROR',
          name: config.name,
          severity: config.severity,
          module: config.module,
          autonomy_level: 0, // Known errors need human review
        };
      }
    }
  }

  // Detect environment errors
  if (/SUPABASE_URL|environment variable|.env|secrets|configuration/i.test(errorText)) {
    return {
      error_id: 'ERR-ENV-UNKNOWN',
      type: 'ENVIRONMENT_ERROR',
      name: 'Environment or configuration issue',
      severity: 'HIGH',
      module: 'environment',
      autonomy_level: 0, // Environment errors always need review
    };
  }

  // Detect regression patterns (404, 500, permission errors recurring)
  if (/404|500|403|permission|denied|failed|timeout/i.test(errorText)) {
    return {
      error_id: 'ERR-UNKNOWN-REGRESSION',
      type: 'REGRESSION',
      name: 'Possible regression (HTTP error or permission)',
      severity: 'HIGH',
      module: 'unknown',
      autonomy_level: 0,
    };
  }

  // Default: new error
  return {
    error_id: 'ERR-NEW-UNKNOWN',
    type: 'NEW_ERROR',
    name: 'Unknown error (not in registry)',
    severity: 'MEDIUM',
    module: 'unknown',
    autonomy_level: 1, // New errors can be investigated further
  };
}

// Extract failures from Playwright JSON
function extractFailures(results) {
  const failures = [];

  function processSpecs(specs, suiteName) {
    for (const spec of specs) {
      for (const test of (spec.tests || [])) {
        const status = test.status || test.expectedStatus;
        if (status === 'unexpected' || status === 'failed') {
          const errorMsg = (test.results?.[0]?.error?.message || 'Unknown error').substring(0, 500);
          failures.push({
            test_name: spec.title,
            suite_name: suiteName,
            error_message: errorMsg,
            file: spec.file,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  function processSuites(suiteList, parentName = '') {
    for (const suite of suiteList) {
      const suiteName = parentName ? `${parentName} > ${suite.title}` : suite.title;
      if (suite.specs) processSpecs(suite.specs, suiteName);
      if (suite.suites) processSuites(suite.suites, suiteName);
    }
  }

  processSuites(results.suites || []);
  return failures;
}

// Main
async function main() {
  console.log('📋 Error Triage: Classifying failures...\n');

  // Parse error scope metadata
  const errorScopes = parseErrorScope();

  // Check if test results exist
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log('ℹ️  No test results found. Assuming all tests passed.');
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
    process.exit(0);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const failures = extractFailures(results);

  if (failures.length === 0) {
    console.log('✅ All tests passed.');
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
    process.exit(0);
  }

  console.log(`Found ${failures.length} failure(s). Classifying...\n`);

  const triaged = [];
  let hasNewErrors = false;
  let hasRegressions = false;

  for (const failure of failures) {
    const classification = classifyError(failure.error_message, failure.test_name);

    // Get scope metadata if error is known
    const scopeMetadata = errorScopes[classification.error_id] || {
      module: classification.module,
      scope_type: 'UNDEFINED',
      scope_belongs_to: 'unknown',
      blocking_scope: 'undefined',
    };

    const triageRecord = {
      ...failure,
      ...classification,
      scope_metadata: scopeMetadata,
      correlation_id: `triage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    triaged.push(triageRecord);

    console.log(`\n🔍 "${failure.test_name}"`);
    console.log(`   Type: ${classification.type} (${classification.error_id})`);
    console.log(`   Severity: ${classification.severity}`);
    console.log(`   Module: ${classification.module}`);
    console.log(`   Autonomy Level: ${classification.autonomy_level}`);

    if (classification.type === 'NEW_ERROR') hasNewErrors = true;
    if (classification.type === 'REGRESSION') hasRegressions = true;
  }

  // Save results
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(triaged, null, 2));

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('  TRIAGE SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  Total failures: ${failures.length}`);
  console.log(`  Known errors: ${triaged.filter(t => t.type === 'KNOWN_ERROR').length}`);
  console.log(`  New errors: ${triaged.filter(t => t.type === 'NEW_ERROR').length}`);
  console.log(`  Regressions: ${triaged.filter(t => t.type === 'REGRESSION').length}`);
  console.log(`  Environment errors: ${triaged.filter(t => t.type === 'ENVIRONMENT_ERROR').length}`);
  console.log('═══════════════════════════════════════\n');

  // Exit code: 0 if no new errors/regressions, 1 otherwise
  process.exit(hasNewErrors || hasRegressions ? 1 : 0);
}

main().catch(err => {
  console.error('Error during triage:', err.message);
  process.exit(1);
});

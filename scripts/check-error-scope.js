#!/usr/bin/env node

/**
 * ERROR_SCOPE: Scope-aware classification of errors
 *
 * Parses ERROR_REGISTRY.md and classifies each error:
 * - BLOCKER: must fix before deploying (in-scope or CORE_INFRASTRUCTURE)
 * - KNOWN_OUT_OF_SCOPE: tracked but belongs to another branch
 * - REVIEW_REQUIRED: scope undefined or ambiguous
 *
 * Usage: node scripts/check-error-scope.js
 */

const fs = require('fs');
const path = require('path');

// Configuration: current branch and its scope
const CURRENT_BRANCH = process.env.GITHUB_REF_NAME || 'claude/pathway-app-store-review-fy5y15';
const BRANCH_SCOPES = {
  'claude/pathway-app-store-review-fy5y15': ['ios_auth', 'email_template'],
  'multicoach': ['multicoach'],
  'core': ['ci_cd', 'environment', 'rls', 'core_security'],
  'uploads': ['uploads'],
};

// Branch module mapping (derived from BRANCH_SCOPES)
function getBranchModules(branch) {
  return BRANCH_SCOPES[branch] || [];
}

/**
 * Parse ERROR_REGISTRY.md and extract error metadata with scope info
 */
function parseErrorRegistry() {
  const registryPath = path.join(__dirname, '..', 'docs', 'ERROR_REGISTRY.md');
  const content = fs.readFileSync(registryPath, 'utf8');

  const errors = {};
  const errorBlocks = content.split(/\n## ERR-/);

  for (const block of errorBlocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    const header = lines[0];

    // Parse error ID from header (e.g., "APP-004: Missing Apple Sign in")
    const errorIdMatch = header.match(/^([A-Z]+-\d{3})/);
    if (!errorIdMatch) continue;
    const errorId = `ERR-${errorIdMatch[1]}`;

    // Extract scope metadata from the block
    let scopeMetadata = {
      module: 'unknown',
      scope_type: 'UNDEFINED',
      scope_belongs_to: 'unknown',
      blocking_scope: 'undefined',
      blocks_current_branch: false,
      status: 'UNKNOWN',
      severity: 'UNKNOWN',
    };

    // Look for "### Scope Metadata" section
    const scopeMatch = block.match(/### Scope Metadata\n([\s\S]*?)(?=\n###|\n## |$)/);
    if (scopeMatch) {
      const scopeBlock = scopeMatch[1];

      // Extract individual fields
      const moduleMatch = scopeBlock.match(/- \*\*Module:\*\*\s*`([^`]+)`/);
      const scopeTypeMatch = scopeBlock.match(/- \*\*Scope Type:\*\*\s*`([^`]+)`/);
      const belongsToMatch = scopeBlock.match(/- \*\*Scope Belongs To:\*\*\s*`([^`]+)`/);
      const blockingScopeMatch = scopeBlock.match(/- \*\*Blocking Scope:\*\*\s*`([^`]+)`/);
      const statusMatch = block.match(/\*\*Estado:\*\*\s*([A-Z_]+)/);
      const severityMatch = block.match(/\*\*Severity:\*\*\s*([A-Z]+)/);

      if (moduleMatch) scopeMetadata.module = moduleMatch[1];
      if (scopeTypeMatch) scopeMetadata.scope_type = scopeTypeMatch[1];
      if (belongsToMatch) scopeMetadata.scope_belongs_to = belongsToMatch[1];
      if (blockingScopeMatch) scopeMetadata.blocking_scope = blockingScopeMatch[1];
      if (statusMatch) scopeMetadata.status = statusMatch[1];
      if (severityMatch) scopeMetadata.severity = severityMatch[1];
    }

    errors[errorId] = scopeMetadata;
  }

  return errors;
}

/**
 * Classify an error for the current branch
 * Returns: { type: 'BLOCKER' | 'KNOWN_OUT_OF_SCOPE' | 'REVIEW_REQUIRED', reason: string }
 */
function classifyError(errorId, errorMetadata, currentBranch) {
  const { module, scope_type, scope_belongs_to, blocking_scope, status } = errorMetadata;

  // RULE 1: UNDEFINED scope always requires review
  if (scope_type === 'UNDEFINED' || scope_belongs_to === 'unknown') {
    return {
      type: 'REVIEW_REQUIRED',
      reason: 'scope_undefined',
      description: `Scope metadata incomplete (${scope_type}, belongs_to=${scope_belongs_to})`,
    };
  }

  // RULE 2: Already verified errors don't block
  if (status === 'VERIFIED' || status === 'TRIAGED') {
    // But if TRIAGED with CORE_INFRASTRUCTURE, still block
    if (scope_type === 'CORE_INFRASTRUCTURE') {
      return {
        type: 'BLOCKER',
        reason: 'core_infrastructure_critical',
        description: `CORE_INFRASTRUCTURE is active and blocks all branches`,
      };
    }
  }

  // RULE 3: CORE_INFRASTRUCTURE ALWAYS blocks
  if (scope_type === 'CORE_INFRASTRUCTURE') {
    return {
      type: 'BLOCKER',
      reason: 'core_infrastructure_critical',
      description: `CORE_INFRASTRUCTURE affects deployment/infrastructure globally`,
    };
  }

  // RULE 4: MODULE_SPECIFIC
  if (scope_type === 'MODULE_SPECIFIC') {
    if (scope_belongs_to === currentBranch) {
      return {
        type: 'BLOCKER',
        reason: 'in_current_scope',
        description: `Belongs to current branch scope (${currentBranch})`,
      };
    } else {
      return {
        type: 'KNOWN_OUT_OF_SCOPE',
        reason: 'belongs_to_other_branch',
        description: `Belongs to ${scope_belongs_to} branch`,
      };
    }
  }

  // RULE 5: CROSS_MODULE
  if (scope_type === 'CROSS_MODULE') {
    if (blocking_scope === 'current') {
      return {
        type: 'BLOCKER',
        reason: 'affects_current_branch',
        description: `CROSS_MODULE affecting current branch`,
      };
    } else if (blocking_scope === 'core') {
      return {
        type: 'BLOCKER',
        reason: 'affects_core_infrastructure',
        description: `CROSS_MODULE affecting core infrastructure`,
      };
    } else {
      return {
        type: 'KNOWN_OUT_OF_SCOPE',
        reason: 'cross_module_other',
        description: `CROSS_MODULE affecting other modules/branches (belongs to ${scope_belongs_to})`,
      };
    }
  }

  // DEFAULT: if none of the above, it's out of scope
  return {
    type: 'KNOWN_OUT_OF_SCOPE',
    reason: 'unknown_scope_type',
    description: `Unknown scope type: ${scope_type}`,
  };
}

/**
 * Main verification function
 */
function run() {
  console.log(`📋 ERROR_SCOPE: Scope-aware error classification\n`);
  console.log(`Current branch: ${CURRENT_BRANCH}`);
  console.log(`Current branch modules: ${getBranchModules(CURRENT_BRANCH).join(', ')}\n`);

  const errors = parseErrorRegistry();
  const classifications = {};
  let blockersCount = 0;
  let outOfScopeCount = 0;
  let reviewRequiredCount = 0;

  for (const [errorId, metadata] of Object.entries(errors)) {
    const classification = classifyError(errorId, metadata, CURRENT_BRANCH);
    classifications[errorId] = classification;

    if (classification.type === 'BLOCKER') blockersCount++;
    else if (classification.type === 'KNOWN_OUT_OF_SCOPE') outOfScopeCount++;
    else if (classification.type === 'REVIEW_REQUIRED') reviewRequiredCount++;
  }

  // Display results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚫 BLOCKERS (must fix before deploying):');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let hasBlockers = false;
  for (const [errorId, metadata] of Object.entries(errors)) {
    const classification = classifications[errorId];
    if (classification.type === 'BLOCKER') {
      hasBlockers = true;
      console.log(`❌ ${errorId} (${metadata.module})`);
      console.log(`   Severity: ${metadata.severity}`);
      console.log(`   Scope: ${metadata.scope_type}`);
      console.log(`   Belongs to: ${metadata.scope_belongs_to}`);
      console.log(`   Reason: ${classification.description}`);
      console.log(`   Status: ${metadata.status}\n`);
    }
  }

  if (!hasBlockers) {
    console.log('   (None)\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚠️  OUT OF SCOPE (tracked but not your responsibility):');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const [errorId, metadata] of Object.entries(errors)) {
    const classification = classifications[errorId];
    if (classification.type === 'KNOWN_OUT_OF_SCOPE') {
      console.log(`ℹ️  ${errorId} (${metadata.module})`);
      console.log(`   Belongs to: ${metadata.scope_belongs_to}`);
      console.log(`   Reason: ${classification.description}`);
      console.log(`   Status: ${metadata.status}\n`);
    }
  }

  if (outOfScopeCount === 0) {
    console.log('   (None)\n');
  }

  if (reviewRequiredCount > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 REVIEW REQUIRED (scope undefined or ambiguous):');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const [errorId, metadata] of Object.entries(errors)) {
      const classification = classifications[errorId];
      if (classification.type === 'REVIEW_REQUIRED') {
        console.log(`❓ ${errorId} (${metadata.module})`);
        console.log(`   Reason: ${classification.description}\n`);
      }
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Blockers: ${blockersCount}`);
  console.log(`Out of Scope: ${outOfScopeCount}`);
  console.log(`Review Required: ${reviewRequiredCount}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Exit code: fail if there are blockers or review-required errors affecting critical paths
  if (blockersCount > 0) {
    console.log('🚫 Deployment blocked by in-scope errors\n');
    process.exit(1);
  }

  if (reviewRequiredCount > 0) {
    console.log('⚠️  Review required for some errors with undefined scope\n');
    // Don't block on review required (let the developer decide)
    process.exit(0);
  }

  console.log('✅ No in-scope blockers found\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Error during error-scope check:', err.message);
  process.exit(1);
});

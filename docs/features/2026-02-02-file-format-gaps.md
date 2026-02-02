# File Format Support Gaps in Monocrate

## Executive Summary

Monocrate currently only processes `.js` and `.d.ts` files for import rewriting. Support for alternative module formats (`.mjs`, `.cjs`) and their TypeScript equivalents (`.mts`, `.cts`) is missing entirely, both in implementation and testing.

---

## Implementation Gaps

### 1. Import Rewriter Filter (Critical)
**Location:** `src/import-rewriter.ts:18`

```typescript
const jsAndDtsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.d.ts'))
```

**Impact:** Files with `.mjs`, `.cjs`, `.mts`, `.cts` extensions are silently skipped. Their imports to in-repo packages will NOT be rewritten, causing broken imports in the output.

| Extension | Status |
|-----------|--------|
| `.js`     | Processed |
| `.d.ts`   | Processed |
| `.mjs`    | Skipped |
| `.cjs`    | Skipped |
| `.d.mts`  | Skipped |
| `.d.cts`  | Skipped |

---

### 2. Hardcoded `.js` Extension in Fallback Resolution
**Location:** `src/collect-package-locations.ts:39-42`

```typescript
if (subpath === '') {
  return packageJson.main ?? 'index.js'   // Hardcoded fallback
}
return `${subpath}.js`                     // Hardcoded extension
```

**Impact:** When the `exports` field doesn't provide a resolution, the fallback always appends `.js`. This breaks packages that use:
- `index.mjs` or `index.cjs` as entry points
- Subpath imports that resolve to `.mjs`/`.cjs` files

---

### 3. Package.json `type` Field - Not a Resolution Issue

**Note:** The `type` field does NOT affect extension resolution in Node.js. It only determines how `.js` files are interpreted (ESM vs CommonJS). Node.js does not "try" different extensions based on `type`.

The hardcoded `index.js` fallback in monocrate follows Node.js CommonJS resolution behavior. Packages using `.mjs` or `.cjs` entry points **must** declare them via `exports` or `main` fields - there is no automatic fallback to try different extensions.

---

### 4. Conditional Exports Not Fully Tested

The `resolve.exports` library handles conditional exports (e.g., `"import"` vs `"require"` conditions), but:
- No tests verify this works correctly
- No tests for dual-module packages with both ESM and CJS entry points

---

## Testing Gaps

### Current Test Coverage

| Scenario | Tested |
|----------|--------|
| `.js` file import rewriting | Yes |
| `.d.ts` file import rewriting | Yes |
| `.mjs` file import rewriting | No |
| `.cjs` file import rewriting | No |
| `.d.mts` / `.d.cts` handling | No |
| Package with `main` pointing to `.mjs` | No |
| Package with `main` pointing to `.cjs` | No |
| Conditional exports (`"import"` / `"require"`) | No |
| Dual-format packages (ESM + CJS) | No |
| Subpath imports resolving to `.mjs`/`.cjs` | No |

---

## Recommended Fixes

### Implementation

1. **Expand the filter** in `import-rewriter.ts:18`:
   ```typescript
   const rewritableFiles = files.filter((f) =>
     /\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/.test(f)
   )
   ```

2. **Consider requiring explicit `exports` mapping** for subpath imports, or document that packages using `.mjs`/`.cjs` entry points must use the `exports` or `main` fields.

### Testing

Add test cases for:
1. Package with `main` pointing to `.mjs` file
2. Package with `main` pointing to `.cjs` file
3. Dual-format package with conditional exports (`"import"` / `"require"`)
4. In-repo dependency using `.mjs`/`.cjs` files that need import rewriting
5. Subpath exports resolving to `.mjs`/`.cjs` files

---

## Risk Assessment

| Risk | Severity | Likelihood |
|------|----------|------------|
| Broken imports in ESM-only packages | High | Medium |
| Broken imports in dual-format packages | High | Low |
| Silent failures (files skipped without warning) | Medium | High |

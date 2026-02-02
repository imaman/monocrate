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

### 3. Package.json `type` Field Not Used
**Location:** `src/package-json.ts:29` (schema) vs `src/collect-package-locations.ts` (usage)

The `type` field is parsed in the schema but never consulted during import resolution. Node.js uses this field to determine default file extensions:
- `"type": "module"` -> default to `.mjs` semantics
- `"type": "commonjs"` -> default to `.cjs` semantics

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
| `"type": "module"` packages | No |
| `"type": "commonjs"` packages | No |
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

2. **Respect `type` field** in `resolveImport()` when no exports field exists:
   - If `type: "module"` and subpath, try `.mjs` or `.js`
   - If `type: "commonjs"` and subpath, try `.cjs` or `.js`

3. **Consider removing hardcoded extension** for subpath fallback and instead require explicit `exports` mapping.

### Testing

Add test cases for:
1. Package with `.mjs` entry point and `"type": "module"`
2. Package with `.cjs` entry point and `"type": "commonjs"`
3. Dual-format package with conditional exports
4. In-repo dependency using `.mjs`/`.cjs` files
5. Subpath imports resolving to non-`.js` extensions

---

## Risk Assessment

| Risk | Severity | Likelihood |
|------|----------|------------|
| Broken imports in ESM-only packages | High | Medium |
| Broken imports in dual-format packages | High | Low |
| Silent failures (files skipped without warning) | Medium | High |

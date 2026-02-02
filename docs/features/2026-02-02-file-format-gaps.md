# File Format Support for .mjs/.cjs in Monocrate

## Status: Implemented

Support for alternative module formats (`.mjs`, `.cjs`) and their TypeScript declaration equivalents (`.d.mts`, `.d.cts`) has been implemented.

---

## What Was Implemented

### 1. Import Rewriter Filter Expanded
**Location:** `src/import-rewriter.ts:18`

The import rewriter now processes all JavaScript and TypeScript declaration file formats:

```typescript
const rewritableFiles = files.filter((f) => /\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/.test(f))
```

| Extension | Status |
|-----------|--------|
| `.js`     | Processed |
| `.d.ts`   | Processed |
| `.mjs`    | Processed |
| `.cjs`    | Processed |
| `.d.mts`  | Processed |
| `.d.cts`  | Processed |

### 2. Test Coverage Added

New test file: `src/integration-tests/file-formats.test.ts`

| Scenario | Status |
|----------|--------|
| `.mjs` file import rewriting | Tested |
| `.cjs` file dynamic import rewriting | Tested |
| `.d.mts` file import rewriting | Tested |
| `.d.cts` file import rewriting | Tested |
| Package with `main` pointing to `.mjs` | Tested |
| Package with `main` pointing to `.cjs` | Tested |
| Conditional exports (`"import"` / `"require"`) | Tested |
| Dual-format packages (ESM + CJS) | Tested |
| Subpath exports resolving to `.mjs`/`.cjs` | Tested |
| Mixed .mjs/.cjs dependency chains | Tested |

---

## Known Limitations

### CommonJS `require()` Calls Are Not Rewritten

The import rewriter only handles ES module syntax:
- `import ... from '...'` declarations
- `export ... from '...'` declarations
- `import('...')` dynamic imports

CommonJS `require()` calls are **not** rewritten because they are regular function calls, not module syntax that ts-morph can identify as import declarations.

**Workaround:** Use dynamic `import()` instead of `require()` in `.cjs` files when importing in-repo dependencies.

### Subpath Fallback Resolution

When a package has no `exports` field, the fallback resolution appends `.js`:
- `@myorg/pkg/utils/helper` resolves to `utils/helper.js`

**Practical impact:** Low. Modern packages using `.mjs`/`.cjs` almost always have an `exports` field, which is handled correctly by `resolve.exports`.

---

## Technical Notes

### Package.json `type` Field

The `type` field does NOT affect extension resolution in Node.js. It only determines how `.js` files are interpreted (ESM vs CommonJS). Packages using `.mjs` or `.cjs` entry points must declare them via `exports` or `main` fields.

### Bare Import Resolution

Bare imports (e.g., `import ... from '@myorg/pkg'`) correctly respect the `main` field. If `main` is `"dist/index.mjs"`, that path is used. The `index.js` fallback only applies when there's no `main` field.

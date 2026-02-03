# CommonJS `require()` Path Rewriting

## Summary

Extend monocrate to rewrite `require()` calls in CommonJS modules, in addition to the existing ESM `import` rewriting. This allows monorepo packages using CommonJS to be assembled and published.

## Current Behavior

Monocrate currently rejects CommonJS files with an error:

- `.cjs` files → Error: "Cannot process a .cjs file"
- `.js` files without `"type": "module"` → Error: "Cannot process a .js file in a CommonJS package"

Only ESM files (`.mjs`, or `.js` with `"type": "module"`) are processed.

## Proposed Behavior

Monocrate will rewrite `require()` calls in CommonJS files using the same static analysis approach used for ESM imports.

### Supported Patterns

```javascript
// Static require - SUPPORTED
const utils = require('@myorg/utils');
const { helper } = require('@myorg/utils');

// Nested path - SUPPORTED
const foo = require('@myorg/utils/lib/foo');
```

### Unsupported Patterns (will error)

```javascript
// Computed/dynamic require - ERROR
const name = '@myorg/utils';
require(name);

// Aliased require - ERROR
const r = require;
r('@myorg/utils');

// Template literal - ERROR
require(`@myorg/${name}`);
```

When an unsupported pattern is detected, monocrate will throw an error with file location and guidance, similar to the existing "Computed import not supported" error for dynamic ESM imports.

## File Type Handling

After this change, monocrate will process:

| Extension | Package Type | Rewriting |
|-----------|--------------|-----------|
| `.mjs` | Any | ESM imports |
| `.js` | `"type": "module"` | ESM imports |
| `.cjs` | Any | CommonJS require |
| `.js` | `"type": "commonjs"` or unset | CommonJS require |
| `.d.ts`, `.d.mts` | Any | ESM imports (type declarations) |
| `.d.cts` | Any | CommonJS require (type declarations) |

## Technical Approach

Use ts-morph (already a dependency) to find and rewrite `require()` calls:

1. Find all `CallExpression` nodes where the callee is the identifier `require`
2. Verify the first argument is a `StringLiteral` (error otherwise)
3. Apply the same path resolution logic used for ESM imports
4. Update the string literal value

This mirrors the existing approach for `import()` dynamic imports in `import-rewriter.ts`.

## Limitations

Static analysis cannot detect aliased `require()` calls:

```javascript
const r = require;
r('./foo');  // Not detected - will fail at runtime
```

This is an inherent limitation of static rewriting. The alternative (runtime hooking) would not produce transformed files on disk, which monocrate requires for publishing.

**Mitigation**: Aliased require is rare in practice. Most CommonJS code uses direct `require()` calls. We will document this limitation clearly.

## Error Messages

**Computed require:**
```
Computed require not supported: require(${expr}) at src/index.cjs:15.
CommonJS require() calls must use string literals so monocrate can analyze and rewrite them.
```

**Aliased require (if detected):**
```
Aliased require not supported at src/index.cjs:10.
The 'require' function appears to be aliased. Monocrate can only rewrite direct require() calls.
```

## Testing

Add tests for:
- Basic `.cjs` file rewriting
- `.js` files in CommonJS packages (no `"type": "module"`)
- `.d.cts` type declaration rewriting
- Nested `require()` paths
- Error cases: computed require, template literals
- Mixed packages: ESM main package depending on CommonJS in-repo dependency

## Migration

This is a backwards-compatible change. Packages that previously errored will now work. Existing ESM packages are unaffected.

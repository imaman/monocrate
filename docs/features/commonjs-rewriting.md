# CommonJS `require()` Path Rewriting

## Summary

Extend monocrate to support CommonJS modules by intercepting `require()` calls at runtime. This allows monorepo packages using CommonJS to be assembled and published.

## Current Behavior

Monocrate currently rejects CommonJS files with an error:

- `.cjs` files → Error: "Cannot process a .cjs file"
- `.js` files without `"type": "module"` → Error: "Cannot process a .js file in a CommonJS package"

Only ESM files (`.mjs`, or `.js` with `"type": "module"`) are processed.

## Proposed Behavior

Monocrate will inject a runtime hook that intercepts `require()` calls and rewrites in-repo package paths to their assembled locations.

### How It Works

1. Monocrate generates a bootstrap module (`__monocrate_bootstrap__.cjs`) in the assembled output
2. The bootstrap sets up a `Module._resolveFilename` hook before any application code runs
3. When `require('@myorg/utils')` is called, the hook rewrites it to the correct path (`./deps/__myorg__utils/dist/index.js`)
4. The package.json `main` field (if pointing to a CJS file) is updated to load the bootstrap first

### All Patterns Supported

```javascript
// Direct require - works
const utils = require('@myorg/utils');

// Computed require - works
const name = '@myorg/utils';
require(name);

// Aliased require - works
const r = require;
r('@myorg/utils');

// Template literal - works
require(`@myorg/${name}`);
```

The runtime hook intercepts all `require()` calls regardless of how they're written.

## File Type Handling

After this change, monocrate will process:

| Extension | Package Type | Mechanism |
|-----------|--------------|-----------|
| `.mjs` | Any | Static rewriting (existing) |
| `.js` | `"type": "module"` | Static rewriting (existing) |
| `.cjs` | Any | Runtime hook |
| `.js` | `"type": "commonjs"` or unset | Runtime hook |
| `.d.ts`, `.d.mts` | Any | Static rewriting (existing) |
| `.d.cts` | Any | No rewriting needed (type declarations only) |

ESM continues to use static rewriting since `import` is a keyword that cannot be aliased.

## Technical Approach

### Bootstrap Module

Monocrate generates a bootstrap file that:

1. Captures the original `Module._resolveFilename`
2. Installs a wrapper that checks if the request matches an in-repo package
3. If matched, resolves to the assembled location; otherwise delegates to the original

```javascript
// __monocrate_bootstrap__.cjs (generated)
const Module = require('module');
const path = require('path');

const packageMap = {
  '@myorg/utils': './deps/__myorg__utils/dist/index.js',
  // ... other in-repo packages
};

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  const mapped = packageMap[request];
  if (mapped && parent?.filename) {
    const resolvedPath = path.resolve(path.dirname(parent.filename), mapped);
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
```

### Entry Point Wrapping

For packages with a CJS entry point, monocrate creates a wrapper that loads the bootstrap first:

```javascript
// Original main: dist/index.js (CJS)
// Assembled main: dist/index.js becomes:

require('./__monocrate_bootstrap__.cjs');
module.exports = require('./__original_index__.js');
```

Alternatively, if the package uses `"exports"` in package.json, we can prepend the bootstrap require to each CJS entry file.

### When Bootstrap Is Needed

The bootstrap is only generated when:
- The assembled package contains CommonJS files, AND
- Those files import in-repo packages

If a package is pure ESM or has no in-repo dependencies, no bootstrap is needed.

## Stability of `Module._resolveFilename`

Despite being an internal Node.js API, `Module._resolveFilename` is the de facto standard for module resolution hooking. It has remained stable since Node 0.x and is used by widely-adopted tools:

- ts-node
- @babel/register
- pirates
- proxyquire

Breaking this API would break a significant portion of the Node.js ecosystem.

## Testing

Add tests for:
- Basic `.cjs` file with in-repo dependency
- `.js` files in CommonJS packages (no `"type": "module"`)
- Computed/dynamic require patterns
- Mixed packages: ESM main package depending on CommonJS in-repo dependency
- Pure CJS monorepo
- Verify bootstrap is not generated when not needed

## Migration

This is a backwards-compatible change. Packages that previously errored will now work. Existing ESM packages are unaffected.

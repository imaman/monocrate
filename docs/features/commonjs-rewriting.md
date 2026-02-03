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

### Performance Consideration

Since `Module` is a process-wide singleton, naively chaining hooks (one per monocrate package) would add O(N) overhead to every `require()` call. Instead, we use a single shared hook with O(1) lookup.

### Single Shared Hook with Registry

All monocrate packages share one hook. Each package registers its mappings with the hook rather than installing its own.

The registry is keyed by **package name** (extracted from the request), making lookups O(1):

```javascript
// __monocrate_bootstrap__.cjs (generated)
const Module = require('module');
const path = require('path');

const MY_ROOT = __dirname;
const MY_MAPPINGS = {
  '@myorg/utils': './deps/__myorg__utils/dist/index.js',
  // ... other in-repo packages
};

// Extract package name: '@foo/bar/sub' -> '@foo/bar', 'foo/sub' -> 'foo'
function getPackageName(request) {
  if (request.startsWith('@')) {
    const parts = request.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined;
  }
  const first = request.split('/')[0];
  return first || undefined;
}

// Check if monocrate hook already exists
if (Module._resolveFilename.__monocrateRegistry) {
  // Register with existing hook
  for (const [pkgName, resolved] of Object.entries(MY_MAPPINGS)) {
    const existing = Module._resolveFilename.__monocrateRegistry.get(pkgName);
    if (existing) {
      existing.set(MY_ROOT, resolved);
    } else {
      Module._resolveFilename.__monocrateRegistry.set(pkgName, new Map([[MY_ROOT, resolved]]));
    }
  }
} else {
  // First monocrate package - install the hook
  // Registry: packageName -> Map<packageRoot, resolvedPath>
  const registry = new Map();
  for (const [pkgName, resolved] of Object.entries(MY_MAPPINGS)) {
    registry.set(pkgName, new Map([[MY_ROOT, resolved]]));
  }

  const original = Module._resolveFilename;

  const hook = function(request, parent, isMain, options) {
    const pkgName = getPackageName(request);
    const mappings = pkgName ? registry.get(pkgName) : undefined;

    if (mappings && parent?.filename) {
      // Find which package root this require originates from
      for (const [root, resolved] of mappings) {
        if (parent.filename.startsWith(root)) {
          return original.call(this, path.resolve(root, resolved), parent, isMain, options);
        }
      }
    }
    return original.call(this, request, parent, isMain, options);
  };

  hook.__monocrateRegistry = registry;
  Module._resolveFilename = hook;
}
```

### Performance Analysis

- **Non-monocrate requires (vast majority):** O(1) - one `getPackageName` call, one Map lookup returning `undefined`
- **Monocrate-managed requires:** O(K) where K = number of monocrate packages depending on that specific in-repo package (typically 1-3)

This eliminates the "tax on every require" problem. The overhead for unrelated requires is negligible.

### Bootstrap Injection

Every CommonJS file in the assembled package gets this line prepended:

```javascript
require('./__monocrate_bootstrap__.cjs');
```

The relative path is computed based on the file's depth (e.g., `../` for files in subdirectories).

Node's require cache ensures the bootstrap executes only once per package, regardless of how many files require it.

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

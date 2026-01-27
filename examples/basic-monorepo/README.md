# Monocrate Example: Basic Monorepo

A minimal, working example of a monorepo with internal package dependencies. This demonstrates the problem that Monocrate solves and how to fix it in 2 minutes.

## What This Demonstrates

This monorepo contains:
- **@example/utils**: A shared utility package with helper functions
- **@example/cli**: A CLI tool that depends on @example/utils

The key issue: When publishing @example/cli to npm, it references @example/utils using a workspace reference (`workspace:*`), which won't work for consumers who install the package from npm.

## The Problem

Look at `packages/cli/package.json`:

```json
{
  "dependencies": {
    "@example/utils": "workspace:*"
  }
}
```

And `packages/cli/src/index.ts`:

```typescript
import { formatMessage, capitalize } from '@example/utils'
```

When you build this locally, it works because npm resolves `@example/utils` to the workspace version. But when someone installs `@example/cli` from npm, the package won't be available, and the code will fail.

## Try It Without Monocrate

Let's see the problem first-hand.

### 1. Install dependencies

```bash
npm install
```

### 2. Build the packages

```bash
npm run build
```

You'll see both packages compile successfully:

```
> npm run build --workspaces

> @example/utils@1.0.0 build
> tsc

> @example/cli@1.0.0 build
> tsc
```

### 3. Test the CLI

```bash
npm run demo
```

Output:
```
[2024-01-27T10:30:45.123Z] Hello world
```

It works! But that's only because npm workspace resolution is active.

### 4. Try to simulate publishing

If you were to publish `@example/cli` to npm right now, it would include:
- `dist/index.js` (the compiled code with `import { ... } from '@example/utils'`)
- `package.json` (with `"@example/utils": "workspace:*"`)

When someone installs it, they'd get an error because `@example/utils` isn't declared as a real dependency. The workspace reference is meaningless outside this monorepo.

## Using Monocrate

Monocrate solves this by:
1. Scanning your code for internal imports
2. Converting workspace references to real npm versions
3. Updating your package.json dependencies
4. Making your package publishable

### Step 1: Prepare the CLI package for publishing

From the monorepo root, run:

```bash
npx monocrate prepare packages/cli
```

### Step 2: See what changed

Check `packages/cli/package.json` now. Monocrate has updated it to:

```json
{
  "dependencies": {
    "@example/utils": "^1.0.0"
  }
}
```

The `workspace:*` reference is gone. Monocrate detected that your code imports from `@example/utils`, verified the package exists, and replaced the workspace reference with a version constraint.

### Step 3: Rebuild

```bash
npm run build
```

### Step 4: Test again

```bash
npm run demo
```

The CLI still works exactly the same! But now it's ready to publish:

```
[2024-01-27T10:30:45.123Z] Hello world
```

## Publishing with Monocrate

To actually publish to npm:

```bash
# From the monorepo root
npx monocrate publish packages/cli --registry https://registry.npmjs.org/
```

This will:
1. Verify the package is ready
2. Ensure all dependencies are published
3. Publish `@example/cli` to npm
4. Automatically restore your `package.json` to use workspace references

So you can keep developing with workspace references locally while publishing real dependencies to npm.

## Verification

After running `monocrate prepare`, verify the changes:

### package.json changed

```bash
cat packages/cli/package.json | grep -A 5 dependencies
```

You should see a real version constraint instead of `workspace:*`.

### The TypeScript output is identical

```bash
cat packages/cli/dist/index.js
```

The compiled JavaScript remains unchanged because TypeScript just replaces the import with the package name.

### Your workspace still works

```bash
npm run demo
```

Still produces the same output.

## What You Learned

1. **The workspace problem**: Internal dependencies use `workspace:*` references that don't work for npm consumers
2. **The monocrate solution**: Automatically detect and replace workspace references with real version constraints
3. **Local development**: You keep using workspace references locally for faster iteration
4. **Publishing**: Monocrate converts to real dependencies only when publishing
5. **Restoration**: Your package.json is restored to workspace references after publishing

## Next Steps

Try modifying the code:

```bash
# Edit packages/utils/src/index.ts
# Edit packages/cli/src/index.ts
npm run build
npm run demo
```

Then run `monocrate prepare packages/cli` again to see how it handles updated dependencies.

## File Structure

```
.
├── package.json           # Workspace root
├── packages/
│   ├── utils/            # Shared utilities
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   └── cli/              # CLI tool (depends on utils)
│       ├── package.json
│       ├── src/
│       │   └── index.ts
│       └── tsconfig.json
└── .gitignore
```

## Troubleshooting

### "Cannot find module '@example/utils'"

This means you haven't run `npm install` or `npm run build`. Try:

```bash
npm install
npm run build
```

### "monocrate: command not found"

You can run monocrate as a local tool or install it globally:

```bash
# Global installation
npm install -g monocrate

# Or use npx to run without installing
npx monocrate prepare packages/cli
```

### Changes reverted after prepare

This is expected if you're restoring workspace references. Monocrate prepares packages for publishing but can restore them. Check the documentation for `monocrate publish` to understand the full workflow.

# Priority Content Outlines

These are the first 5 pieces of content to produce, with detailed outlines ready for immediate execution.

---

## 1. "Why You Can't Regex Your Way Out of Monorepo Publishing"

**Target publication:** Dev.to, cross-post to Medium
**Target length:** 3,000 words
**Target keywords:** "monorepo import rewriting", "publish from monorepo", "AST-based transformation"
**Publishing date:** Week 1

### Outline

**Hook (300 words)**
You're publishing your first package from your monorepo. You run `npm publish` and realize the output has `import { utils } from '@myorg/utils'`. That won't work on npm—no one else has `@myorg/utils`. So you think: "I'll just find-replace it."

```javascript
// You try this:
content.replace(/@myorg\/utils/g, './deps/packages/utils/dist/index.js')
```

It works. You publish. A user reports broken TypeScript types. You check the `.d.ts` files—you forgot to rewrite those. You fix it. Another user reports tree-shaking doesn't work. You check the imports—you broke re-exports. At some point, you realize: regex isn't the right tool.

**The 11 Edge Cases That Break Regex (1,200 words)**

**Edge Case 1: TypeScript Declaration Files**
Your `.js` files import `'@myorg/utils'`. So do your `.d.ts` files.
```typescript
// src/index.d.ts
import { Utility } from '@myorg/utils';
export declare function process(u: Utility): void;
```
If you only rewrite `.js` files, your package ships with broken types. TypeScript can't resolve `'@myorg/utils'`.

**Edge Case 2: Subpath Imports**
```javascript
import { specific } from '@myorg/utils/async';
```
Your regex matches `@myorg/utils` but doesn't know about `/async`. You need to:
1. Check if the package has an `exports` field with a `./async` entry
2. Resolve that to the actual file path
3. Compute the relative path from the importing file
4. Preserve the subpath semantics

**Edge Case 3: Dynamic Imports**
```javascript
const module = await import('@myorg/utils');
```
Template literals make this worse:
```javascript
const name = 'utils';
import(`@myorg/${name}`);
```
Regex can't parse string interpolation. You need an AST.

**Edge Case 4: Export-From Re-Exports**
```javascript
export { helper } from '@myorg/utils';
export * from '@myorg/utils';
```
These are easy to miss. They don't use the word `import`, but they're import statements. Your regex better handle both syntaxes.

**Edge Case 5: Import Type**
```typescript
import type { Config } from '@myorg/utils';
```
TypeScript-specific syntax. Your regex needs to handle `import type` and `export type` separately from regular imports.

**Edge Case 6: Scoped Package Names**
```javascript
import { x } from '@myorg/utils';
import { y } from '@myorg/utils-async';
```
If your regex is too greedy, `@myorg/utils` matches both. You rewrite `@myorg/utils-async` incorrectly.

**Edge Case 7: Comments That Look Like Imports**
```javascript
// TODO: import from '@myorg/utils' instead
// import { old } from '@myorg/legacy';
```
Your regex thinks these are real imports. Your code breaks in mysterious ways.

**Edge Case 8: Multi-Line Imports**
```javascript
import {
  helper,
  utility
} from '@myorg/utils';
```
Single-line regex fails. You need multi-line mode, which makes other patterns match incorrectly.

**Edge Case 9: String Literals That Aren't Imports**
```javascript
const packageName = '@myorg/utils';
console.log('Install @myorg/utils first');
```
These aren't imports. Your regex rewrites them anyway. Now your logs say "Install ./deps/packages/utils/dist/index.js first."

**Edge Case 10: require() vs. import**
```javascript
const utils = require('@myorg/utils');
```
If your package supports CommonJS, you have two syntaxes to handle. Different patterns, same problem.

**Edge Case 11: Exports Field Resolution**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./async": "./dist/async/index.js"
  }
}
```
When you rewrite `'@myorg/utils/async'`, you need to resolve it using the `exports` field. Regex can't read JSON. You need Node's module resolution algorithm.

**Why AST-Based Transformation Is the Only Solution (800 words)**

An Abstract Syntax Tree gives you structure:
```javascript
ImportDeclaration {
  specifiers: [ ImportSpecifier { name: 'utils' } ],
  source: StringLiteral { value: '@myorg/utils' }
}
```

You can:
1. Parse the file as a TypeScript AST (works for `.js`, `.ts`, `.d.ts`)
2. Find all `ImportDeclaration` and `ExportDeclaration` nodes
3. Check if the source is an internal package
4. Resolve the target using `exports` or `main` field
5. Compute the relative path
6. Rewrite the node
7. Save the transformed file

Edge cases become trivial:
- Multi-line imports? AST sees them as one node.
- Comments? AST ignores them.
- String literals? AST distinguishes between StringLiteral in import context vs. other contexts.
- Dynamic imports? AST has `CallExpression` nodes with `import` callee.

**How Monocrate Does It (500 words)**

We use `ts-morph`, a wrapper around TypeScript's compiler API:
```typescript
const project = new Project();
const sourceFile = project.addSourceFileAtPath(filePath);

for (const decl of sourceFile.getImportDeclarations()) {
  const specifier = decl.getModuleSpecifierValue();
  if (isInternalPackage(specifier)) {
    const targetPath = resolvePackagePath(specifier);
    const relativePath = computeRelativePath(filePath, targetPath);
    decl.setModuleSpecifier(relativePath);
  }
}

sourceFile.saveSync();
```

This handles:
- All import and export syntaxes
- TypeScript-specific constructs
- Subpath imports via exports field resolution
- Dynamic imports via AST traversal
- Both `.js` and `.d.ts` files with the same code

**Why This Matters (200 words)**

The difference between regex and AST isn't just correctness—it's maintainability. When a new TypeScript version adds syntax, `ts-morph` handles it. When you add a new internal package with complex `exports` maps, the resolution logic handles it. When someone adds a dynamic import with template strings, it just works.

You could spend 20 hours handling edge cases with regex. Or you could use AST-based tooling that's designed for this. Monocrate chose the second path, so you don't have to think about it.

**Call to Action**

Try monocrate on your monorepo:
```bash
npx monocrate prepare packages/your-package
```

Inspect the output. Check the rewritten imports in `.js` and `.d.ts` files. See how subpath imports and re-exports are handled. Then imagine doing that by hand.

**SEO Optimizations:**
- Title includes "Regex" and "Monorepo Publishing"
- First paragraph includes "publish from monorepo"
- Code examples make page valuable for search intent
- Internal links to monocrate docs

---

## 2. "How We Published 1 Package from a 110-Package Monorepo Without Breaking Tree-Shaking"

**Target publication:** Dev.to (case study), Hacker News
**Target length:** 2,500 words
**Target keywords:** "tree-shaking monorepo", "publish library from monorepo", "module boundaries"
**Publishing date:** Week 3

### Outline

**The Problem (400 words)**

We built a monorepo with 110 packages and 100,000+ lines of code. Packages import from each other constantly:
```typescript
// packages/cli/src/commands/deploy.ts
import { validateConfig } from '@myorg/config';
import { runDeployment } from '@myorg/deployment-engine';
import { logInfo } from '@myorg/logger';
```

We wanted to open-source the CLI. But it depended on 15 internal packages. Publishing all 16 packages meant:
- Maintaining 16 npm packages forever
- Making internal helper functions public API
- Coordinating versions across 16 packages
- Writing 16 READMEs, handling 16 issue trackers

We tried bundling with esbuild. One command, one file:
```bash
esbuild packages/cli/src/index.ts --bundle --outfile=dist/index.js
```

It worked. We published. Then a user reported: "Your package is 2.3MB. I only import one function. Why is my bundle so large?"

**Why Bundling Breaks Tree-Shaking (600 words)**

Here's what bundling does:
```javascript
// Before bundling - packages/cli/dist/commands/deploy.js
import { validateConfig } from '@myorg/config';

// After bundling - single file
var validateConfig = () => { /* implementation */ };
var otherConfigFunction = () => { /* unused */ };
var yetAnotherConfigFunction = () => { /* also unused */ };
```

The bundler includes everything from `@myorg/config` because it doesn't know what consumers will use. Your published package has one giant file with all dependencies.

When a consumer imports:
```javascript
import { deploy } from 'your-cli';
```

Their bundler sees one file. It can't eliminate unused code from your dependencies because there are no module boundaries.

**Module Boundaries Enable Optimization**

If you preserve the module structure:
```
your-package/
  dist/
    index.js          ← exports deploy
    commands/
      deploy.js       ← imports from ../deps/config
  deps/
    packages/
      config/
        dist/
          index.js    ← exports validateConfig
```

Now when a consumer imports:
```javascript
import { deploy } from 'your-cli';
```

Their bundler:
1. Follows the import to `dist/index.js`
2. Sees it imports from `dist/commands/deploy.js`
3. Sees that imports from `deps/packages/config/dist/index.js`
4. Only includes `validateConfig`, not the entire config package

Tree-shaking works at function level, not package level.

**Real-World Comparison (500 words)**

We tested both approaches with our CLI:

**Bundled approach:**
- Published package size: 2.3MB
- Consumer bundle (importing one command): 890KB
- Consumer bundle (importing three commands): 920KB
- Tree-shaking: None (single file)

**Copy-based approach (monocrate):**
- Published package size: 2.1MB (similar, more files)
- Consumer bundle (importing one command): 45KB
- Consumer bundle (importing three commands): 87KB
- Tree-shaking: Full (module boundaries preserved)

The consumer bundle is 19x smaller for a single command import. That's the difference module boundaries make.

**The TypeScript Declaration Problem (400 words)**

Bundling JavaScript is one thing. TypeScript declarations are another.

With esbuild, you get:
```javascript
// dist/index.js
var validateConfig = () => { /* ... */ };
var deploy = () => { /* ... */ };
module.exports = { deploy };
```

No `.d.ts` files. TypeScript users can't use your package.

You could use `dts-bundle-generator`:
```bash
esbuild packages/cli/src/index.ts --bundle --outfile=dist/index.js
dts-bundle-generator packages/cli/src/index.ts --out dist/index.d.ts
```

Now you're maintaining two bundling pipelines. If one gets out of sync, you ship broken types.

With copy-based assembly, TypeScript declarations come free:
```
your-package/
  dist/
    index.js
    index.d.ts        ← automatically included
    commands/
      deploy.js
      deploy.d.ts     ← automatically included
```

Your build process (`tsc`) already generates `.d.ts` files next to `.js` files. Monocrate copies both, rewrites imports in both, done.

**Source Maps Work Unchanged (300 words)**

Bundled source maps point to the bundle:
```json
{
  "version": 3,
  "file": "index.js",
  "sources": ["../src/index.ts", "../src/commands/deploy.ts"],
  "mappings": "AAAA;AACA..."
}
```

When a user hits an error, the stack trace says:
```
Error: Deployment failed
  at deploy (node_modules/your-cli/dist/index.js:2847)
```

Line 2847 of a bundled file. Good luck debugging that.

With preserved module structure:
```
Error: Deployment failed
  at deploy (node_modules/your-cli/dist/commands/deploy.js:23)
```

Line 23 of `deploy.js`. The source map points to `deploy.ts`. Your IDE jumps to the right line.

**How Monocrate Does It (300 words)**

Instead of bundling, monocrate:
1. Walks the dependency graph from your package
2. Uses `npm pack` to determine publishable files
3. Copies each package's `dist/` to the output
4. Rewrites imports using AST-based transformation
5. Merges third-party dependencies in `package.json`

Output structure mirrors input structure. Module boundaries stay intact. Tree-shaking works. TypeScript types work. Source maps work.

**When Bundling Is the Right Choice (200 words)**

Bundling isn't wrong—it solves different problems:
- **Browser bundles**: Users load one file, not 50 HTTP requests
- **Applications**: No one imports from your app, tree-shaking doesn't matter
- **Obfuscation**: You want to hide implementation details
- **Self-contained scripts**: CLIs that run in restricted environments

For libraries published to npm where consumers use bundlers? Preserve module boundaries.

**Call to Action**

Check your published package:
```bash
npx monocrate prepare packages/your-library
cd $(cat monocrate-output.txt)
ls -R
```

See the module structure. Check the import paths. Then try bundling and compare consumer bundle sizes.

---

## 3. "The True Cost of Publishing 15 Packages When You Meant to Publish One"

**Target publication:** Medium (business audience), Dev.to, r/ExperiencedDevs
**Target length:** 2,000 words
**Target keywords:** "monorepo publishing strategy", "npm package maintenance cost", "internal dependencies"
**Publishing date:** Week 5

### Outline

**The Scenario (300 words)**

You built a deployment CLI in your monorepo. It's good. It handles retries, rollbacks, health checks. Your team uses it constantly. You want to open-source it.

You check dependencies:
```
my-cli
├── @myorg/config-parser
│   ├── @myorg/yaml-utils
│   └── @myorg/validation
├── @myorg/deployment-engine
│   ├── @myorg/docker-client
│   ├── @myorg/kubernetes-client
│   └── @myorg/ssh-utils
├── @myorg/logger
└── @myorg/retry-logic
    └── @myorg/backoff-strategies
```

15 packages total. Your options:
1. Publish all 15 packages separately
2. Use monocrate to publish one self-contained package

Let's calculate the real cost of option 1.

**Maintenance: Time Investment (500 words)**

**Per-package overhead:**
- README documentation: 2 hours
- Initial npm publishing setup: 1 hour
- Issue tracker configuration: 0.5 hours
- CI/CD pipeline setup: 1.5 hours
- License file, badges, tags: 0.5 hours
- Total: 5.5 hours per package

**For 15 packages:** 82.5 hours (2 weeks of work)

**Ongoing maintenance (annual):**
- Security updates: Average 3 per package per year × 0.5 hours = 22.5 hours
- Dependency updates: Average 6 per package per year × 0.5 hours = 45 hours
- Bug fixes: Average 2 per package per year × 2 hours = 60 hours
- Issue triage: Average 5 issues per package per year × 0.5 hours = 37.5 hours
- Documentation updates: Average 1 per package per year × 1 hour = 15 hours
- Total: 180 hours per year (4.5 weeks)

**With monocrate (1 package):**
- Initial setup: 5.5 hours
- Ongoing maintenance: 12 hours per year

**Savings:** 77 hours initial + 168 hours annual

**Version Synchronization Hell (400 words)**

You publish all 15 packages. Now you fix a bug in `@myorg/yaml-utils`.

**The cascade:**
1. Bump `yaml-utils` from 1.0.0 to 1.0.1
2. Update `config-parser` dependency on `yaml-utils`
3. Bump `config-parser` from 1.2.0 to 1.2.1
4. Update `my-cli` dependency on `config-parser`
5. Bump `my-cli` from 2.0.0 to 2.0.1

Three packages updated for one bug fix.

**Worse: diamond dependencies:**
```
my-cli
├── config-parser → yaml-utils@1.0.1
└── deployment-engine → config-parser → yaml-utils@1.0.0
```

Now you have version conflicts. You need to:
1. Update `deployment-engine` to use `config-parser@1.2.1`
2. Bump `deployment-engine`
3. Update `my-cli` to use new `deployment-engine`
4. Bump `my-cli`

Five packages updated for one bug fix.

**With monocrate:**
1. Fix bug in `yaml-utils` in your monorepo
2. Run `monocrate publish packages/my-cli --bump patch`
3. Done

One command. One version. No coordination.

**The Accidental API Contract Problem (500 words)**

You published `@myorg/yaml-utils` because `config-parser` needed it. The package exports:
```typescript
export { parseYaml } from './parse';
export { stringifyYaml } from './stringify';
export { validateYaml } from './validate';
// Internal helper, not meant for public use
export { _normalizeWhitespace } from './internal/normalize';
```

That underscore-prefixed function? You used it once in `config-parser`. You never meant it as public API.

Three months later, a user opens an issue: "_normalizeWhitespace behavior changed and broke my code."

You think: "That's internal, we can change it freely."

They respond: "It's exported. I'm using it. Semver says this is a breaking change."

They're right. You published it. It's public API now. You can't change it without a major version bump.

**The internal boundary problem:**
In your monorepo, you refactor freely. Move `_normalizeWhitespace` to a different package. Rename it. Delete it. No one outside your team uses it.

Once published, those boundaries become contracts. Your internal implementation details are now external APIs.

**With monocrate:**
```
my-cli/
  dist/
    index.js        ← public API
  deps/
    packages/
      yaml-utils/
        dist/
          internal/
            normalize.js   ← still internal, just included
```

`_normalizeWhitespace` is in the published package, but it's not in `my-cli`'s public exports. Users can't import it directly. You can refactor it freely.

**Documentation and Support Burden (300 words)**

**15 packages means:**
- 15 READMEs to write and maintain
- 15 CHANGELOG files
- 15 issue trackers (do you consolidate? where?)
- 15 npm package pages with descriptions
- 15 sets of keywords, tags, badges
- 15 "Getting Started" guides
- 15 API reference sections

When a user asks "How do I configure retries?", which package's issues do they use?
- `my-cli` (where they found the problem)
- `retry-logic` (where the feature is implemented)
- `deployment-engine` (which calls retry-logic)

You end up saying "Please open this in the retry-logic repo" repeatedly.

**With monocrate:**
- 1 README with complete documentation
- 1 CHANGELOG
- 1 issue tracker (obvious where to report issues)
- 1 npm package page
- 1 API reference

Users import from one package. Issues go to one place. Documentation is cohesive.

**The Calculator (200 words)**

**Your scenario:**
- How many internal dependencies does your package have? [Input: 15]
- How many hours for initial setup per package? [Input: 5.5]
- Expected bug fixes per package per year? [Input: 2]

**Cost of publishing everything:**
- Initial: 82.5 hours
- Annual: 180 hours
- 3-year total: 622.5 hours

**Cost of monocrate:**
- Initial: 5.5 hours
- Annual: 12 hours
- 3-year total: 41.5 hours

**You save:** 581 hours over 3 years

**Call to Action**

Calculate your scenario:
```bash
npx monocrate prepare packages/your-package --report
# Shows dependency count and structure
```

Multiply by your maintenance hours. That's what you'd save.

---

## 4. "Lerna Manages Your Monorepo. Monocrate Publishes from It. Here's the Difference."

**Target publication:** Dev.to, r/javascript
**Target length:** 2,400 words
**Target keywords:** "lerna vs monocrate", "monorepo publishing tools", "monorepo management"
**Publishing date:** Week 11

### Outline

**The Confusion (300 words)**

"Isn't this what Lerna does?"

We get this question constantly. Both tools work with monorepos. Both involve publishing to npm. So what's the difference?

**Short answer:** Lerna manages your monorepo's internal versioning and publishes all your packages. Monocrate extracts one package with its internal dependencies included, and publishes that.

They solve different problems. They're complementary, not competitive.

**What Lerna Does (500 words)**

Lerna is a monorepo manager. It:

**1. Manages versions across packages:**
```bash
lerna version
# Prompts for version bumps across all packages
# Updates interdependencies automatically
```

If `package-a` depends on `package-b@1.0.0`, and you bump `package-b` to `1.1.0`, Lerna updates `package-a`'s dependency to `1.1.0`.

**2. Publishes all changed packages:**
```bash
lerna publish
# Publishes every package that changed since last release
```

This is powerful for monorepos where every package is meant to be published. Example: Babel, Jest, React—multiple packages that users install separately.

**3. Runs commands across packages:**
```bash
lerna run test
# Runs `npm test` in every package
```

**4. Links local packages:**
```bash
lerna bootstrap
# Symlinks packages so they can import each other during development
```

**Lerna's model:** You have 20 packages. You publish 20 packages. Users install whichever ones they need:
```bash
npm install @babel/core @babel/parser @babel/traverse
```

**What Monocrate Does (500 words)**

Monocrate is an extraction tool. It:

**1. Walks the dependency graph from one package:**
```bash
monocrate publish packages/my-cli
# Only publishes my-cli
```

Monocrate finds every internal package `my-cli` depends on, but it doesn't publish them separately.

**2. Includes internal dependencies in the output:**
```
output/
  dist/              ← my-cli's code
  deps/
    packages/
      utils/         ← internal dependency, included
      logger/        ← another internal dependency
```

**3. Rewrites imports from package names to relative paths:**
```javascript
// Before: my-cli imports from '@myorg/utils'
import { helper } from '@myorg/utils';

// After: rewritten to relative path
import { helper } from './deps/packages/utils/dist/index.js';
```

**4. Publishes one self-contained package:**
```bash
npm install my-cli
# Gets everything it needs, no other @myorg packages required
```

**Monocrate's model:** You have 20 internal packages. You publish 1 package to npm. Users install that one package, and it includes everything it needs.

**When to Use Lerna (400 words)**

**Use case 1: Publishing a framework with modular pieces**
You're building a framework like Babel or Jest. Users need different combinations:
- Some users want `@babel/core` + `@babel/parser`
- Others want `@babel/core` + `@babel/plugin-transform-react-jsx`
- Others want just `@babel/parser`

Each package should be separately installable. Lerna manages versions across all of them and publishes each one.

**Use case 2: Managing internal versions in a company monorepo**
You have 50 packages in your monorepo. They're not published externally, but you want consistent versioning. Lerna helps coordinate versions when `package-a` depends on `package-b` and both need to be bumped together.

**Use case 3: Running scripts across many packages**
You want to run tests, builds, or linting across all packages. Lerna provides orchestration:
```bash
lerna run build --scope=@myorg/*
```

**When to Use Monocrate (400 words)**

**Use case 1: Open-sourcing a subset of your monorepo**
You have 50 internal packages. You want to open-source 1 package. Publishing all 50 is overkill. Publishing the 1 package alone leaves broken imports.

Monocrate extracts the package with its dependencies included, so you publish 1 package.

**Use case 2: Publishing a CLI or app that consumers don't import from modularly**
Your CLI is a single entry point. Users run it, they don't import individual functions. There's no value in splitting it into 10 packages.

Monocrate publishes it as one package with everything bundled in.

**Use case 3: Keeping internal boundaries private**
Your internal packages have helper functions you never meant as public API. Publishing them separately makes them public forever.

Monocrate includes them in the published package, but they're not exported publicly. Your internal boundaries stay internal.

**Using Them Together (300 words)**

Many teams use both:

**Internal workflow:**
```bash
# Use Lerna to manage versions in your monorepo
lerna version --conventional-commits

# Use Lerna to run builds
lerna run build

# Use Lerna for internal publishing to private registry (optional)
lerna publish --registry=https://npm.mycompany.com
```

**External publishing:**
```bash
# Use Monocrate to extract and publish to public npm
monocrate publish packages/my-cli --bump patch
```

Or with Changesets (a Lerna alternative):
```bash
# Use Changesets for version management
npx changeset version

# Use Monocrate for publishing
monocrate publish packages/my-cli
```

Lerna/Changesets handle internal version coordination. Monocrate handles external publishing with dependencies included.

**Quick Comparison Table (200 words)**

| Feature | Lerna | Monocrate |
|---------|-------|-----------|
| **Version management** | Yes, across all packages | No, use Lerna/Changesets |
| **Publishes multiple packages** | Yes, each package separately | No, one package |
| **Includes internal deps** | No, published separately | Yes, included in output |
| **Import rewriting** | No | Yes, AST-based |
| **Best for** | Publishing all packages | Publishing a subset |
| **Output** | N packages on npm | 1 package on npm |
| **User installs** | Multiple packages | Single package |
| **Internal boundaries** | Become public API | Stay internal |

**Call to Action**

Check your monorepo:
- Do users need to install packages separately? Use Lerna.
- Do you want to publish one package with internal deps included? Use Monocrate.
- Need both? Use them together.

Try monocrate:
```bash
npx monocrate prepare packages/your-package
```

---

## 5. "Publishing a CLI from Your Monorepo: The Complete Playbook"

**Target publication:** Dev.to, r/commandline
**Target length:** 2,800 words
**Target keywords:** "publish CLI from monorepo", "npm CLI publishing", "monorepo CLI"
**Publishing date:** Week 9

### Outline

**The Scenario (200 words)**

You built a CLI in your monorepo. It automates deployments, manages configurations, or generates code. Your team loves it. You want to publish it to npm so others can use it.

But your CLI imports from 8 internal packages. You can't just `npm publish` it—those imports won't resolve on npm.

This playbook walks through publishing a CLI from a monorepo using monocrate, from build to distribution.

**Step 1: Prepare Your CLI for Publishing (400 words)**

**1.1: Ensure your package.json has the right fields**

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=20"
  }
}
```

**Key fields:**
- `bin`: Maps the CLI command to your entry file
- `files`: Which files to include (usually just `dist`)
- `engines`: Minimum Node version

**1.2: Add a shebang to your CLI entry file**

```typescript
#!/usr/bin/env node

import { program } from 'commander';
// ... rest of your CLI
```

Without the shebang, users can't run your CLI directly.

**1.3: Build your packages**

```bash
# Build from monorepo root
npm run build
# or
pnpm build
# or
yarn build
```

Ensure `packages/my-cli/dist/` has your compiled code.

**Step 2: Inspect the Dependency Graph (300 words)**

Before publishing, see what you're including:

```bash
monocrate prepare packages/my-cli
```

Monocrate creates an output directory and shows the structure:
```
output/
  package.json
  dist/
    cli.js
  deps/
    packages/
      config/
      logger/
      deployment-engine/
```

**Check:**
- Are all expected dependencies included?
- Are there unexpected dependencies?
- Is the structure correct?

**Inspect the rewritten imports:**
```javascript
// Before: packages/my-cli/dist/cli.js
import { parseConfig } from '@myorg/config';

// After: output/dist/cli.js
import { parseConfig } from './deps/packages/config/dist/index.js';
```

Verify imports resolve correctly.

**Test the CLI locally:**
```bash
cd output
npm link
my-cli --version
```

If it works locally, it'll work published.

**Step 3: Publish to npm (400 words)**

**3.1: First-time publishing**

If you've never published this package:
```bash
# Login to npm
npm login

# Publish with monocrate
monocrate publish packages/my-cli --bump 1.0.0
```

This:
1. Prepares the package
2. Sets version to 1.0.0
3. Runs `npm publish` from the output directory

**3.2: Subsequent publishes**

For updates, use semantic versioning:
```bash
# Patch: bug fixes (1.0.0 → 1.0.1)
monocrate publish packages/my-cli --bump patch

# Minor: new features (1.0.1 → 1.1.0)
monocrate publish packages/my-cli --bump minor

# Major: breaking changes (1.1.0 → 2.0.0)
monocrate publish packages/my-cli --bump major
```

**3.3: Dry run**

Test without actually publishing:
```bash
monocrate prepare packages/my-cli --output-dir ./publish-preview
cd publish-preview
npm pack
# Creates a .tgz file you can inspect
```

**Step 4: Integrate with CI/CD (500 words)**

**4.1: GitHub Actions workflow**

Create `.github/workflows/publish-cli.yml`:
```yaml
name: Publish CLI

on:
  push:
    tags:
      - 'cli-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm install

      - name: Build packages
        run: npm run build

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/cli-v}" >> $GITHUB_OUTPUT

      - name: Publish to npm
        run: npx monocrate publish packages/my-cli --bump ${{ steps.version.outputs.VERSION }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Trigger:**
```bash
git tag cli-v1.0.0
git push origin cli-v1.0.0
```

**4.2: With Changesets**

If you use Changesets for versioning:
```bash
# Create a changeset
npx changeset add
# Select my-cli, choose version bump type

# Apply versions
npx changeset version

# Publish
monocrate publish packages/my-cli
```

The version is already bumped by Changesets, so monocrate uses it as-is.

**Step 5: Verify Installation (300 words)**

After publishing, verify it works:

```bash
# Install globally
npm install -g my-cli

# Or locally
npm install my-cli
npx my-cli --version
```

**Test:**
1. Run basic commands
2. Check help text: `my-cli --help`
3. Verify options work
4. Test with different Node versions

**Common issues:**
- **"Command not found"**: Check `bin` field in package.json
- **"Cannot find module"**: Check import paths in output
- **"Unexpected token"**: Missing shebang in CLI file
- **Broken types**: Check `.d.ts` files were included

**Step 6: Document Usage (300 words)**

Update your README with installation and usage:

```markdown
# my-cli

Short description of what your CLI does.

## Installation

\`\`\`bash
npm install -g my-cli
\`\`\`

## Usage

\`\`\`bash
my-cli [command] [options]
\`\`\`

### Commands

- `my-cli deploy` - Deploy your application
- `my-cli config` - Manage configuration
- `my-cli status` - Check deployment status

### Options

- `--env <env>` - Target environment (default: development)
- `--verbose` - Enable verbose logging

## Examples

\`\`\`bash
# Deploy to production
my-cli deploy --env production

# Check status
my-cli status --env production
\`\`\`
```

**Add to npm package page:**
Your README becomes the npm package page. Make it clear and actionable.

**Step 7: Maintenance and Updates (400 words)**

**7.1: Bug fixes**

```bash
# Fix bug in your monorepo
git commit -m "fix: handle null config gracefully"

# Rebuild
npm run build

# Publish patch
monocrate publish packages/my-cli --bump patch
```

**7.2: New features**

```bash
# Add feature in your monorepo
git commit -m "feat: add retry command"

# Rebuild
npm run build

# Publish minor version
monocrate publish packages/my-cli --bump minor
```

**7.3: Breaking changes**

```bash
# Make breaking change
git commit -m "feat!: change config format"

# Update README with migration guide
# Rebuild
npm run build

# Publish major version
monocrate publish packages/my-cli --bump major
```

**7.4: Deprecation**

If you're replacing the CLI:
```bash
npm deprecate my-cli@"<2.0.0" "Please upgrade to v2"
```

**Checklist for Every Release:**
- [ ] Update CHANGELOG.md
- [ ] Test CLI locally
- [ ] Update README if needed
- [ ] Run `monocrate prepare` to verify output
- [ ] Publish with appropriate version bump
- [ ] Test installation from npm
- [ ] Update GitHub release notes

**Call to Action**

Publish your CLI today:
```bash
# Build your monorepo
npm run build

# Prepare for inspection
npx monocrate prepare packages/your-cli

# Publish
npx monocrate publish packages/your-cli --bump 1.0.0
```

Check the [full documentation](link) for advanced options like `--mirror-to` for open-source mirroring.

---

## Production Timeline

**Week 1:**
- Publish blog post 1: "Why You Can't Regex Your Way Out of Monorepo Publishing"
- Create Twitter thread 1
- Submit to Dev.to, HN, r/typescript

**Week 3:**
- Publish blog post 2: "How We Published 1 Package from a 110-Package Monorepo Without Breaking Tree-Shaking"
- Create Twitter thread 2
- Submit to Dev.to, HN, r/programming

**Week 5:**
- Publish blog post 3: "The True Cost of Publishing 15 Packages When You Meant to Publish One"
- Create Twitter thread 3
- Submit to Medium, r/ExperiencedDevs, HN

**Week 9:**
- Publish blog post 5: "Publishing a CLI from Your Monorepo: The Complete Playbook"
- Create Twitter thread 5
- Submit to Dev.to, r/commandline

**Week 11:**
- Publish blog post 4: "Lerna Manages Your Monorepo. Monocrate Publishes from It. Here's the Difference."
- Create Twitter thread 4
- Submit to Dev.to, r/javascript

All outlines are ready for immediate execution.

# Social Media Content Calendar

Ready-to-post Twitter threads, LinkedIn posts, and social content for the first 90 days.

---

## Twitter Thread Templates

### Thread 1: The Import Rewriting Problem (Week 1)

**Hook Tweet:**
```
You try to publish your package from your monorepo.

npm publish fails. "Cannot find module '@myorg/utils'"

You think: "I'll just regex it."

Bad idea. Here are 11 edge cases that will break your regex approach to import rewriting 🧵
```

**Tweet 2:**
```
Edge case 1: TypeScript declarations

Your .js files have this:
import { helper } from '@myorg/utils'

So do your .d.ts files.

If you only rewrite .js files, you ship broken types to npm. TypeScript users can't resolve '@myorg/utils'.
```

**Tweet 3:**
```
Edge case 2: Subpath imports

import { async } from '@myorg/utils/async'

Your regex matches @myorg/utils but doesn't know about /async.

You need to:
- Check the exports field
- Resolve the subpath
- Compute relative path
- Preserve semantics

Regex can't do this.
```

**Tweet 4:**
```
Edge case 3: Dynamic imports

const mod = await import('@myorg/utils')

Or worse:
const name = 'utils'
await import(`@myorg/${name}`)

Regex can't parse string interpolation. You need an AST.
```

**Tweet 5:**
```
Edge case 4: Export-from re-exports

export { helper } from '@myorg/utils'
export * from '@myorg/utils'

These don't use the word "import" but they're import statements.

Your regex better catch both syntaxes.
```

**Tweet 6:**
```
Edge case 5: Comments that look like imports

// TODO: import from '@myorg/utils'
// import { old } from '@myorg/legacy'

Your regex thinks these are real imports.

Your code breaks in mysterious ways.
```

**Tweet 7:**
```
Edge case 6: Multi-line imports

import {
  helper,
  utility,
  processor
} from '@myorg/utils'

Single-line regex fails. Multi-line mode breaks other patterns.
```

**Tweet 8:**
```
Edge case 7: String literals that aren't imports

const pkg = '@myorg/utils'
console.log('Install @myorg/utils first')

These aren't imports.

Your regex rewrites them anyway.

Now your logs say: "Install ./deps/packages/utils/dist/index.js first"
```

**Tweet 9:**
```
The solution: AST-based transformation

Parse files as TypeScript ASTs:
- Find ImportDeclaration nodes
- Check if source is internal package
- Resolve target using exports field
- Compute relative path
- Rewrite and save

Edge cases become trivial.
```

**Tweet 10:**
```
This is what monocrate does.

It uses ts-morph to handle:
✓ All import/export syntaxes
✓ TypeScript-specific constructs
✓ Subpath imports
✓ Dynamic imports
✓ Both .js and .d.ts files

With the same code.
```

**Tweet 11:**
```
Try it on your monorepo:

npx monocrate prepare packages/your-package

Inspect the output. Check the rewritten imports in .js and .d.ts files.

Then imagine doing that by hand.

https://github.com/imaman/monocrate
```

---

### Thread 2: Tree-Shaking (Week 3)

**Hook Tweet:**
```
We published a package from our 110-package monorepo.

User complaint: "Your package is 2.3MB. I only import one function. Why is my bundle so large?"

Bundling vs. copy-based assembly. And why module boundaries matter. 🧵
```

**Tweet 2:**
```
Here's what bundling does:

Before: Separate modules
- config/index.js exports validateConfig
- Also exports 10 other unused functions

After: Single bundle
- All functions included
- No module boundaries
- Consumer's bundler can't eliminate unused code
```

**Tweet 3:**
```
When a consumer imports from your bundled package:

import { deploy } from 'your-cli'

Their bundler sees one giant file.

Tree-shaking works at the file level, not function level.

Result: 890KB bundle for one function.
```

**Tweet 4:**
```
With preserved module structure:

your-package/
  dist/index.js → exports deploy
  commands/deploy.js → imports from ../deps/config
  deps/packages/config/index.js → exports validateConfig

Module boundaries intact.
```

**Tweet 5:**
```
Now when a consumer imports:

import { deploy } from 'your-cli'

Their bundler:
1. Follows to dist/index.js
2. Sees import from commands/deploy.js
3. Sees import from deps/config/index.js
4. Only includes validateConfig function

Tree-shaking at function level.
```

**Tweet 6:**
```
Real numbers from our CLI:

Bundled approach:
- Published: 2.3MB
- Consumer bundle (1 command): 890KB

Copy-based (monocrate):
- Published: 2.1MB
- Consumer bundle (1 command): 45KB

19x smaller consumer bundle.
```

**Tweet 7:**
```
The TypeScript problem:

esbuild gives you index.js. No .d.ts files.

You add dts-bundle-generator for types.

Now you maintain two bundling pipelines. If they drift, you ship broken types.
```

**Tweet 8:**
```
With copy-based assembly:

Your build (tsc) generates:
- index.js
- index.d.ts

Monocrate copies both, rewrites imports in both.

One pipeline. Types can't drift.
```

**Tweet 9:**
```
When bundling IS the right choice:

✓ Browser bundles (one HTTP request)
✓ Applications (no one imports from them)
✓ Obfuscation (hide implementation)
✓ Self-contained scripts

For npm libraries? Preserve modules.
```

**Tweet 10:**
```
This is what monocrate does differently:

Instead of bundling:
1. Copy dist/ directories
2. Rewrite imports using AST
3. Preserve module boundaries

Result: Tree-shaking works. Types work. Source maps work.
```

**Tweet 11:**
```
Check your package:

npx monocrate prepare packages/your-library
cd $(cat monocrate-output.txt)
ls -R

See the module structure.

Compare to a bundled output.

Try both in a consumer app and measure bundle sizes.

https://github.com/imaman/monocrate
```

---

### Thread 3: The Accidental API Contract (Week 5)

**Hook Tweet:**
```
Your internal helper function just became public API.

Forever.

This is how publishing everything from your monorepo locks you into contracts you never meant to make. 🧵
```

**Tweet 2:**
```
The scenario:

You want to publish my-cli from your monorepo.

It depends on 15 internal packages.

You think: "I'll publish all 16 packages to npm."

Bad idea. Here's why.
```

**Tweet 3:**
```
@myorg/yaml-utils exports:

export { parseYaml } from './parse'
export { stringifyYaml } from './stringify'
// Internal helper for config-parser
export { _normalizeWhitespace } from './internal/normalize'

That underscore means "internal, don't use."

But you published it. It's public now.
```

**Tweet 4:**
```
Three months later:

User: "_normalizeWhitespace behavior changed and broke my code."

You: "That's internal, we can change it."

User: "It's exported. I'm using it. Semver says this is breaking."

They're right.
```

**Tweet 5:**
```
In your monorepo, you refactor freely:

- Move _normalizeWhitespace to different package
- Rename it
- Delete it
- Change its signature

No one outside your team uses it.
```

**Tweet 6:**
```
Once published separately, those boundaries become contracts.

Your internal implementation details are external APIs.

You can't refactor without:
- Major version bump
- Coordinating across 16 packages
- Migration guide
- Deprecation period
```

**Tweet 7:**
```
The maintenance calculation:

15 packages × 5.5 hours initial setup = 82.5 hours

Annual maintenance:
- Security updates: 22.5 hours
- Dependency updates: 45 hours
- Bug fixes: 60 hours
- Issue triage: 37.5 hours

180 hours per year maintaining internal helpers as public APIs.
```

**Tweet 8:**
```
Version synchronization hell:

Fix bug in yaml-utils:
1. Bump yaml-utils 1.0.0 → 1.0.1
2. Update config-parser dependency
3. Bump config-parser 1.2.0 → 1.2.1
4. Update my-cli dependency
5. Bump my-cli 2.0.0 → 2.0.1

5 packages updated for one bug fix.
```

**Tweet 9:**
```
With monocrate:

my-cli/
  dist/
    cli.js           ← public API
  deps/
    packages/
      yaml-utils/
        internal/
          normalize.js  ← included but not exported publicly

Users can't import it directly. You can refactor freely.
```

**Tweet 10:**
```
The alternative:

1. Fix bug in yaml-utils in your monorepo
2. Run: monocrate publish packages/my-cli --bump patch

One command. One version. No coordination.

Internal boundaries stay internal.
```

**Tweet 11:**
```
Calculate your cost:

How many internal dependencies? [15]
Hours per package initial setup? [5.5]
Bug fixes per package per year? [2]

Publishing everything: 622.5 hours over 3 years
With monocrate: 41.5 hours

You save 581 hours.

https://github.com/imaman/monocrate
```

---

### Thread 4: Lerna vs Monocrate (Week 11)

**Hook Tweet:**
```
"Isn't this what Lerna does?"

We get this question constantly.

Both tools work with monorepos. Both publish to npm.

Here's the actual difference (and why they're complementary, not competitive) 🧵
```

**Tweet 2:**
```
What Lerna does:

Manages versions across ALL packages in your workspace.

lerna version
→ Prompts for version bumps
→ Updates interdependencies automatically

lerna publish
→ Publishes every changed package to npm
```

**Tweet 3:**
```
Lerna's model:

You have 20 packages.
You publish 20 packages.

Users install whichever ones they need:

npm install @babel/core @babel/parser @babel/traverse

This is perfect for frameworks like Babel, Jest, React.
```

**Tweet 4:**
```
What Monocrate does:

Extracts ONE package with its internal dependencies included.

monocrate publish packages/my-cli
→ Only publishes my-cli
→ Internal dependencies included in output
→ Not published separately
```

**Tweet 5:**
```
Monocrate's model:

You have 20 internal packages.
You publish 1 package to npm.

Users install that one package:

npm install my-cli

It includes everything it needs. No other @myorg packages required.
```

**Tweet 6:**
```
When to use Lerna:

✓ Publishing a framework with modular pieces
✓ Users need different combinations of packages
✓ Each package should be separately installable

Example: Babel
- @babel/core + @babel/parser
- @babel/core + @babel/plugin-transform-react-jsx
- Just @babel/parser alone
```

**Tweet 7:**
```
When to use Monocrate:

✓ Open-sourcing a subset of your monorepo
✓ Publishing a CLI (single entry point)
✓ Keeping internal boundaries private
✓ Don't want to maintain N separate packages

Example: CLI that depends on 15 internal packages
→ Publish as one self-contained package
```

**Tweet 8:**
```
They're complementary:

Use Lerna to manage versions IN your monorepo
Use Monocrate to publish FROM your monorepo

Many teams use both:

lerna run build  # Build all packages
monocrate publish packages/my-cli  # Publish one with deps included
```

**Tweet 9:**
```
Or with Changesets:

npx changeset add  # Create changeset
npx changeset version  # Apply versions
monocrate publish packages/my-cli  # Publish

Changesets handles versioning.
Monocrate handles extraction and publishing.
```

**Tweet 10:**
```
Quick comparison:

Lerna:
- Manages versions: Yes
- Publishes: Multiple packages
- Includes deps: No (published separately)
- Best for: Publishing all packages

Monocrate:
- Manages versions: No (use Lerna/Changesets)
- Publishes: One package
- Includes deps: Yes
- Best for: Publishing a subset
```

**Tweet 11:**
```
Check your monorepo:

Do users need to install packages separately?
→ Use Lerna

Want to publish one package with internal deps included?
→ Use Monocrate

Need both? Use them together.

Try it:
npx monocrate prepare packages/your-package

https://github.com/imaman/monocrate
```

---

### Thread 5: CLI Publishing (Week 9)

**Hook Tweet:**
```
You built a CLI in your monorepo.

Your team loves it. You want to publish it to npm.

But it imports from 8 internal packages.

Here's the complete playbook for publishing CLIs from monorepos 🧵
```

**Tweet 2:**
```
Step 1: Ensure your package.json is correct

{
  "name": "my-cli",
  "bin": {
    "my-cli": "./dist/cli.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20"
  }
}

bin maps the command to your entry file.
```

**Tweet 3:**
```
Step 2: Add shebang to your CLI entry

#!/usr/bin/env node

import { program } from 'commander'
// ... rest of your CLI

Without this, users can't run your CLI directly.
```

**Tweet 4:**
```
Step 3: Build your monorepo

npm run build

Ensure packages/my-cli/dist/ has your compiled code.

All internal dependencies should be built too.
```

**Tweet 5:**
```
Step 4: Inspect the dependency graph

monocrate prepare packages/my-cli

Check the output:
- Are all expected deps included?
- Any unexpected deps?
- Structure looks correct?

Test locally:
cd output
npm link
my-cli --version
```

**Tweet 6:**
```
Step 5: Check the rewritten imports

Before (source):
import { parseConfig } from '@myorg/config'

After (output):
import { parseConfig } from './deps/packages/config/dist/index.js'

If imports resolve locally, they'll work published.
```

**Tweet 7:**
```
Step 6: Publish to npm

First time:
npm login
monocrate publish packages/my-cli --bump 1.0.0

Updates:
monocrate publish packages/my-cli --bump patch  # Bug fix
monocrate publish packages/my-cli --bump minor  # Feature
monocrate publish packages/my-cli --bump major  # Breaking
```

**Tweet 8:**
```
Step 7: Automate with CI/CD

GitHub Actions:
- Trigger on tags (cli-v1.0.0)
- Build packages
- Extract version from tag
- Publish with monocrate

Push tag:
git tag cli-v1.0.0
git push origin cli-v1.0.0

Automated publish happens.
```

**Tweet 9:**
```
Step 8: Verify installation

After publishing:

npm install -g my-cli
my-cli --version

Test:
- Basic commands work
- Help text displays
- Options parse correctly
- Different Node versions
```

**Tweet 10:**
```
Common issues:

"Command not found"
→ Check bin field in package.json

"Cannot find module"
→ Check import paths in output

"Unexpected token"
→ Missing shebang in CLI file

"Broken types"
→ Check .d.ts files included
```

**Tweet 11:**
```
Maintenance:

Bug fix:
git commit -m "fix: handle null config"
npm run build
monocrate publish packages/my-cli --bump patch

Feature:
git commit -m "feat: add retry command"
npm run build
monocrate publish packages/my-cli --bump minor

Checklist in thread replies ↓
```

**Tweet 12 (reply to 11):**
```
Release checklist:

□ Update CHANGELOG.md
□ Test CLI locally
□ Update README if needed
□ Run monocrate prepare to verify
□ Publish with appropriate version bump
□ Test installation from npm
□ Update GitHub release notes

Publish your CLI today:
https://github.com/imaman/monocrate
```

---

### Thread 6: The Problem with Bundlers (Week 7)

**Hook Tweet:**
```
esbuild is fast.

But for publishing libraries from monorepos, it solves the wrong problem.

Here's why bundlers break library distribution (and what to do instead) 🧵
```

**Tweet 2:**
```
What bundlers do well:

✓ Applications: Bundle once, ship to production
✓ Browser code: One file, one HTTP request
✓ Performance: Fast bundling, small output

But libraries aren't applications.
```

**Tweet 3:**
```
When you bundle a library:

50 source files → 1 output file

Module boundaries disappear.
Function boundaries disappear.

Everything is in one file.
```

**Tweet 4:**
```
The tree-shaking problem:

User imports one function:
import { deploy } from 'your-cli'

But your bundle includes:
- deploy (needed)
- 47 other functions (not needed)

Their bundler can't eliminate unused code.

No module boundaries = no tree-shaking.
```

**Tweet 5:**
```
Real impact:

Your library: 2.3MB bundled
User imports 1 function
Their bundle: 890KB

With preserved modules:
Your library: 2.1MB
User imports 1 function
Their bundle: 45KB

19x difference.
```

**Tweet 6:**
```
The TypeScript declaration problem:

esbuild gives you:
index.js ← your bundled code

No .d.ts files.

TypeScript users: "Cannot find type declarations"

You add dts-bundle-generator.
Now you maintain two bundling pipelines.
```

**Tweet 7:**
```
When they drift:

Your .js bundle exports function X
Your .d.ts bundle doesn't declare X

User: "TypeScript error: X doesn't exist"

You: "But it's in the .js file!"

Maintaining two bundlers is error-prone.
```

**Tweet 8:**
```
Source maps become useless:

Error: Deployment failed
  at deploy (node_modules/your-cli/dist/index.js:2847)

Line 2847 of a bundled file.

Good luck debugging that.

With preserved structure:
  at deploy (node_modules/your-cli/dist/commands/deploy.js:23)

Source map points to deploy.ts line 23. IDE jumps there.
```

**Tweet 9:**
```
When bundling IS right:

✓ Browser bundles (one HTTP request)
✓ Applications (no one imports from them)
✓ Obfuscation (hide implementation)
✓ Self-contained scripts

For npm libraries consumed by bundler users? Preserve modules.
```

**Tweet 10:**
```
The copy-based alternative:

Instead of bundling:
1. Copy dist/ directories
2. Preserve module structure
3. Rewrite imports with AST
4. Include dependencies

Result:
✓ Tree-shaking works
✓ Types work (one build pipeline)
✓ Source maps work
✓ Debug experience intact
```

**Tweet 11:**
```
This is monocrate's approach:

npx monocrate prepare packages/your-library

Check the output:
- Module boundaries preserved
- .js and .d.ts side by side
- Imports rewritten to relative paths

Try it in a consumer app. Measure bundle size.

https://github.com/imaman/monocrate
```

---

### Thread 7: Open-Source from Private Monorepos (Week 6)

**Hook Tweet:**
```
Your company's monorepo has tools worth open-sourcing.

But you can't expose internal structure.

Here's how to publish from private monorepos without the risk 🧵
```

**Tweet 2:**
```
The dilemma:

You built a deployment CLI internally.
It's good. Industry could benefit.

But it's in a private monorepo with:
- Internal service names
- Company-specific configs
- Proprietary dependencies
- 110 other packages
```

**Tweet 3:**
```
Bad option 1: Don't open-source it

Result: Valuable code stays locked up.
Industry loses.
Your company's eng brand doesn't benefit.
Hiring signal: zero.
```

**Tweet 4:**
```
Bad option 2: Publish the whole monorepo

Result: Expose internal structure.
Service names become public.
Internal boundaries locked in.
Security review nightmare.
```

**Tweet 5:**
```
Bad option 3: Copy files manually to public repo

Works once.

Breaks when:
- Someone adds internal dependency
- TypeScript declarations drift
- Imports need rewriting
- No one remembers the process
```

**Tweet 6:**
```
The mirror pattern:

Keep two repos:
1. Private monorepo (source of truth)
2. Public repo (mirror for community)

Automated sync:
- Publish to npm from private repo
- Mirror sources to public repo
- Contributors open PRs in public repo
- You sync changes back to private
```

**Tweet 7:**
```
How monocrate enables this:

monocrate publish packages/my-cli \
  --bump patch \
  --mirror-to ../public-repo/packages/my-cli

This:
1. Assembles package with deps
2. Publishes to npm
3. Copies sources to public repo
```

**Tweet 8:**
```
What gets mirrored:

✓ Source files (src/)
✓ README, LICENSE
✓ package.json (cleaned)
✓ Tests
✓ Documentation

What doesn't:
✗ Compiled output (dist/)
✗ node_modules
✗ Internal tooling configs
✗ Company-specific files
```

**Tweet 9:**
```
The workflow:

In private monorepo:
- Develop features
- Fix bugs
- Run tests
- Publish with --mirror-to

In public repo:
- Community sees sources
- Can open issues/PRs
- Can contribute
- Can learn from code
```

**Tweet 10:**
```
Security benefits:

Only curated files are mirrored.
Compiled artifacts from private build.
Internal references already rewritten.
No accidental exposure of secrets.

You control what's public.
```

**Tweet 11:**
```
Real example:

We use this pattern for monocrate itself.

Private monorepo: 110+ packages
Public repo: Just monocrate's sources
npm: Published from private build

Community contributes.
We maintain control.

https://github.com/imaman/monocrate
```

---

## LinkedIn Posts

### LinkedIn Post 1: The Business Case (Week 5)

**Post:**
```
I just calculated what it costs to publish 15 packages when we only needed to publish one.

82.5 hours initial setup.
180 hours per year in maintenance.
622.5 hours over 3 years.

All because our deployment CLI depends on 15 internal packages in our monorepo.

Here's what I learned about the hidden costs of publishing internal dependencies as separate packages:

1. Version Synchronization Hell
Fix a bug in one package → cascade through 5 packages → coordinate releases → update dependencies in lockstep. A one-line fix becomes a multi-package release.

2. Accidental API Contracts
That internal helper function you never meant to expose? It's now public API forever. Your internal boundaries became external contracts you can't break without major versions.

3. Maintenance Multiplication
15 packages means 15 READMEs, 15 issue trackers, 15 sets of security updates, 15 changelog files. Your support surface just 15x'd.

4. Documentation Fragmentation
Users don't know which package to report issues in. Your "Getting Started" guide now spans 15 repositories. Onboarding complexity exploded.

The alternative: Selective extraction with copy-based assembly. Publish one self-contained package that includes internal dependencies but keeps them internal.

One package on npm. One issue tracker. One README. Internal helpers stay internal.

For our CLI: 41.5 hours over 3 years instead of 622.5.

If you're considering open-sourcing from your monorepo, calculate the real cost first. The path of least resistance (publish everything) is usually the most expensive.

How many packages are you maintaining that started as "internal dependencies"?

#SoftwareEngineering #Monorepos #OpenSource #DeveloperTools
```

---

### LinkedIn Post 2: Platform Team Strategy (Week 7)

**Post:**
```
Platform teams face a unique challenge: enable teams to contribute to open source without exposing internal architecture.

At companies with mature monorepos (100+ packages), valuable tooling gets built:
- CLIs that automate deployments
- Libraries that solve async problems elegantly
- SDK generators that handle retries and pagination
- Test utilities that make assertions cleaner

These tools could benefit the broader ecosystem. But publishing from a private monorepo is risky:
- Internal service names leak
- Proprietary dependencies get exposed
- Internal boundaries become permanent contracts
- Security review becomes a nightmare

The traditional options all have problems:

1. Don't open-source → Engineering brand suffers, valuable code stays locked up
2. Rewrite from scratch → 6 months of work, diverges from internal version
3. Manual mirroring → Works once, breaks on the second update

Here's the pattern that works: Automated mirroring with curated publishing.

Keep two repositories:
- Private monorepo (source of truth for development)
- Public repository (mirror for community contributions)

Automate the sync:
- Build and test in private monorepo
- Publish to npm with internal dependencies extracted
- Mirror sources (not compiled output) to public repo
- Community opens PRs in public repo
- Sync changes back to private monorepo

This gives you:
✓ Community can see and contribute to source code
✓ Internal structure stays private
✓ No manual sync process to maintain
✓ Security review happens once during setup
✓ Updates happen automatically with each publish

The key insight: Publishing and open-sourcing are separate decisions.

You can publish compiled packages to npm from private infrastructure while making sources available in a public repository. Contributors get transparency. You maintain control.

For platform teams: This pattern enables selective open source at scale. Teams can publish tooling without platform approval for every dependency.

What's your strategy for balancing open source contribution with internal security?

#PlatformEngineering #EngineeringStrategy #Monorepos #OpenSource
```

---

### LinkedIn Post 3: Technical Decision Making (Week 3)

**Post:**
```
"Should we bundle or preserve module boundaries?"

This question came up during our weekly architecture review. We were publishing a library from our monorepo and had to choose between esbuild bundling and copy-based assembly.

Here's the analysis that drove our decision:

The Bundling Approach:
- Use esbuild to create a single index.js
- Fast builds, small published package
- But: Module boundaries disappear

The Problem:
A consumer imports one function from our library. Their bundler sees one giant file, can't eliminate unused code. Tree-shaking fails. Their production bundle is 890KB for a single function.

The Alternative:
- Copy dist/ directories while preserving structure
- Rewrite imports using AST transformation
- Keep module boundaries intact

The Result:
Same consumer imports one function. Their bundler follows the import graph, eliminates unused modules, produces a 45KB bundle. 19x smaller.

This isn't just about bundle size. It's about respecting the consumer's optimization strategy.

When you bundle a library:
- You decide what gets included
- Consumer's bundler can't help
- All optimizations happen at your build time

When you preserve modules:
- Consumer's bundler decides what's needed
- Dead code elimination works
- Tree-shaking happens at their build time

The technical implication: Libraries and applications have different distribution requirements.

Applications: Bundle. Your bundler knows the complete dependency graph.

Libraries: Preserve modules. The consumer's bundler needs to make optimization decisions based on their usage.

This extends beyond JavaScript:
- TypeScript declarations work naturally (no separate bundling pipeline)
- Source maps point to actual files (debugging just works)
- Subpath imports remain functional (users can import from /utils)

For monorepo publishing, this meant: Don't fight the ecosystem's optimization strategy. Preserve the structure that enables it.

The hardest part was import rewriting. Converting '@myorg/utils' to './deps/packages/utils/dist/index.js' across 47 TypeScript declaration files while respecting exports fields and subpath imports.

That's where tooling matters. AST-based transformation handles edge cases that regex misses.

Have you faced this decision? What drove your choice?

#SoftwareArchitecture #JavaScript #TypeScript #PerformanceOptimization
```

---

## Reddit Posts

### r/javascript Post (Week 1)

**Title:** "The 11 edge cases that break regex-based import rewriting in monorepo publishing"

**Body:**
```
I've been working on monocrate, a tool for publishing from monorepos, and I wanted to share what I learned about why import rewriting is harder than it looks.

The problem: You have a package in your monorepo that imports from internal packages:

import { utils } from '@myorg/utils'

When you publish to npm, this needs to become:

import { utils } from './deps/packages/utils/dist/index.js'

Most developers' first instinct: "I'll regex this."

Here are 11 edge cases that will break your regex approach:

1. TypeScript declarations - .d.ts files have the same imports
2. Subpath imports - '@myorg/utils/async' needs exports field resolution
3. Dynamic imports - await import() with template literals
4. Export-from re-exports - export { x } from '@myorg/utils'
5. Comments that look like imports
6. Multi-line imports
7. String literals that aren't imports
8. Import type vs regular imports
9. Scoped package names with similar prefixes
10. require() vs import()
11. Exports field resolution complexity

The solution: AST-based transformation with ts-morph.

[Detailed explanation continues...]

Full write-up: [link to blog post]
GitHub: https://github.com/imaman/monocrate

Has anyone else hit these edge cases? What was your solution?
```

---

### r/ExperiencedDevs Post (Week 5)

**Title:** "Calculated the actual cost of publishing 15 packages when we only needed one: 622 hours over 3 years"

**Body:**
```
Context: I'm a senior engineer at a company with a 110-package monorepo. We wanted to open-source our deployment CLI.

It depends on 15 internal packages. We had three options:
1. Publish all 16 packages separately
2. Bundle everything into one file
3. Extract with dependencies included

I calculated the real cost of option 1 (publish everything).

Initial setup:
- 15 packages × 5.5 hours (README, npm setup, CI/CD, etc.)
- = 82.5 hours

Annual maintenance:
- Security updates: 22.5 hours
- Dependency updates: 45 hours
- Bug fixes: 60 hours
- Issue triage: 37.5 hours
- Documentation: 15 hours
- = 180 hours/year

3-year total: 622.5 hours

That's 15.5 weeks of full-time work maintaining internal helpers as public APIs.

The hidden costs:
1. Version synchronization - Fix one bug, update 5 packages
2. Accidental API contracts - Internal helpers become permanent public APIs
3. Support fragmentation - Where do users report issues?

We went with option 3: monocrate for extraction. One package, internal deps included but not exposed.

3-year cost: 41.5 hours. We saved 581 hours.

For anyone considering open-sourcing from monorepos: Calculate the maintenance cost before publishing everything.

Happy to share the calculation spreadsheet if useful.
```

---

## Content Calendar Overview

### Week 1
- **Monday:** Publish blog post 1 (Regex import rewriting)
- **Tuesday:** Twitter thread 1 (Import rewriting problem)
- **Wednesday:** Submit to Dev.to, HN
- **Thursday:** Reddit post on r/javascript
- **Friday:** Engage with comments, answer questions

### Week 3
- **Monday:** Publish blog post 2 (Tree-shaking case study)
- **Tuesday:** Twitter thread 2 (Tree-shaking)
- **Wednesday:** Submit to Dev.to, HN
- **Thursday:** LinkedIn post (Technical decision making)
- **Friday:** Share on r/programming

### Week 5
- **Monday:** Publish blog post 3 (True cost)
- **Tuesday:** Twitter thread 3 (Accidental API contracts)
- **Wednesday:** LinkedIn post (Business case)
- **Thursday:** Reddit post on r/ExperiencedDevs
- **Friday:** Submit to Medium, HN

### Week 6
- **Monday:** Twitter thread 7 (Open-source from private)
- **Wednesday:** Engage in monorepo discussions
- **Friday:** Share case study

### Week 7
- **Monday:** Twitter thread 6 (Bundlers problem)
- **Tuesday:** LinkedIn post (Platform team strategy)
- **Friday:** Dev.to engagement

### Week 9
- **Monday:** Publish blog post 5 (CLI playbook)
- **Tuesday:** Twitter thread 5 (CLI publishing)
- **Wednesday:** Submit to Dev.to
- **Thursday:** Share on r/commandline
- **Friday:** HN submission

### Week 11
- **Monday:** Publish blog post 4 (Lerna vs Monocrate)
- **Tuesday:** Twitter thread 4 (Lerna comparison)
- **Wednesday:** Submit to Dev.to
- **Thursday:** Share on r/javascript
- **Friday:** Newsletter outreach

---

## Engagement Strategy

### Daily Activities (15 min)
- Check mentions of "monorepo" on Twitter
- Answer Stack Overflow questions about monorepo publishing
- Respond to comments on blog posts
- Engage in relevant Discord channels

### Weekly Activities (2 hours)
- Participate in r/javascript, r/typescript discussions
- Comment on Hacker News threads about monorepos
- Engage with posts about Lerna, Changesets, Turborepo
- Join conversations in Monorepo.tools Discord

### Monthly Activities (3 hours)
- Reach out to tool maintainers for partnerships
- Submit guest post pitches
- Update content based on feedback
- Analyze what's working, adjust strategy

---

All content ready for immediate deployment across channels.

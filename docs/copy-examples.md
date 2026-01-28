# Monocrate: Ready-to-Use Copy Examples

## Landing Page Hero Section

### Option A: Problem-First
```
Publishing from a monorepo breaks when your package
depends on internal packages.

npm doesn't understand @myorg/utils. You're stuck
bundling everything into one file or publishing
each package separately.

Monocrate gives you a third option:

$ monocrate publish packages/my-app --bump patch

One command. Self-contained output. Module structure
preserved. Type declarations included.
```

### Option B: Time-First
```
How long should it take to publish a package from
your monorepo?

8 seconds.

$ monocrate publish packages/sdk --bump minor

Internal dependencies? Included.
Type declarations? Working.
Module structure? Preserved.

From monorepo to npm in one command.
```

### Option C: Relief-First
```
Stop fighting with bundlers.
Stop manually merging files.
Stop publishing twenty packages when you need one.

$ monocrate publish packages/app --bump patch

Point at your package. Done.
```

---

## Feature Section Copy

### Feature 1: One Command
**Headline:** "Point at your package. That's it."

**Body:**
No config files. No build scripts. No plugin chains. Just point Monocrate at the package you want to publish. It discovers your monorepo structure, builds the dependency graph, and assembles everything you need.

```bash
monocrate publish packages/my-app --bump minor
```

Your package + its internal dependencies, ready to publish. Takes longer to read this sentence than to run the command.

---

### Feature 2: Self-Contained Output
**Headline:** "Everything included, nothing extra"

**Body:**
Internal dependencies are copied into the output. External dependencies (lodash, react) stay as dependencies. The result is a single package that contains everything from your monorepo and references everything from npm.

No orphaned packages. No broken imports. No "did we publish the right version of the internal util?"

---

### Feature 3: Preserved Module Structure
**Headline:** "Your code structure, exactly as you built it"

**Body:**
Unlike bundlers that flatten your code into a single file, Monocrate preserves your module boundaries. Every file stays in its place. Tree-shaking works. Source maps work. Your carefully organized exports stay organized.

If you built it with `src/utils/parser.ts`, it publishes with `dist/utils/parser.js`. The structure you designed is the structure your users import.

---

### Feature 4: Type Declarations Just Work
**Headline:** "TypeScript users thank you automatically"

**Body:**
Monocrate rewrites imports in both `.js` and `.d.ts` files. Your type declarations work immediately, with zero configuration. Subpath imports, type-only imports, re-exports—all handled.

If you're publishing a TypeScript library, you know how rare this is. With Monocrate, it's the default.

---

## Value Prop Variations (Email / Social / Ads)

### 15-Second Version (Twitter / Short Form)
Publishing from a monorepo with internal dependencies is a nightmare. Monocrate solves it in one command. Preserves module structure. Includes types. No bundler needed.

npm install -g monocrate

---

### 30-Second Version (Email / LinkedIn)
You have a package in your monorepo. It depends on three internal packages. You need to publish it to npm.

Your options:
1. Publish all four packages separately (coordination nightmare)
2. Bundle with esbuild (lose module structure and type declarations)
3. Manually copy files (forget a transitive dep, break production)

Or:

$ monocrate publish packages/your-app --bump patch

Monocrate copies your compiled files, rewrites the imports, and merges dependencies. One command. Self-contained output. Module structure preserved.

Try it: npm install -g monocrate

---

### 60-Second Version (Blog Intro / Documentation)
Publishing packages from a monorepo is harder than it should be. The problem isn't complexity—it's that existing tools solve a different problem.

Bundlers (esbuild, rollup, webpack) are designed to optimize for browsers. They flatten your code into one file, strip module boundaries, and fight with TypeScript declaration files.

Package managers (npm, yarn, pnpm) handle publishing beautifully—as long as all your dependencies are already on npm. They don't understand workspace references like `@myorg/utils`.

What you actually need is simpler: copy your package and its internal dependencies, fix the import paths, and publish. That's what Monocrate does.

$ monocrate publish packages/your-app --bump minor

It discovers your monorepo structure, builds a dependency graph, copies compiled files, rewrites imports from package names to relative paths, and assembles a self-contained output. Module structure preserved. Type declarations included. One command.

If you're publishing libraries from a monorepo, this is the boring infrastructure that should have existed years ago.

---

## Persona-Specific Landing Pages

### For Open Source Maintainers
**Headline:** "Publish your library exactly as you built it"

**Subhead:** Module boundaries preserved. Type declarations working. Tree-shaking intact.

**Body:**
You organized your library with careful module boundaries. Users import specific functions to keep bundle sizes small. Tree-shaking depends on those boundaries.

Bundlers flatten your code into one file. Tree-shaking breaks. Users complain. You're stuck explaining workarounds.

Monocrate publishes your library with the same module structure you built. Every file in its place. Every type declaration working. Every carefully designed export exactly as intended.

Your users get smaller bundles. You get fewer support issues. Everyone wins.

**CTA:** See how it preserves module structure →

---

### For Enterprise Platform Teams
**Headline:** "Publish internal packages without open-sourcing your monorepo"

**Subhead:** Your platform tools, available to product teams. One command per package.

**Body:**
Your platform team builds shared libraries in a private monorepo. Design system, API clients, auth utilities, data layer abstractions. Product teams need them published to your internal npm registry.

You can't open-source the whole monorepo (legal won't allow it). You don't want to manage twenty separate repos (platform team is four people). Manual publishing is error-prone (you've broken production twice).

Monocrate publishes selected packages from your monorepo. One command per package. Self-contained output. Works with private npm registries (Artifactory, Verdaccio, npm Enterprise).

Add one line to your CI pipeline. Stop managing publishing infrastructure. Get back to building platform capabilities.

**CTA:** See CI integration examples →

---

### For Startup Developers
**Headline:** "Publish from your monorepo in under 60 seconds"

**Subhead:** No config. No build tools. No weekend lost to rollup plugins.

**Body:**
You're moving fast. You built your API and web app in a monorepo. Now you need to publish the SDK for partners to integrate.

You don't have time to:
- Learn rollup configuration
- Fight with esbuild about type declarations
- Set up twenty repos for twenty packages
- Maintain separate build pipelines

You have time to:

$ npm install -g monocrate
$ monocrate publish packages/sdk --bump minor

That's it. 8 seconds. Published. Self-contained. Type declarations working.

Your SDK is on npm. You're back to building product. The way it should be.

**CTA:** Install and publish in one minute →

---

## FAQ / Objections Copy

### Q: Why not just use a bundler?
**Answer:**
Bundlers (esbuild, rollup, webpack) solve a different problem. They're designed to optimize for browsers: flatten code into one file, minimize file size, eliminate dead code at build time.

That's great for applications. It's problematic for libraries:
- Module boundaries disappear (tree-shaking breaks)
- Type declarations require extra tooling (dts-bundle-generator, rollup-plugin-dts)
- Debugging gets harder (source maps need remapping)

Monocrate preserves your module structure instead of flattening it. If your users care about tree-shaking (library authors), this matters. If you're shipping an application bundle, stick with your bundler.

---

### Q: What about [popular bundler]?
**Answer:**
If your bundler works for you, great. Keep using it.

Monocrate exists for the cases where bundlers create problems:
- You need type declarations without extra plugins
- Your users depend on tree-shaking (libraries, not apps)
- You're tired of fighting bundler configuration

It's not "better than bundlers." It's solving a different problem: publishing packages from monorepos while preserving module structure.

---

### Q: Does it work with [my package manager]?
**Answer:**
Yes, if you use npm, yarn, or pnpm workspaces.

Monocrate discovers packages through workspace configuration. As long as your package.json has a `workspaces` field (or yarn/pnpm equivalents), it works.

It also works with any npm-compatible registry (Artifactory, Verdaccio, GitHub Packages, npm Enterprise).

---

### Q: What are the requirements?
**Answer:**
Honest answer:
- Node.js 20+
- Packages must be pre-built (run tsc or your build tool first)
- Valid entry points in package.json (main, exports, or types fields)
- Workspace-based monorepo (npm, yarn, or pnpm)

If you have a TypeScript monorepo that compiles to a dist/ directory, you're good.

---

### Q: What happens to my third-party dependencies?
**Answer:**
They stay as dependencies in the published package.json.

Monocrate:
- Removes internal workspace references (@myorg/utils)
- Keeps external dependencies (lodash, react)
- Merges dependencies from internal packages (so you don't lose transitive deps)

The output has one dependencies object with everything your package needs from npm, nothing from your monorepo.

---

### Q: Can I inspect the output before publishing?
**Answer:**
Yes. Use the `prepare` command:

```bash
monocrate prepare packages/my-app --output-dir ./staging
```

This assembles the package without publishing. Look at ./staging to see exactly what would go to npm. Useful for debugging, inspection, or manual publishing workflows.

---

### Q: How does versioning work with multiple packages?
**Answer:**
Monocrate can publish multiple packages with synchronized versions:

```bash
monocrate publish packages/core packages/cli --bump minor
```

Both packages get the same version bump. Useful for monorepos where packages are released together.

For independent versioning, run separate commands:

```bash
monocrate publish packages/core --bump minor
monocrate publish packages/cli --bump patch
```

---

### Q: What's the `--mirror-to` flag for?
**Answer:**
Open source projects often have a private monorepo but need sources in a public repo (licensing, contributor access, transparency).

```bash
monocrate publish packages/sdk --mirror-to ../public-repo/packages
```

This copies your source files to another directory after publishing. Use it to keep a public mirror in sync with your private repo.

---

## Social Proof / Testimonials Template

*Use this format when collecting real testimonials*

### Template
**[Name], [Role] at [Company/Project]**

"[One sentence describing the problem they had]

[What they tried before Monocrate]

[How Monocrate solved it]

[Specific outcome or time saved]"

### Example (Hypothetical - Replace With Real)
**Sarah Chen, Maintainer of TypeScript-JSON-Parser**

"I was spending hours fighting rollup to generate correct .d.ts files for my multi-package TypeScript library.

I tried dts-bundle-generator, rollup-plugin-dts, and api-extractor. Each one broke something—subpath imports, type-only exports, or re-exports.

Monocrate just copied my compiled files and fixed the imports. Type declarations worked immediately. I got my evenings back.

Publishing used to take 30 minutes of babysitting the build. Now it's one command and I'm done."

---

## Comparison Table Copy

### Monocrate vs. Bundlers

| Need | Bundlers (esbuild, rollup) | Monocrate |
|------|---------------------------|-----------|
| **Single output file** | ✅ Yes (optimized) | ❌ No (preserves structure) |
| **Module structure preserved** | ❌ No (flattened) | ✅ Yes (exact structure) |
| **Type declarations** | ⚠️ Extra plugins needed | ✅ Included automatically |
| **Tree-shaking support** | ⚠️ Build-time only | ✅ Runtime (module boundaries) |
| **Configuration required** | ⚠️ Varies (simple to complex) | ✅ Zero config |
| **Best for** | Application bundles | Library publishing |

### Monocrate vs. Manual Publishing

| Aspect | Manual Process | Monocrate |
|--------|----------------|-----------|
| **Steps per publish** | 5-10 (copy, merge, test, publish) | 1 command |
| **Time per publish** | 15-30 minutes | 8 seconds |
| **Error prone?** | ⚠️ Yes (easy to forget files) | ✅ No (automated discovery) |
| **CI/CD friendly?** | ⚠️ Requires custom scripts | ✅ Yes (one command) |
| **Maintenance overhead** | ⚠️ High (update scripts per change) | ✅ Low (auto-discovers structure) |

---

## Call-to-Action Variations

### Primary CTA (High Intent)
**"Try it now"**
```bash
npm install -g monocrate
monocrate publish packages/your-app --bump patch
```

### Secondary CTA (Exploration)
- "See example output"
- "Read the technical docs"
- "View on GitHub"

### Tertiary CTA (Low Intent)
- "Star on GitHub"
- "Follow for updates"
- "Join the discussion"

---

## Email Sequence (If Building List)

### Email 1: Welcome + Quick Win
**Subject:** One command to publish from your monorepo

Hey [Name],

You signed up to learn about Monocrate. Here's everything you need to know in 60 seconds:

**The Problem:**
Publishing packages from a monorepo breaks when you have internal dependencies. npm doesn't understand workspace references. You're stuck bundling or manually managing files.

**The Solution:**
$ monocrate publish packages/your-app --bump minor

**What It Does:**
- Discovers your monorepo structure
- Copies your package + internal dependencies
- Rewrites imports to relative paths
- Publishes to npm

**What It Preserves:**
- Module structure (tree-shaking works)
- Type declarations (TypeScript users happy)
- Source maps (debugging stays sane)

**Try It:**
npm install -g monocrate

Takes 5 minutes. If it doesn't work for you, no hard feelings. Reply and tell me why—I'll either fix it or tell you honestly if it's the wrong tool for your use case.

[Your Name]

---

### Email 2: How It Works (3 days later)
**Subject:** Why Monocrate doesn't use a bundler

[Name],

Quick question: why doesn't Monocrate use a bundler?

You'd think bundling would be simpler. One input, one output, done. But bundlers solve the wrong problem for library publishing.

**Bundlers optimize for browsers:**
- Flatten code into one file (reduce HTTP requests)
- Minimize file size (faster downloads)
- Eliminate dead code at build time (smaller bundles)

**Library publishing needs different things:**
- Preserve module boundaries (tree-shaking at user's build time)
- Keep type declarations working (TypeScript consumers)
- Maintain source maps (debugging in user's environment)

Monocrate copies your compiled files instead of bundling them. Imports get rewritten from package names to relative paths. Module structure stays intact.

Simple? Yes. Boring? Absolutely. Effective? Try it and see.

Reply with questions. I read every email.

[Your Name]

---

### Email 3: Use Case Deep Dive (7 days later)
**Subject:** Publishing TypeScript libraries from monorepos

[Name],

If you're publishing TypeScript libraries, you've probably hit this problem:

You organize your code with careful module boundaries:
```
@mylib/core
@mylib/utils
@mylib/parsers
```

Users import specific pieces:
```typescript
import { parseJSON } from '@mylib/parsers'
```

This keeps their bundle sizes small (tree-shaking removes unused code).

**Then you try to publish from a monorepo.**

Bundlers flatten your three packages into one file. Module boundaries disappear. Tree-shaking breaks. Users import the whole library even when they use one function.

TypeScript declaration files become a nightmare. You're fighting with dts-bundle-generator or rollup-plugin-dts. Subpath imports break. Re-exports stop working.

**Monocrate solves this by not bundling.**

It copies your compiled files—both .js and .d.ts—exactly as they are. Rewrites imports. Preserves structure.

Your users get the module boundaries you designed. Tree-shaking works. Type declarations resolve correctly. You stop fighting with bundler plugins.

One command. Working output. Done.

Want to see it handle your specific use case? Reply with your monorepo structure. I'll show you exactly how Monocrate assembles it.

[Your Name]

---

## Package Description (npm)

**Short (for package.json description field):**
```
"From monorepo to npm in one command. Publishes packages with internal dependencies while preserving module structure."
```

**Long (for npmjs.com page):**
```
Monocrate publishes packages from monorepos without bundling. It copies your compiled files, rewrites internal imports to relative paths, and assembles a self-contained output with module structure preserved.

Unlike bundlers (esbuild, rollup), Monocrate doesn't flatten your code. Module boundaries stay intact. Type declarations work automatically. Tree-shaking remains effective.

Perfect for TypeScript libraries, internal tooling, and any package where module structure matters.

Requirements: Node 20+, workspace-based monorepo, pre-built packages.

Try it: monocrate publish packages/your-app --bump minor
```

---

## Conference Talk Abstract

**Title:** "Publishing Packages from Monorepos Without Losing Your Mind"

**Abstract:**
Publishing a package from a monorepo shouldn't require learning rollup configuration, fighting with type declaration bundlers, or manually copying files while holding your breath.

This talk covers:
- Why bundlers solve the wrong problem for library publishing
- How to preserve module structure (and why it matters for tree-shaking)
- Making TypeScript declarations work without configuration
- Building tooling that respects developers' time

We'll walk through Monocrate, a tool that publishes packages from monorepos in one command while preserving module structure. You'll see the implementation (ts-morph for import rewriting, npm pack for file discovery) and learn why sometimes the best tool is the simplest one.

If you maintain libraries in a monorepo, you'll leave with a working solution. If you build developer tools, you'll leave with principles for designing boring infrastructure that just works.

**Audience:** Library maintainers, platform engineers, tool authors

**Takeaway:** One command to publish from monorepos, and the principles behind building tools that respect developers' time.


# Marketing Strategy for Monocrate

## THE PROBLEM

**You want to publish a package from your monorepo to npm. That package depends on other packages in the same monorepo. When you try `npm publish`, it fails because npm doesn't understand workspace protocol references or your internal package names.**

This isn't about "who" has the problem—it's about the problem itself. Just like Jest doesn't target "enterprise JavaScript developers," monocrate targets anyone hitting this specific publishing wall. Could be:
- A team wanting to open-source something valuable they built
- An indie dev who organized their projects as a monorepo
- An OSS maintainer who adopted monorepos and regrets the publishing complexity
- A company with internal packages that should be public

The common thread: they have something worth publishing, workspace dependencies are blocking them, and current solutions all suck.

## WHERE The Problem Surfaces

**Real places developers hit this wall:**

### GitHub Issues (Package Manager Teams)

**pnpm:**
- [#6269](https://github.com/pnpm/pnpm/issues/6269) - `pnpm deploy` doesn't rewrite `workspace:*` dependencies (breaks Docker deployments)
- [#9495](https://github.com/pnpm/pnpm/issues/9495) - Publishing from `/dist` directories with workspace protocol fails
- [#4624](https://github.com/pnpm/pnpm/issues/4624) - `pnpm publish` doesn't replace `workspace:*` versions
- [#8565](https://github.com/orgs/pnpm/discussions/8565) - "How to bundle workspace dependencies into pnpm publish packed packages"

**npm:**
- [#7137](https://github.com/npm/cli/issues/7137) - `bundledDependencies` doesn't bundle dependencies in monorepo

**Yarn:**
- [#5477](https://github.com/yarnpkg/berry/issues/5477) - `yarn npm publish` doesn't work from dist directories

**Bun:**
- [#15246](https://github.com/oven-sh/bun/issues/15246) - Missing publishing features for monorepo workspaces

**Nx:**
- [#22776](https://github.com/nrwl/nx/issues/22776) - `nx release` doesn't update peerDependencies

**Turborepo:**
- [#910](https://github.com/vercel/turborepo/discussions/910) - "How can I publish my packages to npm?"

**semantic-release:**
- [#1688](https://github.com/semantic-release/semantic-release/issues/1688) - No native monorepo support (4 years of discussion, still low priority)

### Blog Posts (Developers Documenting Pain)

- [Highlight.io](https://www.highlight.io/blog/publishing-private-pnpm-monorepo) - "our `highlight.run` library uses our internal `client` typescript package that isn't public... we **don't** want to publish the `client` library"
- [Bret.io](https://bret.io/blog/2025/i-love-monorepos/) - "Packages published from monorepos have more defects... You can't simply publish packages from a monorepo without a mountain of scripts and tooling"
- [James Burnside](https://jamesburnside.github.io/blog/npm-metapackage) - Documents complex workaround using ttypescript and ts-transform-paths to rewrite import paths
- [DEV Community](https://dev.to/tresorama/publish-a-typescript-react-library-to-npm-in-a-monorepo-1ah1) - "Friction between local development and publishing workflows"

### Deployment Failures

- [Vercel #5132](https://github.com/vercel/vercel/discussions/5132) - "Monorepo with Yarn workspaces fails to find modules"
- [Cloudflare Pages](https://community.cloudflare.com/t/dependencies-between-pnpm-monorepo-cannot-be-resolved/690458) - "Dependencies between pnpm monorepo cannot be resolved"

### Search Queries That Lead Nowhere

When developers search:
- "npm publish workspace dependencies error"
- "publish one package from monorepo"
- "how to bundle workspace dependencies"
- "workspace protocol npm publish"

They find partial solutions, workarounds, or "use Lerna/Changesets" (which solve different problems).

## WHAT The Message Is

**Core substance (not a tagline):**

"You want to open-source one package. It depends on internal packages. Current tools force you to publish everything, bundle to a single file, or manually copy/rewrite. Monocrate does the copying and import rewriting automatically. One command. Preserves module structure."

**They need to believe:**
- This problem is actually solvable (not "just hard")
- Module structure matters (bundling kills tree-shaking, breaks .d.ts files)
- You don't need to maintain 6 npm packages when you only want to share one
- It's built by developers who hit this exact problem in a 110+ package monorepo

## HOW To Reach Them

### Answer actual search queries
- Stack Overflow: Answer existing monorepo publishing questions. Show exact command when monocrate fits. Include tradeoffs.
- GitHub issues: Contribute relevant answers in npm/pnpm/yarn/Turborepo repos when people report workspace publishing problems
- DEV.to: Single authoritative post "Publishing One Package from a Monorepo Without Publishing Everything"—technical, specific, honest about limitations

### Be present where problems get discussed
- **Hacker News:** "Show HN: Monocrate – Extract and publish packages from monorepos with workspace deps" using mission statement (already reads like HN). Post Tue-Thu 8-10am PT.
- **Reddit r/typescript, r/node:** Participate authentically in organic monorepo threads. No "check out our tool"—instead "Here's what we built for this: [link]. Still rough but solves import rewriting."
- **Twitter/X:** One launch thread with technical depth. Tag people who've complained about this. No ads, no regular posting.

### Create one reference piece that lives forever
**"Monorepo Publishing Strategies: When to Bundle, When to Publish All, When to Extract"**

2,000-word technical comparison explaining when each approach works/breaks. This becomes THE link people share. Not marketing—education. But if they have the problem, monocrate's fit is obvious.

### Contribute to ecosystem docs
- Submit PR to npm docs: "Publishing a subset of workspace packages" section
- Turborepo/Nx docs: "Publishing a single library with internal dependencies"
- These are docs gaps, not promotional opportunities

### Make the tool immediately useful

**GitHub README structure:**
```
## The Problem
[Actual npm error message]
[Code example of workspace import]

## The Solution
npx monocrate publish packages/my-lib
[Show what happens]

## Installation
[One command]

## How It Works
[Graph traversal, AST rewriting, standard output]

## When NOT to Use This
[Be explicit about wrong use cases]

## Built Because
[Link to mission statement]
```

## Execution (First 90 Days)

**Week 1-2:**
1. Ship to npm
2. Write GitHub README
3. Publish mission statement as docs/why.md
4. Post to Show HN

**Week 3-4:**
5. Write "Monorepo Publishing Strategies" guide
6. Answer top 5 Stack Overflow questions with context-specific guidance

**Week 5-8:**
7. Submit docs PRs to npm, Turborepo, Nx
8. Monitor GitHub issues (every issue = data)
9. Engage authentically on Twitter/Reddit when useful

**Ongoing:** Answer questions where they appear. No content calendar, no posting schedule, no vanity metrics.

## What Success Looks Like

Not npm downloads or GitHub stars. Success is:
- Issues reporting real use cases we didn't anticipate
- PRs extending it for specific setups
- Unsolicited "tried monocrate, it just worked" testimonials

---

**This strategy works because:**
- **Specific:** Targeting the developer who got a workspace error and needs module structure preserved
- **Honest:** Clear about when NOT to use it
- **Valuable first:** The guide helps even if you don't use monocrate
- **Matches the mission:** Developer-to-developer, not vendor-to-customer
- **Sustainable:** No posting schedule, no community to moderate—just excellence, discoverability, and authentic help

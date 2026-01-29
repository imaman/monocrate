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

## Execution Timeline

### Day 1: Foundation (Content creation: 1 day. Everything else needs to exist before launch.)

1. Ship to npm as `monocrate`
2. Write GitHub README (structure above)
3. Publish mission statement as docs/why.md
4. Write "Monorepo Publishing Strategies" guide (the reference piece)
5. Post to Show HN

**Why Day 1:** Content is fast to create. All foundation assets should exist at launch so when HN readers click through, everything's there. Don't launch with a "coming soon" README.

### Week 1: Let the initial signal spread (Observation period)

- Monitor HN discussion, GitHub issues, Twitter mentions
- Respond to every comment/question—this is data about what resonates or confuses
- Watch what objections come up, what comparisons people make
- Note which aspects of the problem description land vs. which miss

**Why Week 1:** Give the HN post time to percolate. See if it hits front page, what discussion emerges, whether anyone actually tries it. Don't spam more channels until you understand the initial response.

### Week 2: Answer where the problem already exists (Targeted placement)

6. Find top 5-10 Stack Overflow questions about workspace publishing
7. Answer with context-specific guidance (show monocrate where it fits, bundling where that fits)
8. Comment on relevant GitHub issues (pnpm #6269, npm #7137, etc.) with "here's another approach" if monocrate solves their specific case

**Why Week 2:** By now you've learned from HN what messaging works. Use that to inform how you answer existing questions. These threads already have SEO juice and people searching—you're not creating demand, just showing up where demand exists.

### Week 3-4: Contribute to ecosystem docs (Long-tail discoverability)

9. Submit docs PRs to npm, Turborepo, Nx: "Publishing a subset of workspace packages" sections
10. Make PRs genuinely helpful—include ALL approaches (bundling, publish-all, extraction), not just monocrate
11. These take time to review/merge, so submit early

**Why Week 3-4:** Docs PRs need maintainer review cycles. Submit when you have confidence the tool works (based on Week 1-2 feedback), but don't wait too long—these become evergreen discovery channels.

### Week 4-8: Let organic discovery happen (Patience period)

12. Monitor GitHub issues—every issue is data about real use cases
13. Engage authentically on Twitter/Reddit when monorepo publishing discussions surface organically
14. Update docs/README based on confusion patterns you're seeing
15. Fix bugs, handle edge cases people report

**Why Week 4-8:** This is the "does anyone actually need this?" validation period. If GitHub issues stay empty and no one's talking about it, that's signal. If issues come in with real use cases, that's different signal. Don't force distribution—watch what happens.

### Ongoing: Stay present, don't push

- Answer questions where they appear (Stack Overflow, GitHub, Reddit)
- Update the guide as new solutions emerge or old ones evolve
- Contribute to discussions about monorepo publishing problems
- Create new content ONLY if there's a gap (don't manufacture content for "consistency")

**Why ongoing:** OSS marketing isn't a campaign with a start/end. It's perpetual presence where the problem gets discussed. Some tools take years to find their audience. That's fine—monocrate isn't a product launch, it's a tool that exists for when developers need it.

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

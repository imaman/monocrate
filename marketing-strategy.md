# Marketing Strategy for Monocrate

## WHO Has This Problem

**Developers at companies with 50+ package monorepos trying to open-source individual utilities**

Not "monorepo users." The specific person who:
- Spent Friday afternoon trying to extract one package
- Hit workspace dependency errors on `npm publish`
- Tried bundling, hated losing .d.ts quality and tree-shaking
- Gave up and never tried again

**Also:** Open-source maintainers who adopted monorepos and now regret publishing complexity. DevTools engineers evaluating what to open-source (they're the gatekeepers who need friction removed).

## WHERE They Are When They Hit This

**Four critical moments:**

1. **First `npm publish` failure** - They search "npm publish workspace dependencies error" and land on Stack Overflow/GitHub issues showing bundle-or-publish-everything solutions

2. **Evaluating whether to open-source** - Slack/GitHub discussions die at "but we'd have to publish 5 packages." No searches happen—the problem is invisible because they don't try

3. **Maintaining a bad solution** - Manual copy-paste processes, broken scripts, bundler complaints about tree-shaking

4. **Community discussions** - Reddit r/typescript, Hacker News monorepo threads, Twitter vents, Turborepo/Nx Discord when publishing comes up

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

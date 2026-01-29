# Monocrate Marketing Strategy

**Status:** Draft Foundation — Seeking validation on core assumptions before building tactical layers

---

## How to Read This Document

This strategy is built in **layers**. Validate each layer before proceeding to the next:

1. **Core Assumptions** (this section) — If these are wrong, everything else fails
2. **Strategic Foundation** (positioning, audience, channels)
3. **Tactical Execution** (separate documents once foundation is validated)

**Read Core Assumptions first. Stop if anything feels wrong. Give feedback before I build the rest.**

---

## Layer 1: Core Assumptions (VALIDATE THESE FIRST)

### Assumption 1: The Problem Monocrate Solves

**What I think monocrate does:**
Extracts publishable npm packages from monorepos when those packages have internal workspace dependencies. Solves this by copying files and rewriting imports (e.g., `@myorg/utils` → `../../deps/utils/dist/index.js`) using AST transformation.

**Why this matters:**
If you want to publish one package from a monorepo without publishing everything or bundling, there's no good existing solution.

**Question for you:** Is this the right framing of the problem? Or is there a deeper "why" I'm missing?

---

### Assumption 2: Who This Is For

**Primary audience I'm targeting:**
Platform engineers at companies with 50+ package monorepos who want to open-source specific packages without:
- Publishing their entire internal dependency graph
- Bundling everything into one file (losing tree-shaking, types)
- Maintaining dozens of npm packages forever

**Size of this audience:** ~400-1,500 teams globally (narrow but real)

**Question for you:** Is this too narrow? Too broad? Am I missing a bigger audience segment?

---

### Assumption 3: The Core Positioning

**One-sentence positioning I'm proposing:**
"Monocrate extracts publishable npm packages from monorepos without bundling or forcing you to publish everything."

**Alternatives I considered:**
- "From monorepo to npm in one command" (current README)
- "The extraction tool for monorepo packages with internal dependencies"
- "Publish from monorepos without turning internal boundaries into public API"

**Question for you:** Does any of these resonate? Or do they all miss the mark?

---

### Assumption 4: Primary Competitive Position

**What I think monocrate competes with:**
1. **Bundlers (esbuild, Rollup)** — Different use case (apps vs libraries), lose module structure
2. **Publishing everything (Lerna, Changesets)** — Opposite approach, forces public API for internal packages
3. **Manual copying** — Doesn't scale, regex-based rewriting fails on edge cases

**What I think monocrate is NOT competing with:**
- Build tools (tsc, esbuild) — monocrate doesn't build, just extracts
- Monorepo orchestrators (Turborepo, Nx) — monocrate doesn't run tasks, just publishes
- Version managers (Changesets) — monocrate doesn't version, just extracts

**Question for you:** Am I positioning the competition correctly? Is there a tool I'm missing that does solve import rewriting?

---

### Assumption 5: Credibility Foundation

**The proof point I'm centering everything on:**
"Built for a production monorepo with 110+ packages, 100K+ SLOC, thousands of PRs."

**Why this matters:**
This isn't a speculative side project. It's infrastructure extracted from real production usage. That makes every edge case claim credible ("we handle exports maps because we had to").

**Question for you:** Is this the right credibility angle? Or should I emphasize something else (e.g., "we're open-sourcing this to give back")?

---

### Assumption 6: Launch Strategy Philosophy

**My recommended approach:**
DON'T try to "go viral." DO be findable when someone searches "npm publish workspace dependencies not found" at 2am.

**Primary channels:**
1. **Hacker News (Show HN)** — Technical audience, validates production tools
2. **Dev.to** — Long-tail SEO, narrative format matches how people search
3. **Stack Overflow** — High-intent traffic (people actively debugging this problem)
4. **GitHub** — Discoverability via topics, stars, search

**Question for you:** Does this match your expectations for launch effort? Or were you thinking bigger (conferences, paid ads) or smaller (just publish to npm)?

---

### Assumption 7: Open Source Philosophy

**What I think monocrate's mission is:**
Remove friction from open-sourcing packages from internal monorepos. The gap between "we could share this" and "we did share this" is mostly tooling friction.

**How this affects marketing:**
- Not selling a product → No aggressive conversion optimization
- Giving back to ecosystem → Lead with values, not features
- Infrastructure tool → Boring is good, reliability > cleverness

**Question for you:** Is this the right lens? Or is there a commercial angle I'm missing?

---

## Critical Questions Before I Continue

**If you answer these, I'll know whether to proceed or pivot:**

1. **Did I get the problem right?** (What monocrate actually solves)
2. **Is the audience too narrow or too broad?** (Who we're targeting)
3. **Does the credibility foundation work?** (110+ package monorepo as proof)
4. **Is the launch philosophy appropriate?** (HN/Dev.to/Stack Overflow vs other channels)
5. **What did I miss entirely?** (Anything I should be thinking about that I'm not)

---

## What Comes Next (If Foundation Is Validated)

Once you validate these assumptions, I'll create **separate, focused documents** for:

1. **`docs/messaging-guide.md`** — Voice, tone, copy templates for different channels (5-10 pages)
2. **`docs/launch-playbook.md`** — Day-by-day execution checklist (10-15 pages)
3. **`docs/content-strategy.md`** — What to write, when, for which channels (5-10 pages)
4. **`docs/documentation-gaps.md`** — What docs to create before launch (3-5 pages)

Each document will be:
- **Skimmable** (headings, bullets, tables)
- **Actionable** (checklists, templates, examples)
- **Focused** (one concern per document)

But I won't create any of those until you tell me the foundation is solid.

---

## Immediate Feedback Requested

**Please answer:**

1. ✅ or ❌ on each assumption above
2. What's the **one biggest thing I got wrong**?
3. Should I continue with tactical docs, or do we need to revisit strategy?

**If you say "Assumption 3 is wrong, here's why...", I'll rebuild from there rather than giving you 400 more lines to read.**

This is a conversation, not a deliverable. Let's get the foundation right first.

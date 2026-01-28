# Monocrate Messaging: Executive Summary

## The Core Message

**Monocrate publishes packages from monorepos in one command while preserving module structure.**

That's it. Everything else is explanation, proof, or persona-specific emphasis.

---

## Recommended Taglines

**Primary:** "Internal dependencies? One command. Done."
- Use on: Landing page, social media, ads
- Why: Direct, memorable, solves the specific pain point

**Secondary:** "No bundler. No build config. Just publish."
- Use on: npm package page, GitHub description
- Why: Emphasizes simplicity through subtraction

**Baseline:** "From monorepo to npm in one command"
- Use on: Technical documentation, package.json description
- Why: Functional, accurate, SEO-friendly

---

## Brand Voice in Three Words

**Honest. Unpretentious. Relief-oriented.**

Sound like the developer at 3pm who just solved your exact problem. Not the consultant selling the future. Not the framework revolutionizing everything. Just someone who gets it.

---

## Key Differentiators

### vs. Bundlers (esbuild, rollup)
**Them:** Flatten code into one file (great for apps, problematic for libraries)
**Us:** Preserve module structure (tree-shaking works, type declarations included)

### vs. Manual Publishing
**Them:** 15-30 minutes per publish, error-prone, requires custom scripts
**Us:** 8 seconds per publish, automated discovery, one command

### vs. "Just publish each package separately"
**Them:** Coordination nightmare, version management hell, many repos to maintain
**Us:** Publish selected packages, self-contained output, stays in monorepo

---

## Persona-Specific Value Props

### Open Source Maintainer
**Pain:** Breaking users' tree-shaking, fighting type declaration bundlers
**Value:** "Publish your library exactly as you built it"
**Hook:** Module boundaries preserved → smaller bundles for users → fewer support issues

### Enterprise Platform Lead
**Pain:** Can't open-source whole monorepo, need internal packages published
**Value:** "Publish selected packages without open-sourcing your monorepo"
**Hook:** One command per package → scriptable → add to CI → stop managing infrastructure

### Startup Developer
**Pain:** Don't have time to learn rollup, just need this to work
**Value:** "Publish in under 60 seconds"
**Hook:** Install globally → run once → back to real work

### TypeScript Tool Author
**Pain:** Type declarations broken after bundling, hours debugging resolution paths
**Value:** "Type declarations work automatically"
**Hook:** ts-morph rewrites .js and .d.ts → entry points stay valid → zero config

---

## Messaging DO's and DON'Ts

### DO
- Lead with the specific problem: "Publishing from a monorepo breaks when..."
- Show code first, explain second
- Acknowledge limitations: "Requires Node 20+, needs valid entry points"
- Use concrete outcomes: "8 seconds" not "lightning fast"
- Talk like a human: "You have real work to do"

### DON'T
- Generic startup speak: "Revolutionary next-gen solution"
- Vague benefits: "Increase productivity" (how? doing what?)
- Over-promise: "Works with any monorepo" (it needs valid entry points)
- Marketing buzzwords: "Seamlessly empower developers to unlock potential"
- Pretend to be bigger than you are: "Industry leaders trust Monocrate"

---

## The Four Story Angles

### 1. "The Thing You Try Before Giving Up"
Arc: Frustration → Last Google search → Relief
Use: Testimonials, "How I found it" stories

### 2. "The Friday That Didn't Become A Weekend"
Arc: Impending doom → Simple solution → Time recovered
Use: Landing page hero, time-saved ROI content

### 3. "The Aha Moment"
Arc: Confusion → Understanding → Clarity
Use: "How it works" explainers, philosophy posts

### 4. "The Time You Got Back"
Arc: Busy work → Automation → Freedom
Use: Productivity-focused content, manager-facing materials

---

## Content Priority Hierarchy

### Tier 1: Must Have (Now)
- [ ] Landing page with clear hero section (problem → solution → install)
- [ ] README remains the source of truth (it's already excellent)
- [ ] npm package description (short and long versions)

### Tier 2: High Value (Soon)
- [ ] Persona-specific use case examples
- [ ] "How it works" technical deep dive
- [ ] FAQ addressing bundler comparisons
- [ ] CI/CD integration examples

### Tier 3: Long Term (When There's Demand)
- [ ] Video walkthrough (5 minutes: problem → demo → done)
- [ ] Blog post series (technical decision breakdowns)
- [ ] Conference talk (if invited)
- [ ] Case studies (real users, real outcomes)

---

## Quick Reference: What to Say

### When someone asks "What is Monocrate?"
"It publishes packages from monorepos in one command. If your package depends on internal packages, Monocrate copies everything you need and fixes the imports. Module structure stays intact."

### When someone asks "Why not just use a bundler?"
"Bundlers flatten code into one file—great for apps, problematic for libraries. Tree-shaking breaks, type declarations need extra plugins, module boundaries disappear. Monocrate preserves your structure instead."

### When someone asks "How long does it take?"
"About 8 seconds to publish. Longer to read this sentence than to run the command."

### When someone asks "What are the requirements?"
"Node 20+, workspace-based monorepo, packages already built. If you have a TypeScript monorepo that compiles to dist/, you're good."

### When someone asks "Can I see the output before publishing?"
"Yes. Run `monocrate prepare packages/app --output-dir ./staging` to inspect before publishing."

---

## Implementation Checklist

### Phase 1: Landing Page
- [ ] Hero section (problem + solution in 10 seconds)
- [ ] Feature highlights (4 bullets max)
- [ ] Install command prominent
- [ ] Example code before explanations

### Phase 2: Documentation
- [ ] Add persona-specific examples to README
- [ ] Create "How it works" technical doc
- [ ] FAQ section addressing common concerns
- [ ] CI/CD integration guide

### Phase 3: Content
- [ ] Write launch blog post (problem → solution → invite to try)
- [ ] Create Twitter thread (6 tweets: problem, solution, demo, benefits, install, questions?)
- [ ] Prepare Show HN post (honest, technical, not marketing)
- [ ] Draft email for interested developers

---

## Testing Your Messaging

Before publishing any copy, ask:

1. **Is it honest?** Can I prove every claim?
2. **Is it specific?** Would a developer know exactly what this does?
3. **Is it human?** Would I say this to a colleague over coffee?
4. **Is it relief-oriented?** Does it acknowledge the real pain first?
5. **Is it humble?** Am I overselling or letting the tool speak for itself?

If any answer is "no," rewrite.

---

## Final Notes

**The goal isn't to make Monocrate sound more important than it is.**

The goal is to help developers who have this specific problem find a solution quickly, understand what it does honestly, and try it without wasting time.

Everything else—growth, adoption, community—comes from delivering on that simple promise. The messaging just makes the promise clear.

Keep it honest. Keep it human. Keep it helpful.


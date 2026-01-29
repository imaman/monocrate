# Monocrate Marketing Strategy

**Version:** 1.0
**Date:** 2026-01-29
**Status:** Strategic Framework for Open-Source Launch

---

## Executive Summary

Monocrate solves a specific, painful problem: publishing npm packages from monorepos when they depend on internal workspace packages. The target market is narrow (~400-1,500 teams globally with 100+ package monorepos) but the problem is acute and poorly addressed by existing tools.

This strategy is **not** about "going viral" or building a massive community. It's about being discovered by the right 1,000 platform engineers at the moment they're debugging broken `@myorg/utils` imports after running `npm publish`.

**Core Positioning:** "Monocrate extracts publishable npm packages from monorepos without bundling, configuration, or forcing you to publish your entire internal dependency graph."

**Credibility Foundation:** Built for a production monorepo with 110+ packages, 100K+ SLOC, thousands of PRs. This isn't speculative—it's infrastructure we needed and are now giving back.

**Success Metric:** By Month 3, achieve 250+ GitHub stars, 500+ weekly npm downloads, and 3+ unsolicited "this solved my exact problem" testimonials.

---

## 1. Market Analysis

### The Problem Space

When developers try to publish an npm package from a monorepo that depends on internal packages:

1. **`npm publish` breaks immediately** — Workspace references like `@myorg/utils` don't resolve on npm
2. **Bundling destroys value** — Flattens module structure, breaks tree-shaking, mangles TypeScript declarations
3. **Publishing everything creates lock-in** — Internal boundaries become public API, maintained forever
4. **Manual approaches don't scale** — Work once, break on PR #2

### Competitive Landscape

**No direct competitors for import rewriting:**

- **Bundlers (esbuild, Rollup)**: Solve a different problem (application deployment). Lose module structure, TypeScript types require extra tooling.
- **Monorepo tools (Lerna, Changesets, Nx, Turborepo)**: Handle versioning, task running, but assume packages are independently publishable. Don't solve extraction.
- **isolate-package**: Designed for deployment (Firebase Functions), not npm publishing. No AST-based import rewriting.
- **Manual copying**: Regex-based rewriting fails on edge cases (dynamic imports, re-exports, TypeScript declarations).

**Market gap:** Monocrate is the only tool solving AST-based import rewriting for npm publishing from monorepos.

### Target Audience (Narrow but Real)

**Primary Persona: Platform Engineer at Scale-Up**
- Works at 50-300 person company with 60+ package monorepo
- Has internal tools worth open-sourcing (testing utilities, CLI tools, API clients)
- Company culture supports open source, but friction prevents action
- Pain: "I want to share one package, not publish six and maintain them forever"

**Secondary Persona: Solo Maintainer with Production Monorepo**
- Maintains consultancy/side project monorepo (15-30 packages)
- Built utilities used across client projects
- Wants to give back but lacks time for ongoing maintenance coordination
- Pain: "Bundling broke my types. Publishing separately means version hell."

**Tertiary Persona: Open-Source Advocate at Enterprise**
- Works at company with 110+ package monorepo
- Legal approved open-sourcing specific utilities
- Cannot expose internal package structure or proprietary boundaries
- Pain: "Legal needs clean boundaries. Manual extraction doesn't meet compliance needs."

### Market Size Estimation

- **Global teams with 100+ JS/TS package monorepos:** ~2,000-5,000
- **Percentage wanting to open-source components:** ~20-30%
- **Total Addressable Market:** 400-1,500 teams
- **Realistic first-year adoption:** 100-200 teams (1,000-2,000 npm weekly downloads)

This is **not a billion-dollar market**. It's infrastructure for a real problem affecting thousands of teams.

---

## 2. Product Positioning

### Core Value Proposition

**One-sentence:** "Monocrate extracts publishable npm packages from your monorepo without bundling, configuration, or forcing you to publish your entire internal dependency graph."

**Outcome-focused:** "Open-source the good parts of your monorepo without exposing internal boundaries or maintaining dozens of npm packages."

### Positioning vs. Alternatives

| Alternative | Their Approach | Why It Fails | Monocrate's Answer |
|-------------|----------------|--------------|-------------------|
| **Bundlers** | Flatten to 1-3 files | Breaks tree-shaking, mangles types, concatenates sources | Preserves module structure, types work naturally |
| **Publish Everything** | Lerna/Changesets publish N packages | Internal boundaries become public API forever | Extracts only what you choose to share |
| **Manual Copying** | Shell scripts + regex | Breaks on edge cases, doesn't scale | AST-based rewriting handles all import patterns |
| **Isolate-package** | Copies for deployment | No import rewriting, wrong use case | Built specifically for npm publishing |

### Differentiation (Outcomes That Matter)

1. **"You can actually open-source that thing you've been meaning to share"**
   - Removes friction between "we should open-source this" and "we did"
   - One command: `npx monocrate publish packages/foo`

2. **"Your internal refactoring doesn't become public API"**
   - Internal packages stay internal
   - Only the chosen package becomes public surface
   - Monorepo flexibility preserved

3. **"Library consumers get the developer experience they expect"**
   - Tree-shaking works (import just what you need)
   - TypeScript types resolve naturally
   - Source maps point to real files
   - Debugging doesn't require archaeology

4. **"It's boring, and that's the point"**
   - No config files, no plugins, no "advanced usage"
   - Uses existing tools (npm pack, ts-morph)
   - Reliable because it's predictable

### Technical Moat

- **Copy-based assembly** (not bundling) is a new approach for TypeScript monorepos
- **AST-based rewriting** correctly handles edge cases regex misses
- **npm ecosystem integration** (npm pack, workspace discovery, exports resolution)
- **"Boring is good" philosophy** prevents feature bloat and maintains trust

Competitors could copy the approach, but the moat is **trust through simplicity**. Adding features would violate the core principle.

---

## 3. Messaging Framework

### Voice & Tone

**Direct, technical, zero fluff.** We explain exactly what the problem is and how we solved it. No hand-waving, no "revolutionary" claims, no marketing BS.

**Respectful of intelligence.** We're talking to engineers who understand monorepos, npm, and module systems. Don't patronize. If there's an edge case, mention it.

**Confident but not arrogant.** We built this for a 110+ package production monorepo. We know it works. But we're not claiming it's the only way—just that it solves a specific problem well.

**Practical over clever.** Use concrete examples. Show actual output structures. Name the tools we use. Boring means reliable.

### Primary Messages

**Hero Headline (README/Website):**
"From monorepo to npm in one command"

**Alternative Headlines by Context:**
- Technical: "Publish npm packages from monorepos without flattening or publishing your entire dependency graph"
- Problem-focused: "Open-source packages from your monorepo without publishing everything"
- Category-defining: "The extraction tool for monorepo packages with internal dependencies"

**Supporting Messages:**

1. **"No bundling. Module structure preserved."**
   - Outcome: Tree-shaking works, types work, debugging works
   - Proof: "Your package ships with the same structure you built. Consumers can import submodules."

2. **"Internal dependencies included. Imports rewritten."**
   - Outcome: Don't publish 20 packages, publish one
   - Proof: "Uses TypeScript's AST to handle edge cases: dynamic imports, re-exports, subpath imports."

3. **"One command. No configuration."**
   - Outcome: Don't spend days setting up, run one command
   - Proof: "`npx monocrate publish packages/foo` — it just works."

4. **"Built for production monorepos."**
   - Outcome: Handles real-world edge cases
   - Proof: "Extracted from a monorepo with 110+ packages, 100K+ SLOC, thousands of PRs."

### Message Variants by Channel

**npm description (100 chars):**
```
Extract self-contained npm packages from monorepos. Handles internal dependencies and import rewriting.
```

**Twitter/X (280 chars):**
```
Publishing npm packages from a monorepo breaks when you depend on internal workspace packages. You're forced to publish everything or bundle into a single file. monocrate extracts self-contained packages with imports rewritten. Built for our 110+ package monorepo.
```

**HackerNews Show HN title:**
```
Show HN: Monocrate – Publish npm packages from monorepos without publishing everything
```

**Reddit r/javascript:**
```
If you've tried to publish an npm package from a monorepo, you've hit this: your package imports `@myorg/utils`, and when you run `npm publish`, that import is broken. npm has no idea what `@myorg/utils` refers to. [explanation of alternatives, monocrate solution]
```

### Key Phrases to Use Consistently

- "Internal dependencies" (not "workspace dependencies" in marketing)
- "Self-contained output"
- "Import rewriting" (the core challenge)
- "Module structure preserved" (vs bundling)
- "AST-based" (technical differentiator)
- "Extract" or "extraction" (more accurate than "publish")
- "We built this because we needed it" (credibility)

### Phrases to Avoid

- "Simple" or "easy" (overused, subjective)
- "Revolutionary" / "game-changing" (hyperbole)
- "Seamless" (marketing cliché)
- "Powerful" (meaningless)
- "Enterprise-grade" (trying too hard)

---

## 4. Content Strategy & SEO

### SEO Keyword Strategy

**Tier 1 — High Intent Problem Searches (Primary Target):**
- "npm publish internal dependencies"
- "monorepo publish single package npm"
- "publish npm package with workspace dependencies"
- "how to extract package from monorepo"
- "monorepo workspace dependencies not found after publish"

**Tier 2 — Solution-Aware Searches:**
- "monorepo to npm package"
- "rewrite imports monorepo publish"
- "bundle vs copy monorepo dependencies"
- "typescript monorepo extract single package"

**Long-Tail Technical (Gold Mine):**
- "import from @myorg/utils not found after npm publish"
- "how to publish one package without publishing entire monorepo"
- "typescript declaration files broken in published package"
- "preserve module structure when publishing from monorepo"

**Keywords to Avoid (Wrong Intent):**
- "monorepo tools" (too broad)
- "best monorepo" (comparison shopping, not problem-solving)
- "npm workspaces tutorial" (education, not solution)

### Content Pillars

#### Pillar 1: Problem Definition & Recognition
**Why:** Establish problem awareness. Most developers don't know there's a solution until they need it.

**Content:**
- "The Internal Dependency Publishing Problem" (canonical definition)
- "Why npm publish fails with workspace dependencies"
- "Three bad options for publishing from monorepos"

**Audience:** Developers hitting the problem for the first time
**Distribution:** Dev.to (SEO), HackerNews (awareness), GitHub docs

#### Pillar 2: Technical Implementation Deep-Dives
**Why:** Prove engineering depth, build trust.

**Content:**
- "Why AST-based import rewriting, not regex"
- "How ts-morph handles TypeScript declaration files"
- "The graph traversal problem in monorepo publishing"
- "Why bundling breaks module structure"

**Audience:** Engineers evaluating solutions
**Distribution:** GitHub docs/architecture/, technical blog posts, Dev.to

#### Pillar 3: Comparison & Migration
**Why:** Address "why switch?" and show understanding of current workflows.

**Content:**
- "Monocrate vs. publishing all packages separately"
- "When to use monocrate vs. Lerna" (different problems)
- "From esbuild bundling to module preservation"
- "Monocrate vs. manual file copying"

**Audience:** Teams with existing workarounds
**Distribution:** docs/comparison.md, blog posts, Reddit discussions

#### Pillar 4: Open Source Contribution Enablement
**Why:** Connect to values, not just tooling. This is monocrate's mission.

**Content:**
- "How to open-source one package from your company monorepo"
- "Using --mirror-to for public/private repo split"
- "From internal utility to npm package in 5 minutes"
- "Why module boundaries matter for open source libraries"

**Audience:** Teams wanting to give back but blocked by tooling
**Distribution:** Mission statement, blog posts, conference talks (future)

#### Pillar 5: Real-World Use Cases
**Why:** Build confidence through examples.

**Content:**
- "Publishing CLI tools with shared utility libraries"
- "Extracting React components with internal dependencies"
- "Publishing TypeScript libraries with preserved types"
- Case studies of packages published with monocrate

**Audience:** Risk-averse evaluators
**Distribution:** docs/recipes/, blog posts, GitHub Discussions

### Launch Content Plan

**Must-Have on Launch Day:**

1. **Enhanced README** ✅ (exists, minor additions needed)
   - Add "Who is this for?" section
   - Add "Who is this NOT for?" section
   - Link to mission statement prominently

2. **Quick Start Guide** (`docs/quick-start.md`) ⚠️ CRITICAL
   - 5-minute example with tiny monorepo
   - Before/after import statements
   - Output structure demonstration

3. **Troubleshooting Guide** (`docs/troubleshooting.md`) ⚠️ CRITICAL
   - "Import statements not rewritten" → Check package.json exports/main
   - "Version conflict detected" → Explanation
   - "Type declarations missing" → Verify npm pack output

4. **Comparison Page** (`docs/comparison.md`) ⚠️ HIGH PRIORITY
   - vs. Lerna/Changesets (different problems)
   - vs. esbuild/Rollup (module preservation)
   - vs. manual copying (AST correctness)

**Should Have by Week 2:**

5. "The Internal Dependency Problem" blog post
6. "How Monocrate Works" technical deep-dive
7. Migration guide from bundling

**Can Wait Until Post-Launch:**

8. Advanced guides (CI/CD, Changesets integration)
9. Case studies
10. Video content

### Documentation Strategy

**Essential Documentation:**
- README.md (what, why, how)
- docs/quick-start.md (5-minute tutorial)
- docs/api.md (programmatic usage)
- docs/troubleshooting.md (common errors)
- docs/how-it-works.md (conceptual overview)

**Nice-to-Have:**
- docs/recipes/ (CLI tools, React components, CI/CD)
- docs/migrations/ (from bundling, from manual)
- docs/faq.md (build from recurring questions)

**Organization by User Type:**
- **Evaluating:** README → Mission Statement → How It Works → Comparison
- **First-time:** README → Quick Start → Troubleshooting
- **Regular user:** API Reference → Recipes → Changelog
- **Curious engineer:** How It Works → copy-based-assembly-spec.md
- **Contributing:** CONTRIBUTING.md → Architecture docs

### GitHub Optimization

**Repository Structure:**
```
README.md                    ← Concise: what, why, how
docs/
  mission-statement.md       ← Deep why (excellent, keep)
  quick-start.md             ← CREATE: 5-minute tutorial
  how-it-works.md            ← CREATE: Conceptual overview
  api.md                     ← Document programmatic API
  troubleshooting.md         ← CREATE: Common issues
  comparison.md              ← CREATE: vs alternatives
  architecture/
    copy-based-assembly.md   ← Existing spec (keep)
  recipes/                   ← Add as needed
CHANGELOG.md                 ← CREATE: Feature explanations
CONTRIBUTING.md              ← CREATE if accepting contributions
```

**GitHub Topics (add):**
- typescript, workspace-dependencies, npm-publish, monorepo-tools

**README Enhancements:**
- Add "Used by" section (even if just your company initially)
- Add quick comparison table (monocrate vs bundling vs publish-all)
- Add terminal GIF (30-second problem → solution demo)

---

## 5. Launch Strategy & Timeline

### Pre-Launch (Days -14 to -1)

**Day -14 to -10: Foundation**
- ✅ Polish README with production proof point
- ⚠️ Set up GitHub Discussions (Show and Tell, Help, Feature Requests)
- ⚠️ Create docs/comparison.md
- ⚠️ Create docs/troubleshooting.md
- ⚠️ Create docs/quick-start.md
- ✅ Add "Used by" section to README

**Day -7 to -3: Content Pre-Production**
- Write Show HN first comment (see Section 7)
- Draft Dev.to article: "I tried to open-source from our monorepo and everything broke"
- Prepare tweet thread (launch, technical, mission)
- Create /examples directory with before/after imports
- Record 90-second terminal demo

**Day -2 to -1: Technical Prep**
- Bump to v1.0.0 (signals production-ready)
- Verify npm package metadata (keywords, description, homepage)
- Test installation on fresh machine
- Create GitHub release with changelog
- Set up analytics tracking

### Launch Day (Tuesday 10am PT)

**Hour 0:** Submit Show HN
- Title: "Show HN: Monocrate – Publish npm packages from monorepos without publishing everything"
- Post prepared first comment within 60 seconds
- Monitor for 2 hours, respond to every comment within 15 minutes

**Hour 2:** Social Distribution
- Tweet launch with terminal demo GIF
- Post to r/javascript (mission statement angle)
- Post to r/node (technical architecture angle)

**Hour 4:** Community Engagement
- Post to Discord servers (TypeScript, Node.js, Turborepo)
- Publish Dev.to article

**Hour 6-8:** Continued Distribution
- Cross-post to Hashnode and Medium
- Submit to Product Hunt (low priority)

### Post-Launch (Weeks 1-4)

**Week 1:** Amplification
- Respond to all comments/issues within 24h
- Thank everyone who starred
- Note common questions for FAQ
- Reach out to 2-3 key people (Jared Palmer, Matt Pocock)

**Week 2:** SEO Foundation
- Publish "Why bundlers don't solve monorepo publishing"
- Add to awesome-monorepo lists
- Engage with mentions on social

**Week 3:** Integration Examples
- Create Turborepo + monocrate example
- Create Changesets + monocrate workflow
- GitHub Actions publishing example

**Week 4:** Retrospective
- Analyze what worked (HN vs Reddit vs Dev.to)
- Identify top acquisition channel
- Plan content calendar for next 3 months

---

## 6. Distribution Channels

### Primary Channels (80% Energy)

**1. Hacker News (Show HN)**
- **Why:** Technical depth + production validation resonates with HN audience
- **Success metric:** >50 upvotes, >20 comments, front page for 4+ hours
- **Timing:** Tuesday/Wednesday/Thursday, 10am PT
- **Prepared first comment:** Problem explanation, alternatives tried, monocrate approach, demo link

**2. GitHub (Discovery & SEO)**
- **Why:** Developers search GitHub when evaluating tools
- **Success metric:** 100 stars in first month, #1 for "monorepo publish" topic
- **Optimization:** Topics, README structure, Discussions seeded

**3. Dev.to (Long-tail SEO)**
- **Why:** Ranks well in Google, content lives forever
- **Success metric:** 1,000+ views in first month, top 5 Google results for target keywords
- **Format:** Narrative "I tried X and Y happened" posts

**4. Stack Overflow (Answer Insertion)**
- **Why:** High-intent traffic at moment of pain
- **Success metric:** 5 high-quality answers with 10+ upvotes total
- **Strategy:** Weekly search for relevant questions, comprehensive answers

### Secondary Channels (15% Energy)

- Reddit (r/javascript, r/node, r/typescript)
- Twitter/X (technical threads, not promotional)
- Product Hunt (10 minutes, low priority)
- Discord/Slack communities (Turborepo, Node.js, TypeScript)

### Channels to Skip

- Instagram/TikTok (wrong audience)
- Paid ads (audience too narrow)
- General tech newsletters (wait for traction)
- Conferences/meetups initially (pursue after 500+ stars)

---

## 7. Community Building

### Reality Check

A CLI tool solving a narrow problem won't build "community" like a framework. Goal: Build a **network of advocates** who've hit this problem and remember monocrate solved it.

### Where Power Users Congregate

- **GitHub Discussions** (your hub): Show and Tell, Help, Feature Requests
- **Monorepo tool communities**: Turborepo Discord, Nx Slack, Changesets GitHub
- **Stack Overflow tags**: [npm-publish], [monorepo], [lerna], [workspaces]
- **Twitter lists**: Platform engineers at scale-ups tweeting about monorepo problems

### Turning Users Into Advocates

**Trigger:** Someone stars the repo or tweets about using it

**Action within 24h:**
1. Thank them publicly
2. Ask "What problem were you solving?"
3. Offer to feature their use case in docs

**Incentive Structure:**
- **Recognition:** "Used by" section in README
- **Technical credibility:** Blog posts about edge cases they reported
- **Early access:** Ping active contributors before breaking changes
- **Contribution credit:** Prominent thanks in release notes

### What Incentivizes OSS Dev Tool Contributions

- Scratching their own itch (feature they need)
- Technical challenge (import rewriting is intellectually interesting)
- Career building (production infrastructure on resume)
- Tribal signal (early contributor shows good taste)

**Don't work:** Swag, leaderboards, bounties (wrong motivations)

---

## 8. Metrics & Success Signals

### Leading Indicators (Weeks 1-2)

- **GitHub stars velocity:** >10/day in first week = strong signal
- **Issue quality:** Detailed bug reports with reproduction = real usage
- **Question patterns:** "How do I..." = adoption attempts
- **Comparison questions:** "Why not [alternative]?" = evaluation phase

### Lagging Indicators (Months 1-6)

**Month 1:**
- npm downloads: 500+
- GitHub stars: 100+
- Organic mentions: 5+ tweets/posts unprompted
- Blog post views: 2,000+ combined

**Month 3:**
- npm weekly downloads: 150+
- GitHub stars: 250+
- Closed issues: 10+
- Top 5 Google ranking for "monorepo npm publish"

**Month 6:**
- "Used by" section: 10+ projects
- GitHub Discussions: Weekly active conversations
- Community-contributed examples
- Mentioned in tool comparison articles

### Vanity Metrics to Ignore

- Total Twitter impressions (doesn't correlate with adoption)
- Product Hunt ranking (consumer-focused)
- HN peak position (sustained discussion > peak)
- Repository forks without PRs (just code exploration)

### Launch "Success" Definition

**3 signals by end of Week 2:**
1. Unsolicited GitHub issue from someone at unknown company
2. Stack Overflow answer citing monocrate (you didn't write)
3. Tweet from platform engineer: "This solved my exact problem"

---

## 9. Partnerships & Amplification

### Tier 1: Direct Outreach (Personal DM)

**1. Jared Palmer (@jaredpalmer) — Turborepo**
- **Why:** Turborepo users = high overlap with monocrate audience
- **Ask:** "Would Turborepo + monocrate integration example be useful for docs?"
- **Timing:** Week 2 post-launch (after 50+ stars)

**2. Matt Pocock (@mattpocockuk) — TypeScript Educator**
- **Why:** 200K+ followers, TypeScript-focused
- **Ask:** "Built tool for import rewriting in monorepos—thought it might interest your audience"
- **Timing:** Week 1 if HN goes well

**3. Changesets Maintainers**
- **Why:** Changesets handles versioning; monocrate handles publishing (complementary)
- **Ask:** "Would monocrate be useful in Changesets docs as complementary publishing tool?"
- **Timing:** Month 2 (after user testimonials)

### Integration Opportunities

**1. Turborepo**
- Example: `turbo run build` → `monocrate publish`
- Create example repo, docs PR

**2. Changesets**
- Workflow: `changeset version` → `monocrate publish`
- Document combined approach

**3. GitHub Actions**
- Reusable workflow for CI/CD
- `.github/workflows/monocrate-publish.yml` example

**4. Monorepo Templates**
- Add monocrate to starter templates
- PRs to popular templates (turborepo-template)

### Getting Into Recommended Lists

**Target:**
- awesome-monorepo (GitHub)
- Monorepo.tools (if exists)
- npm trends (organic via keywords)
- Tool maintainers' docs (Turborepo, Lerna, Changesets FAQs)

**Approach:**
- Create polished example first
- PR as complementary tool (not competitor)
- Position: "monocrate complements [tool] by handling publishing step"

---

## 10. Tactical Launch Checklist

### T-1 Day (Monday)
- [ ] README has production proof point in first 3 lines
- [ ] Terminal demo GIF recorded and uploaded
- [ ] Show HN first comment drafted
- [ ] Dev.to article drafted
- [ ] Tweet thread drafted
- [ ] GitHub Discussions set up
- [ ] docs/comparison.md finished
- [ ] docs/troubleshooting.md finished
- [ ] docs/quick-start.md finished
- [ ] npm package metadata verified
- [ ] Fresh install tested
- [ ] Version bumped to v1.0.0
- [ ] Release notes published

### T-0 Day (Tuesday 10am PT)
- [ ] Submit Show HN
- [ ] Post first comment within 60 seconds
- [ ] Set 15-minute timer for check-ins (2 hours)
- [ ] T+2h: Post to r/javascript and r/node
- [ ] T+4h: Publish Dev.to article
- [ ] T+4h: Tweet thread
- [ ] T+6h: Discord communities
- [ ] T+8h: Product Hunt
- [ ] Before bed: Respond to all comments

### T+1 Day (Wednesday)
- [ ] Respond to overnight comments
- [ ] Thank everyone who starred
- [ ] Engage with discussions
- [ ] Update notes: common questions, objections

### T+7 Day (Following Tuesday)
- [ ] Retrospective: Review metrics
- [ ] Identify top acquisition channel
- [ ] Plan Week 2 content
- [ ] Reach out to 2-3 Tier 1 contacts

---

## 11. Content Calendar (Sustainable)

### Launch Week (5-7 hours total)
- Monday: Final prep
- Tuesday: Launch day (HN, Reddit, Twitter, Dev.to)
- Wednesday: Response day
- Thursday: Amplification (Discord, cross-posting)
- Friday: Reflection

### First Month (2-3 hours/week)
- **Week 2:** GitHub Discussion, respond to issues, outreach
- **Week 3:** Blog post, SEO docs, integration example
- **Week 4:** Twitter thread, Stack Overflow answers, retrospective

### Sustainable Long-term (1-2 hours/week)
- **Weekly:** Respond to issues/discussions, monitor Stack Overflow
- **Bi-weekly:** Publish 1 content piece
- **Monthly:** Update "Used by," review metrics, release notes
- **Quarterly:** Substantial blog post, reach out to partners

---

## 12. Technical Marketing Elements

### Architecture Storytelling

**Communicate "boring is good":**

From mission statement:
> "Don't be clever. We use npm pack to determine publishable files instead of reimplementing the logic."

Elevate this to README:

```markdown
## Philosophy

Boring is good. Monocrate uses npm pack to determine files to publish,
ts-morph for parsing imports, and standard workspace discovery. No clever
hacks, no reimplemented logic. Just existing, battle-tested tools composed
correctly.

When the tool is boring, your publishing workflow is predictable.
```

### Key Technical Messages

**1. Copy-Based Assembly (Not Bundling)**
- Problem: Bundlers flatten, lose module structure
- Monocrate: Preserves dist/ directories, rewrites imports
- Outcome: Tree-shaking works, types work, debugging works

**2. AST-Based Import Rewriting**
- Problem: Regex fails on edge cases (template strings, dynamic imports)
- Monocrate: Uses ts-morph (TypeScript's own parser)
- Outcome: Handles all import patterns correctly

**3. Graph Traversal with Conflict Detection**
- Problem: Silent failures create runtime surprises
- Monocrate: Detects version conflicts, fails loudly
- Outcome: Errors at build time, not production

### API Naming Consistency

**Current inconsistency:**
- CLI uses `--output-dir`
- API uses `outputRoot`

**Recommendation:** Rename `outputRoot` → `outputDir` in programmatic API for consistency.

### Integration Documentation Gaps

**Need to create:**
- docs/integrations/changesets.md
- docs/integrations/github-actions.md
- docs/integrations/turborepo.md

Show patterns with examples, not philosophy.

---

## 13. Budget & Resources

### Time Investment

**Launch Week:** 10-15 hours
- 3h prep
- 5h launch day
- 4h follow-up content
- 3h community engagement

**First Month:** 8-12 hours/week
**Months 2-6:** 3-5 hours/week
**Sustainable long-term:** 1-2 hours/week

### Monetary Budget

**$0 for launch**
- All channels free (HN, Reddit, Dev.to, GitHub, Twitter)
- Time is only investment

**Future considerations (Month 6+):**
- Node Weekly newsletter sponsorship: $500-1000 (if 500+ stars)
- Conference speaking (travel costs)
- Technical writer for docs (if significant traction)

---

## 14. Risk Management

### Scenario: HN Post Dies at 10 Upvotes

**Don't:** Ask friends to upvote (against rules), resubmit immediately, panic

**Do:** Focus on other channels (Reddit, Dev.to, Twitter). HN is unpredictable. Can try again in 3 months if tool gains traction elsewhere.

### Scenario: "Just Use [Bundler]" Comments

**Response template:**
```
Great question—we tried bundling first. The issue is you lose module
structure, which breaks tree-shaking for users. If I publish a 50-module
library as one bundle, users import everything even if they only need
one function.

Comparison doc with details: [link]
```

### Scenario: Launch Day Bug Report

**Response:**
```
Thanks for reporting! Can you share: [debug info]
Will investigate ASAP. [Workaround if exists]
I'm marking this as critical and will push a fix today.
```

**Then:** Actually fix within 24 hours. Launch day bugs handled well = credibility boost.

---

## 15. Success Stories to Collect

### First Month Data Points

1. **Production Usage:** "Who's using monocrate in production?"
2. **Problem Severity:** "What were you doing before monocrate?"
3. **Time Saved:** "How much time did this save you?"
4. **Use Cases:** "What did you publish using monocrate?"

### Turn Into Content (Month 2-3)

- "5 packages published from monorepos using monocrate"
- "How [Company X] open-sourced their internal tools"
- Update README "Used by" section monthly

---

## 16. Key Takeaways

### Positioning in One Paragraph

For platform engineers and library maintainers with monorepos who want to open-source internal packages without publishing dozens of dependencies or losing module structure, Monocrate is an extraction tool that produces self-contained npm packages. Unlike bundlers that flatten everything or monorepo tools that publish everything separately, Monocrate preserves your module boundaries, rewrites internal imports, and takes one command to run.

### Core Marketing Principles

1. **Problem-first:** Lead with the pain (publishing breaks with workspace deps)
2. **Credibility from production:** 110+ packages, 100K+ SLOC is the differentiator
3. **Technical depth builds trust:** Show AST approach, graph traversal, conflict detection
4. **Boring is the brand:** No clever hacks, no config, no plugins
5. **Narrow but real:** Not trying to serve everyone, just those with this specific problem

### Top 3 Priorities for Launch

1. **Create missing docs:** quick-start.md, troubleshooting.md, comparison.md
2. **Execute HN launch:** Prepared first comment, 2-hour monitoring, every response matters
3. **Build SEO foundation:** Dev.to narrative post, Stack Overflow answers, GitHub optimization

### Success = Trust at Scale

**Not:** Viral launch, massive GitHub stars, huge community

**Yes:** 100-200 teams using monocrate in production within first year, solving real publishing problems, contributing back improvements, and advocating to others who hit the same pain.

---

## Appendix: Reference Materials

### Key Files
- `/Users/imaman/code/imaman/monocrate/docs/mission-statement.md` — Core philosophy (excellent, use as foundation)
- `/Users/imaman/code/imaman/monocrate/docs/copy-based-assembly-spec.md` — Technical architecture
- `/Users/imaman/code/imaman/monocrate/README.md` — Current positioning
- `/Users/imaman/code/imaman/monocrate/package.json` — npm metadata

### Research Sources
- Competitive landscape analysis (Lerna, Changesets, Turborepo, Nx, isolate-package)
- Target audience insights (Dev.to discussions, HN threads, GitHub issues)
- SEO keyword research (problem-aware searches, long-tail technical)
- OSS launch patterns (GoReleaser, Appwrite case studies)

### Next Steps

1. **Week -2:** Create missing documentation (quick-start, troubleshooting, comparison)
2. **Week -1:** Prepare launch content (HN comment, Dev.to article, tweets)
3. **Week 0:** Execute launch (Tuesday 10am PT)
4. **Week 1-4:** Follow launch timeline, gather feedback, iterate

**Remember:** This is infrastructure, not a product. Success is measured in solved problems, not vanity metrics. Trust is built through boring reliability, not clever features.

---

**Document Status:** Strategic framework complete. Ready for tactical execution.

**Last Updated:** 2026-01-29
**Next Review:** Post-launch retrospective (Week 4)

# SEO Keyword Tracker & Strategy

This document tracks target keywords, search intent, competition analysis, and content mapping for monocrate's SEO strategy.

---

## Primary Target Keywords

### Tier 1: High-Intent Problem Keywords
Target: Rank in top 3 within 90 days

| Keyword | Est. Monthly Searches | Current Rank | Target Rank | Competition | Search Intent | Target Content |
|---------|---------------------|--------------|-------------|-------------|---------------|----------------|
| publish from monorepo | 200 | Not ranked | 1-3 | Medium | Problem-aware, looking for solutions | SEO hub page |
| extract package from monorepo | 150 | Not ranked | 1-3 | Low-Medium | Solution-seeking, ready to implement | SEO hub page + tutorial |
| monorepo publishing tool | 100 | Not ranked | 1 | Medium | Tool comparison, evaluation stage | Comparison hub page |
| publish npm from monorepo | 180 | Not ranked | 1-3 | Medium | Implementation-ready | Tutorial + hub page |
| monorepo to npm | 80 | Not ranked | 1-3 | Low | Solution-seeking, direct intent | Hub page + CLI playbook |
| publish monorepo package | 120 | Not ranked | 1-3 | Medium | Implementation-focused | Hub page + how-to |

### Tier 2: Technical Deep-Dive Keywords
Target: Rank in top 5 within 60 days

| Keyword | Est. Monthly Searches | Current Rank | Target Rank | Competition | Search Intent | Target Content |
|---------|---------------------|--------------|-------------|-------------|---------------|----------------|
| rewrite imports monorepo | 60 | Not ranked | 1-5 | Low | Technical solution-seeking | "Why You Can't Regex" post |
| monorepo internal dependencies | 90 | Not ranked | 1-5 | Medium | Understanding problem space | "True Cost" post |
| AST import rewriting | 40 | Not ranked | 1-5 | Low | Advanced technical | Technical deep-dive |
| preserve tree shaking monorepo | 20 | Not ranked | 1-3 | Very Low | Advanced optimization | "Tree-Shaking" case study |
| typescript declarations monorepo | 25 | Not ranked | 1-5 | Low | TypeScript-specific issue | Technical posts |
| bundle vs copy assembly | 15 | Not ranked | 1 | Very Low | Architecture decision | Comparison guide |

### Tier 3: Comparison & Alternative Keywords
Target: Own the comparison space within 90 days

| Keyword | Est. Monthly Searches | Current Rank | Target Rank | Competition | Search Intent | Target Content |
|---------|---------------------|--------------|-------------|-------------|---------------|----------------|
| lerna vs monocrate | ~0 (create demand) | N/A | 1 | None | Tool comparison | "Lerna vs Monocrate" post |
| esbuild monorepo publish | 70 | Not ranked | 1-5 | Medium | Solution exploration | "Bundle vs Copy" post |
| changesets publish workflow | 110 | Not ranked | 3-7 | High | Integration question | "Using Monocrate with Changesets" |
| monorepo bundling vs publishing | 40 | Not ranked | 1-3 | Low | Architecture decision | Comparison guide |
| publish without exposing internal | 25 | Not ranked | 1-3 | Low | Privacy/architecture concern | "Economics" post |

### Tier 4: Long-Tail High-Intent Keywords
Target: Capture specific pain points

| Keyword | Est. Monthly Searches | Current Rank | Target Rank | Competition | Search Intent | Target Content |
|---------|---------------------|--------------|-------------|-------------|---------------|----------------|
| how to publish one package from monorepo | 30 | Not ranked | 1 | Low | Exact problem statement | Tutorial |
| monorepo workspace dependencies npm publish | 40 | Not ranked | 1-3 | Low | Implementation blocker | Hub page |
| npm publish workspace reference error | 35 | Not ranked | 1 | Very Low | Error resolution | Troubleshooting doc |
| publish cli from monorepo | 45 | Not ranked | 1 | Low | Specific use case | CLI playbook |
| monorepo internal imports broken after publish | 30 | Not ranked | 1 | Very Low | Error state | Troubleshooting doc |
| open source from private monorepo | 50 | Not ranked | 1-3 | Low | Business/strategy question | Mirror strategy post |

---

## Search Intent Analysis

### Intent Category 1: Problem Discovery
**User state:** Experiencing pain but doesn't know there's a better way

**Search patterns:**
- "monorepo publishing is hard"
- "publishing from monorepo problems"
- "npm workspace dependencies not working"

**Content strategy:**
- Lead with problem validation
- Show they're not alone (this is a real, common problem)
- Provide clear explanation of why current approaches fail
- Introduce monocrate as purpose-built solution

**Target content:**
- "Why You Can't Regex Your Way Out of Monorepo Publishing"
- "The 11 Edge Cases That Break Import Rewriting"

### Intent Category 2: Solution Exploration
**User state:** Knows there's a problem, researching solutions

**Search patterns:**
- "publish from monorepo"
- "extract package from monorepo"
- "monorepo publishing tool"

**Content strategy:**
- Compare available approaches
- Show tradeoffs clearly
- Position monocrate as optimal for specific use case
- Provide decision framework

**Target content:**
- SEO hub page: "Publishing from Monorepos: The Complete Guide"
- Comparison guides

### Intent Category 3: Tool Evaluation
**User state:** Considering tools, comparing options

**Search patterns:**
- "lerna vs [tool]"
- "monorepo bundling vs publishing"
- "best monorepo publishing tool"

**Content strategy:**
- Honest comparison, not FUD
- Clear differentiation
- Show complementary nature (not competitive)
- Provide use-case-based recommendations

**Target content:**
- "Lerna Manages Your Monorepo. Monocrate Publishes from It."
- All comparison guides

### Intent Category 4: Implementation-Ready
**User state:** Decided to solve the problem, needs how-to

**Search patterns:**
- "how to publish from monorepo"
- "publish cli from monorepo"
- "monorepo publishing tutorial"

**Content strategy:**
- Step-by-step instructions
- Code examples
- Troubleshooting section
- Clear CTAs to try monocrate

**Target content:**
- "Publishing a CLI from Your Monorepo: The Complete Playbook"
- Getting started guide
- Tutorial series

---

## Competition Analysis

### Current Ranking Pages (Top 5 for "publish from monorepo")

**Competitor 1: Lerna Documentation**
- URL: lerna.js.org/docs/features/version-and-publish
- Strength: Official docs, high authority
- Weakness: Covers publishing everything, not selective extraction
- Our angle: Complementary tool, different use case

**Competitor 2: Stack Overflow Thread**
- URL: stackoverflow.com/questions/[id]/how-to-publish-from-monorepo
- Strength: Real user questions, high engagement
- Weakness: Fragmented answers, no definitive solution
- Our angle: Comprehensive, opinionated guide with working solution

**Competitor 3: Random Medium Article**
- URL: medium.com/@user/publishing-from-monorepo
- Strength: Personal experience, relatable
- Weakness: Manual approach, no tooling
- Our angle: Automated, reliable, production-ready

**Competitor 4: Turborepo Docs**
- URL: turbo.build/repo/docs/handbook/publishing-packages
- Strength: Part of popular monorepo tool
- Weakness: Covers workspace publishing, not extraction
- Our angle: Solve the extraction problem they don't address

**Competitor 5: GitHub Issue/Discussion**
- URL: github.com/[org]/[repo]/issues/[number]
- Strength: Active discussion, real pain points
- Weakness: No solution, just problem sharing
- Our angle: The actual solution

### Content Gap Analysis

**What's missing from existing content:**
1. No comprehensive guide on selective package extraction
2. No tool specifically for the "publish one package with deps included" use case
3. No deep dive on AST-based import rewriting
4. No business case analysis (cost of publishing N packages)
5. No comparison of bundling vs. copy-based assembly for libraries

**Our opportunity:**
- Own the "selective extraction" space
- Create definitive technical content on import rewriting
- Provide business/economic perspective missing elsewhere
- Build trust through depth and specificity

---

## Content-to-Keyword Mapping

### SEO Hub Page: "Publishing from Monorepos: The Complete Guide"
**Primary keywords:**
- publish from monorepo
- extract package from monorepo
- monorepo publishing tool
- publish npm from monorepo

**Content structure:**
```markdown
# Publishing from Monorepos: The Complete Guide

## The Problem
[Problem validation - includes "publish from monorepo" naturally]

## Why Current Approaches Fail
[Addresses "monorepo publishing problems"]

### Approach 1: Publishing Everything
[Covers "lerna publish" keywords]

### Approach 2: Manual Copying
[Addresses "manual package extraction"]

### Approach 3: Bundling
[Covers "esbuild monorepo", "rollup monorepo"]

## The Solution: Selective Extraction with Monocrate
[Introduces monocrate as the tool for "monorepo publishing tool"]

## How It Works
[Technical explanation, includes "rewrite imports monorepo"]

## Getting Started
[Implementation guide, includes "how to publish from monorepo"]

## Comparison Matrix
[Links to all comparison guides]

## Use Cases
[Links to CLI playbook, library guide, etc.]
```

**Internal links to:**
- All blog posts
- All comparison guides
- All tutorials
- GitHub repo

---

### Blog Post 1: "Why You Can't Regex Your Way Out of Monorepo Publishing"
**Primary keywords:**
- rewrite imports monorepo
- AST import rewriting
- typescript declarations monorepo

**SEO optimizations:**
- Title includes primary keyword
- First paragraph mentions "publish from monorepo" + "import rewriting"
- H2s use variations: "Import Rewriting Edge Cases", "AST-Based Transformation"
- Code examples include package names matching search queries
- Links to hub page with anchor text "publishing from monorepos"

---

### Blog Post 2: "How We Published 1 Package from a 110-Package Monorepo Without Breaking Tree-Shaking"
**Primary keywords:**
- preserve tree shaking monorepo
- bundle vs copy assembly
- monorepo module boundaries

**SEO optimizations:**
- Title is long-tail keyword itself
- Case study format earns featured snippets
- Benchmark data (table format) earns rich results
- Visual diagrams earn image search traffic
- Links to hub page and comparison guides

---

### Blog Post 3: "The True Cost of Publishing 15 Packages When You Meant to Publish One"
**Primary keywords:**
- monorepo publishing strategy
- npm package maintenance cost
- publish without exposing internal

**SEO optimizations:**
- Calculator format encourages engagement
- Time estimates are concrete, quotable
- Table format for costs earns featured snippets
- Business angle attracts different audience (platform teams)
- Links to hub page and technical posts

---

### Blog Post 4: "Lerna Manages Your Monorepo. Monocrate Publishes from It. Here's the Difference."
**Primary keywords:**
- lerna vs monocrate
- lerna alternative
- monorepo publishing tools comparison

**SEO optimizations:**
- Creates the comparison keyword space
- Comparison table format
- Objective, not competitive tone
- Links to Lerna docs (earns reciprocal link potential)
- Links to hub page and other comparisons

---

### Blog Post 5: "Publishing a CLI from Your Monorepo: The Complete Playbook"
**Primary keywords:**
- publish cli from monorepo
- npm cli publishing
- monorepo cli tool

**SEO optimizations:**
- "Complete Playbook" signals comprehensive guide
- Step-by-step format
- Code examples throughout
- Checklist format (earns featured snippets)
- Links to hub page and technical deep-dives

---

## On-Page SEO Checklist

### For Every Blog Post:
- [ ] Primary keyword in H1 (title)
- [ ] Primary keyword in first 100 words
- [ ] Secondary keywords in at least 2 H2 subheadings
- [ ] 3-5 internal links to other monocrate content
- [ ] 2-3 external links to authoritative sources (MDN, TypeScript docs, npm docs)
- [ ] Alt text on all images includes relevant keywords
- [ ] Meta description under 160 chars, includes primary keyword
- [ ] URL slug includes primary keyword (e.g., /blog/publish-from-monorepo)
- [ ] Code examples use syntax highlighting
- [ ] At least 2,000 words (long-form ranks better)
- [ ] Table of contents for posts over 2,500 words
- [ ] Schema markup for technical articles
- [ ] Social media preview image (1200x630px)

### For Hub Page:
- [ ] All primary keywords naturally distributed
- [ ] Comprehensive (4,000+ words)
- [ ] Internal links to every piece of related content
- [ ] FAQ section (earns featured snippets)
- [ ] Table of contents with jump links
- [ ] Comparison table (earns rich results)
- [ ] Regular updates (every 30 days)

### For Comparison Guides:
- [ ] "vs" in title for comparison keywords
- [ ] Objective tone (not competitive)
- [ ] Comparison table format
- [ ] Use case recommendations
- [ ] Links to both tools' documentation
- [ ] Decision framework or flowchart

---

## Technical SEO Requirements

### Site Structure
```
monocrate.dev/
├── /                                    (Homepage)
├── /docs/                              (Documentation hub)
│   ├── /getting-started/
│   ├── /api/
│   └── /advanced/
├── /blog/                              (Blog hub)
│   ├── /publish-from-monorepo/         (SEO hub page)
│   ├── /regex-import-rewriting/
│   ├── /tree-shaking-case-study/
│   ├── /true-cost-multiple-packages/
│   ├── /lerna-vs-monocrate/
│   └── /cli-publishing-playbook/
├── /compare/                           (Comparison hub)
│   ├── /vs-lerna/
│   ├── /vs-bundling/
│   └── /vs-manual/
└── /guides/                            (Tutorial hub)
    ├── /cli-publishing/
    └── /library-publishing/
```

### URL Structure
- Clean, descriptive slugs
- Include primary keyword in URL
- No dates in URLs (allows evergreen updates)
- Consistent structure within sections

### Meta Tags Template
```html
<title>Publishing from Monorepos: The Complete Guide | Monocrate</title>
<meta name="description" content="Learn how to publish packages from your monorepo to npm without breaking imports. Compare bundling, manual copying, and AST-based extraction approaches.">

<!-- Open Graph -->
<meta property="og:title" content="Publishing from Monorepos: The Complete Guide">
<meta property="og:description" content="Learn how to publish packages from your monorepo to npm without breaking imports.">
<meta property="og:image" content="https://monocrate.dev/images/og-hub-page.png">
<meta property="og:url" content="https://monocrate.dev/blog/publish-from-monorepo">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Publishing from Monorepos: The Complete Guide">
<meta name="twitter:description" content="Learn how to publish packages from your monorepo to npm without breaking imports.">
<meta name="twitter:image" content="https://monocrate.dev/images/twitter-hub-page.png">
```

### Schema Markup
```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Publishing from Monorepos: The Complete Guide",
  "description": "Comprehensive guide on publishing packages from monorepos to npm",
  "author": {
    "@type": "Organization",
    "name": "Monocrate"
  },
  "datePublished": "2026-02-05",
  "dateModified": "2026-02-05"
}
```

---

## Link Building Strategy

### Tier 1: Directory Submissions (Immediate)
- [ ] npm (automatic via publish)
- [ ] JS.coach
- [ ] openbase.com
- [ ] npms.io
- [ ] Libraries.io
- [ ] BestOfJS

### Tier 2: Community Engagement (Ongoing)
- [ ] Answer Stack Overflow questions about monorepo publishing
- [ ] Contribute to r/javascript discussions
- [ ] Participate in HN threads about monorepos
- [ ] Engage in Discord communities (Monorepo.tools, Turborepo, Nx)
- [ ] Comment on relevant dev.to articles

### Tier 3: Content Partnerships (Weeks 4-12)
- [ ] Guest post on LogRocket: "Advanced Monorepo Publishing Patterns"
- [ ] Guest post on Smashing Magazine: "Developer Workflows: Publishing from Monorepos"
- [ ] Reach out to monorepo tool maintainers for reciprocal links
- [ ] Submit to JavaScript Weekly, Node Weekly newsletters

### Tier 4: Backlink Outreach (Months 2-3)
Target sites that mention monorepo publishing but don't have complete solutions:
- Articles about Lerna, Changesets, Turborepo
- Monorepo best practices posts
- npm publishing guides
- TypeScript tooling roundups

**Outreach template:**
```
Subject: Resource on [topic from their article]

Hi [Name],

I noticed your article on [their topic]. It's a great overview of [specific aspect].

I recently published a comprehensive guide on [related topic that monocrate solves]: [link to our content]. It covers [specific value adds], which might be a useful resource for your readers.

Would you consider linking to it from your [specific section]?

Thanks,
[Your name]
```

---

## Tracking & Analytics

### Weekly Metrics to Track
- Organic search impressions (Google Search Console)
- Click-through rate by keyword
- Average position for target keywords
- Pages indexed
- Core Web Vitals scores

### Monthly Metrics to Track
- Total organic traffic
- Traffic by landing page
- Keyword rankings (top 10, top 20, top 50)
- Backlinks gained/lost
- Domain authority

### Quarterly Goals
**Q1 (Weeks 1-12):**
- Rank in top 10 for 5+ primary keywords
- 2,000 monthly organic visitors
- 15+ backlinks from DA 30+ sites
- 500+ GitHub stars

**Q2 (Weeks 13-24):**
- Rank in top 5 for 8+ primary keywords
- 5,000 monthly organic visitors
- 30+ backlinks from DA 40+ sites
- 1,000+ GitHub stars

---

## Keyword Expansion Opportunities

### Related Problem Spaces
- "publish package without monorepo tools"
- "npm publish workspace"
- "extract subpackage from monorepo"
- "monorepo single package distribution"

### Tool Integration Keywords
- "monocrate with turborepo"
- "monocrate with nx"
- "monocrate with changesets"
- "monocrate with lerna"

### Use-Case Specific Keywords
- "publish react component from monorepo"
- "publish typescript library from monorepo"
- "publish node cli from monorepo"
- "publish sdk from private monorepo"

### Advanced Technical Keywords
- "subpath exports monorepo"
- "package.json exports field resolution"
- "typescript declaration bundling"
- "npm pack monorepo"

---

## Content Refresh Calendar

### Monthly Refreshes
- Update hub page with latest tools and approaches
- Refresh statistics in "True Cost" post
- Update benchmark data in "Tree-Shaking" post

### Quarterly Refreshes
- Review all keyword rankings, update underperforming content
- Add new sections to hub page based on common questions
- Update comparison guides with new tool versions
- Add new case studies

### Annual Refreshes
- Complete rewrite of hub page
- Update all code examples for latest Node/npm versions
- Refresh all screenshots and diagrams
- Update all external links

---

## Success Criteria

### 30 Days
- [ ] All 5 priority blog posts published
- [ ] Hub page published and indexed
- [ ] Ranking in top 50 for 5+ primary keywords
- [ ] 500+ blog pageviews
- [ ] 10+ backlinks

### 60 Days
- [ ] Ranking in top 20 for 5+ primary keywords
- [ ] Ranking in top 50 for 10+ keywords
- [ ] 1,500+ monthly organic visitors
- [ ] 20+ backlinks
- [ ] Featured in at least 1 newsletter

### 90 Days
- [ ] Ranking in top 5 for 3+ primary keywords
- [ ] Ranking in top 10 for 8+ keywords
- [ ] 2,000+ monthly organic visitors
- [ ] 25+ backlinks from DA 40+ sites
- [ ] 1,000+ npm downloads (monthly)

---

All tracking and optimization based on this strategy.

# Monocrate Project Charter

## Executive Summary

**Monocrate** is a TypeScript tool that bundles monorepo packages for npm publishing. It solves the "publish one package that depends on many internal packages" problem by assembling a self-contained, publish-ready artifact.

---

## Problem Statement

In monorepo architectures, packages often depend on other internal packages. Publishing such a package to npm requires:

1. Publishing all internal dependencies first (complex versioning)
2. Or bundling everything into a single publishable unit

Current solutions are either too complex (Lerna publish workflows), too opinionated (Nx), or require significant setup (custom bundlers). Monocrate provides a focused, zero-config solution for this specific problem.

---

## Project Mission

Bundle a monorepo package for npm publishing by:

1. **Discovering** all in-repo dependencies of the target package
2. **Assembling** compiled code (dist) from all in-repo deps into a temp directory
3. **Merging** third-party dependencies from all in-repo packages
4. **Outputting** a publish-ready package that can be `npm publish`ed directly

---

## Scope

### In Scope

- Dependency graph resolution for monorepo packages
- Support for pnpm, npm, and yarn workspaces
- Copying compiled TypeScript output (dist directories)
- package.json transformation (merging deps, rewriting paths)
- CLI tool with sensible defaults
- Programmatic TypeScript API
- Dry-run mode for verification
- Clear error messages with actionable guidance

### Out of Scope (v1.0)

- Building/compiling source code (user must build first)
- Version management or bumping
- npm publish execution (user runs npm publish themselves)
- Monorepo creation or workspace management
- Runtime code bundling (webpack/rollup style)
- Git operations or tagging

### Future Considerations (post v1.0)

- Watch mode for development
- Integration with changesets for versioning
- Pre-publish hooks
- Custom file mapping configurations
- Multi-package batch operations

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Parse package.json to identify in-repo vs third-party deps | Must |
| FR2 | Build dependency graph with cycle detection | Must |
| FR3 | Copy dist directories from all in-repo deps | Must |
| FR4 | Generate merged package.json with all third-party deps | Must |
| FR5 | Handle version conflicts in third-party deps | Must |
| FR6 | Support pnpm workspaces | Must |
| FR7 | Support npm workspaces | Should |
| FR8 | Support yarn workspaces | Should |
| FR9 | Provide dry-run mode | Must |
| FR10 | Provide verbose output option | Should |
| FR11 | Validate package before packing | Should |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | Test coverage | >90% |
| NFR2 | TypeScript strict mode | Enabled |
| NFR3 | Zero runtime dependencies if possible | Goal |
| NFR4 | CLI startup time | <500ms |
| NFR5 | Pack 10 internal deps | <5 seconds |
| NFR6 | Works offline (no network required) | Must |

### Security Requirements

| ID | Requirement |
|----|-------------|
| SR1 | Path traversal protection on all file operations |
| SR2 | No dynamic code execution (no eval) |
| SR3 | No execution of package.json scripts |
| SR4 | Secure temp directory creation and cleanup |
| SR5 | No secrets in error messages or logs |
| SR6 | Dependency audit with zero critical vulnerabilities |

---

## Architecture Decisions

### Decision 1: TypeScript-First

**Status**: Decided

**Context**: Tool targets TypeScript monorepos primarily.

**Decision**: Write in TypeScript with strict mode enabled.

**Rationale**:
- Target audience uses TypeScript
- Type safety catches bugs early
- Better IDE experience for contributors

---

### Decision 2: Workspace Detection Strategy

**Status**: Needs Decision

**Options**:
1. **Auto-detect**: Sniff for pnpm-workspace.yaml, package.json workspaces field, etc.
2. **Explicit config**: User specifies workspace type
3. **Generic approach**: Only use package.json dependencies without workspace awareness

**Recommendation**: Auto-detect with explicit override. Start with pnpm (most explicit), then npm/yarn.

**Trade-offs**:
- Auto-detect: Magic behavior, may guess wrong
- Explicit: More configuration, but predictable
- Generic: May miss workspace-specific optimizations

---

### Decision 3: Dependency Conflict Resolution

**Status**: Needs Decision

**Options**:
1. **Fail on conflict**: Strictest, safest
2. **Warn and use highest version**: Pragmatic
3. **User-configurable strategy**: Flexible but complex

**Recommendation**: Fail by default, with `--allow-version-mismatch` flag.

**Rationale**: Publishing with conflicting versions is risky. Users should explicitly acknowledge the risk.

---

### Decision 4: Output Structure

**Status**: Needs Decision

**Options**:
1. **Flat**: All code in root dist directory
2. **Namespaced**: Each internal dep in a subdirectory
3. **Preserve original**: Mirror source monorepo structure

**Recommendation**: Namespaced approach - keeps clear boundaries, easier to debug.

**Trade-offs**:
- Flat: Simpler imports, but name collisions possible
- Namespaced: Clear structure, but deeper imports
- Preserve: Familiar, but may expose internal structure

---

### Decision 5: CLI Framework

**Status**: Decided

**Context**: Need argument parsing, help generation, completions.

**Decision**: Use `commander` (simple, well-maintained, minimal deps).

**Alternatives Considered**:
- yargs: More features, heavier
- meow: Too minimal
- oclif: Overkill for our needs

---

### Decision 6: Testing Framework

**Status**: Decided

**Decision**: Use Vitest.

**Rationale**:
- Fast execution
- Native TypeScript support
- Compatible with Jest API
- Good coverage tooling

---

## Milestones and Phases

### Phase 0: Foundation (Week 1)
**Goal**: Project infrastructure ready for development

**Deliverables**:
- [ ] Repository structure (`/src`, `/tests`, etc.)
- [ ] TypeScript configuration (tsconfig.json, strict mode)
- [ ] Testing setup (Vitest)
- [ ] Linting/formatting (ESLint + Prettier)
- [ ] CI pipeline (GitHub Actions)
- [ ] Basic package.json with scripts

**Exit Criteria**: `npm run build`, `npm test`, `npm run lint` all work

---

### Phase 1: Core Engine (Weeks 2-3)
**Goal**: Programmatic API that can pack a package

**Deliverables**:
- [ ] Workspace detector (pnpm first)
- [ ] Dependency resolver (graph building)
- [ ] Cycle detection
- [ ] Bundle assembler (copy dist directories)
- [ ] package.json transformer
- [ ] Version conflict detection

**Exit Criteria**: Programmatic API can pack a test package correctly

---

### Phase 2: CLI (Week 4)
**Goal**: User-facing command-line tool

**Deliverables**:
- [ ] `monocrate pack <package>` command
- [ ] `--output`, `--dry-run`, `--verbose` flags
- [ ] Formatted progress output
- [ ] Helpful error messages
- [ ] `--help` for all commands

**Exit Criteria**: User can pack a package via CLI

---

### Phase 3: Polish and Safety (Week 5)
**Goal**: Production-quality, secure tool

**Deliverables**:
- [ ] Security review and hardening
- [ ] Additional workspace support (npm, yarn)
- [ ] Edge case handling
- [ ] Performance optimization
- [ ] Shell completions

**Exit Criteria**: Security checklist passed, 90% coverage

---

### Phase 4: Documentation (Week 6)
**Goal**: Users can understand and use the tool

**Deliverables**:
- [ ] README with quick start
- [ ] Full documentation site or docs/
- [ ] API documentation
- [ ] Example monorepo
- [ ] Troubleshooting guide

**Exit Criteria**: New user can pack their first package without asking for help

---

### Phase 5: Community and Release (Week 7)
**Goal**: Ready for public release

**Deliverables**:
- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md
- [ ] SECURITY.md
- [ ] Issue and PR templates
- [ ] CHANGELOG.md
- [ ] npm publish
- [ ] GitHub release
- [ ] Announcement

**Exit Criteria**: Package published to npm, announcement posted

---

## Success Metrics

### Adoption (6 months post-launch)
- 1,000+ weekly npm downloads
- 100+ GitHub stars
- 5+ external contributors

### Quality
- Zero critical bugs in first 30 days
- <24 hour response time on security issues
- Test coverage maintained above 90%

### Community Health
- 50%+ issues resolved within 7 days
- Positive sentiment in issue discussions
- At least 2 "good first issue" items always available

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Workspace detection fails for edge cases | High | Medium | Comprehensive testing, escape hatch config |
| Version conflicts cause runtime errors | Medium | High | Strict default + clear warnings |
| Security vulnerability in dependencies | Medium | High | Minimal deps, regular audits |
| Complex monorepo structures not supported | Medium | Medium | Clear scope docs, extensibility for v2 |
| Similar tool gains traction first | Low | Medium | Ship faster, focus on DX |

---

## Team and Responsibilities

| Agent | Primary Responsibilities |
|-------|-------------------------|
| project-lead | Vision, priorities, releases, announcements |
| core-architect | Dependency resolution, bundle assembly, API |
| cli-developer | CLI commands, output formatting, UX |
| security-engineer | Threat model, secure defaults, audits |
| quality-engineer | Testing, CI/CD, coverage |
| documentation-author | README, docs, API docs |
| brand-strategist | Name, messaging, identity |
| community-architect | OSS infrastructure, templates |
| example-curator | Example monorepo, demos |
| code-reviewer | Code quality, reviews |

---

## Open Questions

1. **Package name**: Is "monocrate" available on npm? Need to verify.
2. **Scope creep boundary**: Where exactly do we draw the line on "building"?
3. **TypeScript version support**: What's our minimum supported version?
4. **Node.js version support**: Minimum version? (Suggest Node 18+)
5. **Symlink handling**: Follow them or preserve them?

---

## Next Steps

1. **Verify npm name availability**
2. **Create repository structure** (Phase 0)
3. **Make architectural decisions** on open items
4. **Begin Phase 1 development**

---

*Document Version: 1.0*
*Created: 2026-01-15*
*Owner: Project Lead*

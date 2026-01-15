# Monocrate Roadmap

## Timeline Overview

```
Week 1          Week 2-3        Week 4          Week 5          Week 6          Week 7
[Foundation] -> [Core Engine] -> [CLI] --------> [Polish] -----> [Docs] -------> [Launch]
     |              |              |               |               |               |
     v              v              v               v               v               v
   Build          API           Commands        Security        README          npm
   Tests          Tests         UX Polish       Coverage        Examples        Announce
   CI/CD          Graph         Help            Audit           API Docs        Release
```

---

## Phase 0: Foundation

**Timeline**: Week 1
**Status**: COMPLETE
**Lead**: quality-engineer, core-architect

### Deliverables

- [x] Initialize TypeScript project
  - `tsconfig.json` with strict mode
  - `src/` directory structure
  - Build output to `dist/`

- [x] Set up testing
  - Vitest configuration
  - Coverage thresholds (90% lines, 85% branches)
  - Test directory structure

- [x] Configure code quality
  - ESLint with TypeScript rules
  - Prettier formatting
  - Pre-commit hooks (Husky + lint-staged)

- [x] Set up CI/CD
  - GitHub Actions workflow
  - Type check, lint, test on PRs
  - Coverage reporting

- [x] Update package.json
  - Proper metadata
  - Scripts: build, test, lint, typecheck
  - TypeScript dependencies

### Exit Criteria

```bash
npm run build    # Compiles without errors
npm test         # Tests pass with coverage
npm run lint     # Zero linting errors
npm run typecheck # Zero type errors
```

---

## Phase 1: Core Engine

**Timeline**: Weeks 2-3
**Status**: Not Started
**Lead**: core-architect

### Module 1.1: Workspace Detection

- [ ] Detect pnpm workspaces (pnpm-workspace.yaml)
- [ ] Detect npm workspaces (package.json workspaces field)
- [ ] Detect yarn workspaces
- [ ] List all packages in workspace
- [ ] Handle nested workspaces

### Module 1.2: Dependency Resolution

- [ ] Parse package.json dependencies
- [ ] Distinguish in-repo vs third-party deps
- [ ] Build dependency graph
- [ ] Topological sort for ordering
- [ ] Detect and report cycles

### Module 1.3: Bundle Assembly

- [ ] Create secure temp directory
- [ ] Copy dist directories from deps
- [ ] Preserve file structure
- [ ] Handle missing dist directories (error gracefully)
- [ ] Clean up on error

### Module 1.4: Package.json Transform

- [ ] Collect all third-party deps
- [ ] Detect version conflicts
- [ ] Merge dependencies correctly
- [ ] Rewrite internal imports (if needed)
- [ ] Remove workspace-specific fields

### Exit Criteria

```typescript
// This should work
const result = await pack({
  packageName: 'my-package',
  workspaceRoot: '/path/to/monorepo'
});
// result.outputDir contains publish-ready package
```

---

## Phase 2: CLI

**Timeline**: Week 4
**Status**: Not Started
**Lead**: cli-developer

### Commands

- [ ] `monocrate pack <package>`
  - Main command
  - Calls core API
  - Progress output

- [ ] `monocrate list-deps <package>`
  - Show dependency tree
  - Identify in-repo vs external

- [ ] `monocrate validate <package>`
  - Check if package can be packed
  - Report any issues

### Flags

- [ ] `--output, -o` - Output directory
- [ ] `--dry-run, -d` - Show what would happen
- [ ] `--verbose, -v` - Detailed output
- [ ] `--quiet, -q` - Suppress output
- [ ] `--help, -h` - Help text
- [ ] `--version` - Version info

### Output Formatting

- [ ] Progress spinners
- [ ] Success/error icons
- [ ] Colored output
- [ ] Formatted error messages with suggestions

### Exit Criteria

```bash
monocrate pack my-lib --output ./dist
# Should complete successfully with clear output
```

---

## Phase 3: Polish and Safety

**Timeline**: Week 5
**Status**: Not Started
**Lead**: security-engineer, quality-engineer

### Security Hardening

- [ ] Audit all file operations for path traversal
- [ ] Review all input validation
- [ ] Ensure no code execution paths
- [ ] Secure temp directory handling
- [ ] Error message sanitization

### Additional Workspace Support

- [ ] Test and fix npm workspace edge cases
- [ ] Test and fix yarn workspace edge cases
- [ ] Document any workspace-specific behaviors

### Edge Cases

- [ ] Empty dependencies
- [ ] Single-package "monorepo"
- [ ] Very deep dependency graphs
- [ ] Large file counts
- [ ] Symbolic links

### Performance

- [ ] Profile pack operation
- [ ] Optimize file copying
- [ ] Parallelize where safe

### Shell Completions

- [ ] Bash completions
- [ ] Zsh completions
- [ ] Fish completions

### Exit Criteria

- Security checklist fully passed
- 90%+ test coverage
- All edge case tests passing
- Performance within targets

---

## Phase 4: Documentation

**Timeline**: Week 6
**Status**: Not Started
**Lead**: documentation-author, example-curator

### User Documentation

- [ ] README.md
  - Badge row
  - One-line description
  - Quick start (5 steps max)
  - Installation
  - Basic usage
  - Link to full docs

- [ ] Full documentation
  - Getting started guide
  - CLI reference
  - Configuration options
  - Troubleshooting
  - FAQ

### API Documentation

- [ ] TSDoc on all public APIs
- [ ] Generated API reference
- [ ] Code examples

### Examples

- [ ] Example monorepo in `/examples`
- [ ] Working pnpm workspace
- [ ] Step-by-step walkthrough
- [ ] Common patterns

### Exit Criteria

New user can:
1. Read README
2. Install monocrate
3. Pack their first package
4. Troubleshoot common issues

All without external help.

---

## Phase 5: Community and Release

**Timeline**: Week 7
**Status**: Not Started
**Lead**: project-lead, community-architect

### OSS Infrastructure

- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md
- [ ] SECURITY.md
- [ ] Issue templates
- [ ] PR template
- [ ] GitHub labels
- [ ] CODEOWNERS

### Release Preparation

- [ ] Final security audit
- [ ] Final test pass
- [ ] CHANGELOG.md
- [ ] Verify npm name availability
- [ ] npm publish dry run

### Launch

- [ ] npm publish
- [ ] GitHub release with notes
- [ ] Announcement post
- [ ] Social sharing

### Exit Criteria

- Package live on npm
- GitHub release created
- At least one external validation (someone else uses it)

---

## Post-Launch

### Week 8+: Stabilization

- Monitor for issues
- Quick bug fixes
- Community engagement
- Triage incoming issues

### Future Versions

**v1.1 Ideas**:
- Watch mode
- Config file support
- More workspace formats

**v2.0 Ideas**:
- Built-in building
- Changesets integration
- Multi-package operations

---

## Key Dependencies Between Phases

```
Phase 0 (Foundation)
    |
    v
Phase 1 (Core) <--- Must complete before CLI
    |
    v
Phase 2 (CLI)
    |
    +---> Phase 3 (Polish) \
    |                       +---> Phase 5 (Launch)
    +---> Phase 4 (Docs)   /
```

- **Phase 1 requires Phase 0**: Need test infrastructure before writing tests
- **Phase 2 requires Phase 1**: CLI wraps core API
- **Phase 3 can parallel Phase 2**: Security review can happen alongside CLI work
- **Phase 4 requires Phase 2**: Documentation needs working CLI
- **Phase 5 requires all**: Release needs everything done

---

## Resource Allocation

| Phase | Primary Agent(s) | Supporting Agent(s) |
|-------|-----------------|---------------------|
| 0 | quality-engineer | core-architect |
| 1 | core-architect | security-engineer, code-reviewer |
| 2 | cli-developer | core-architect, quality-engineer |
| 3 | security-engineer, quality-engineer | core-architect, cli-developer |
| 4 | documentation-author, example-curator | brand-strategist |
| 5 | project-lead, community-architect | All |

---

*Last Updated: 2026-01-15*

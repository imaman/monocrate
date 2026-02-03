# Yarn Workspaces Support Gaps

## Context

Monocrate is a publishing tool. It reads package.json files and source/dist directories to assemble packages for npm. It does not interact with node_modules, lock files, or package installation mechanics.

This means many yarn-specific features are irrelevant:
- **PnP mode** — Monocrate reads source files directly, not through yarn's resolution
- **Nohoist** — An installation concern, not a publishing concern
- **Focused workspaces** — Partial installs don't affect what monocrate reads
- **yarn.lock** — Monocrate doesn't resolve third-party dependency versions
- **Constraints** — Development-time validation, not publishing

## Current Support

Monocrate correctly handles:

- **Workspace patterns** in both formats:
  - Array: `"workspaces": ["packages/*"]`
  - Object: `"workspaces": { "packages": ["packages/*"] }"`
- **Workspace protocol**: Dependencies like `"dep": "workspace:*"` are resolved by package name lookup
- **Monorepo root discovery**: Searches for `package.json` with `workspaces` field

## Functional Gaps

### 1. Missing Workspace Dependency Error Context

**Current behavior:** When a dependency isn't found in the repo, it's treated as a third-party package.

**Gap:** If a package has `"foo": "workspace:*"` but `foo` doesn't exist in the monorepo, monocrate silently treats it as third-party. The `workspace:*` version string would then appear in the output package.json, which is invalid for npm.

**Recommendation:** Detect `workspace:` prefix in dependencies and fail with a clear error if the package isn't found in the monorepo.

### ~~2. Negated Workspace Patterns~~

~~**Current behavior:** Workspace patterns are passed directly to glob.~~

~~**Gap:** Yarn supports negated patterns like `["packages/*", "!packages/internal-*"]` to exclude certain directories. While glob may handle this, it's not explicitly tested.~~

~~**Recommendation:** Add test coverage for negated patterns.~~

*Addressed in PR #99: Negated patterns are now supported and tested in monorepo-discovery.test.ts*

## Testing Gaps

### 1. Workspace Protocol Variants

Tests use `workspace:*` extensively but don't cover:
- `workspace:^` and `workspace:~` (should work since lookup is by name, but untested)
- ~~Malformed or missing workspace dependencies~~ *(Addressed in PR #96: malformed workspaces now throw clear errors)*

### ~~2. Object-Format Workspaces~~

~~The object format `{ "packages": [...] }` is supported in code but has minimal test coverage compared to the array format.~~

*Covered by test: "works with workspace object format (packages field)" in monocrate.test.ts:272*

### ~~3. Mixed Workspace Patterns~~

~~No tests for multiple patterns with different glob styles.~~

*Covered by tests using `["packages/*", "libs/*"]` in monocrate.test.ts:889, 924*

### 4. Edge Cases

Missing test coverage for:
- Empty workspaces array
- Workspace patterns that match no packages
- Packages with `workspace:` deps pointing to non-existent packages

## Recommendations

| Item | Priority | Effort |
|------|----------|--------|
| Error on unresolved `workspace:` deps | High | Low |
| Test workspace protocol variants | Medium | Low |
| ~~Test object-format workspaces~~ | ~~Medium~~ | ~~Low~~ |
| ~~Test negated patterns~~ | ~~Low~~ | ~~Low~~ |
| ~~Test mixed/complex glob patterns~~ | ~~Low~~ | ~~Low~~ |

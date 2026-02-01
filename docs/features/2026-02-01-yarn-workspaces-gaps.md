# Yarn Workspaces Support Gaps

## Intent

This document catalogs the functional and testing gaps in monocrate's support for Yarn workspaces. While monocrate handles basic npm/yarn workspace configurations, several yarn-specific features remain unsupported or untested.

## Current Support

Monocrate currently supports:

- **Workspace patterns** from `package.json` in both formats:
  - Array format: `"workspaces": ["packages/*"]`
  - Object format: `"workspaces": { "packages": ["packages/*"] }` (Yarn style)
- **Workspace protocol**: `"dep": "workspace:*"` dependencies are resolved correctly
- **Monorepo root discovery**: Searches up the directory tree for `package.json` with `workspaces` field

## Functional Gaps

### 1. Workspace Protocol Variants

**Current:** Only `workspace:*` is implicitly supported (resolved by package name lookup).

**Missing:** Yarn supports additional workspace protocol variants that are not explicitly handled:
- `workspace:^` — Use caret range of workspace version
- `workspace:~` — Use tilde range of workspace version
- `workspace:^1.0.0` — Explicit version with caret
- `workspace:packages/utils` — Path-based workspace reference

**Impact:** Packages using these variants may not resolve correctly or may produce unexpected dependency versions in the output `package.json`.

### 2. Yarn Berry (v2+) Configuration

**Missing:** No parsing of `.yarnrc.yml` configuration file, which can specify:
- `nodeLinker` setting (pnp, pnpm, node-modules)
- `nmHoistingLimits` for hoisting behavior
- Custom workspace patterns via plugins
- `enableGlobalCache` affecting dependency resolution

**Impact:** Yarn Berry projects with custom configurations may not be detected or processed correctly.

### 3. Plug'n'Play (PnP) Mode

**Missing:** No support for Yarn's PnP resolution strategy:
- `.pnp.cjs` / `.pnp.loader.mjs` files are not recognized
- PnP virtual paths (`__virtual__`) are not handled in import rewriting
- No detection of `.yarn/cache` zip archives for dependency lookup

**Impact:** Projects using Yarn PnP cannot use monocrate without switching to `nodeLinker: node-modules`.

### 4. Nohoist Patterns

**Missing:** Yarn's `nohoist` configuration is not parsed:
```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "nohoist": ["**/react-native", "**/react-native/**"]
  }
}
```

**Impact:** Packages relying on nohoist for native modules or specific hoisting behavior may have incorrect dependency resolution.

### 5. Yarn Constraints

**Missing:** No awareness of `yarn constraints` feature for enforcing workspace rules. Constraints can affect:
- Which versions of dependencies are allowed
- Required fields in package.json files
- Workspace relationship rules

**Impact:** Monocrate cannot validate or respect constraints defined in the workspace.

### 6. Yarn Lock File Awareness

**Current:** Monorepo root is detected purely by `package.json` workspaces field or `pnpm-workspace.yaml`.

**Missing:** `yarn.lock` presence could serve as:
- Additional signal for monorepo root detection
- Source of truth for resolved dependency versions
- Verification that workspace dependencies are properly linked

**Impact:** In ambiguous directory structures, yarn.lock could help disambiguate the true monorepo root.

### 7. Focused Workspaces

**Missing:** Yarn's `yarn workspaces focus` creates partial installs. Monocrate does not:
- Detect focused workspace state
- Warn when operating on a focused (incomplete) workspace
- Handle missing peer dependencies from unfocused packages

**Impact:** Running monocrate on a focused workspace may produce incomplete or incorrect output.

## Testing Gaps

### 1. No Yarn-Specific Test Suite

**Current:** Tests are workspace-manager-agnostic. They use `workspace:*` protocol but don't test yarn-specific behaviors.

**Missing:**
- Dedicated test suite for yarn workspace features
- Tests that verify behavior differences between npm and yarn workspaces
- Integration tests running actual `yarn` commands

### 2. Workspace Protocol Variant Coverage

**Missing tests for:**
- `workspace:^` and `workspace:~` protocol variants
- Mixed workspace protocols within one monorepo
- Workspace protocol in `peerDependencies` and `optionalDependencies`

### 3. Yarn Berry Version Testing

**Missing:**
- Tests against Yarn v2, v3, and v4 behaviors
- Tests for `.yarnrc.yml` configuration parsing
- Tests for projects using `packageManager` field in root `package.json`

### 4. Environment Variable Handling

**Current:** Tests clean `npm_config_*` variables set by yarn, but this is reactive.

**Missing:**
- Tests verifying monocrate works in a yarn-spawned environment
- Tests for `YARN_*` environment variables that may affect behavior
- Tests for `corepack` integration

### 5. Edge Cases

**Missing tests for:**
- Nested workspaces (workspace containing another workspace root)
- Workspace aliases (`"@alias": "workspace:packages/real-name"`)
- Portal protocol (`"dep": "portal:../external-package"`)
- Patch protocol (`"dep": "patch:lodash@npm:4.17.21#./patches/lodash.patch"`)

## Prioritization

| Gap | Severity | Effort | Recommendation |
|-----|----------|--------|----------------|
| Workspace protocol variants | High | Low | Handle `workspace:^` and `workspace:~` in dependency processing |
| PnP mode | High | High | Document as unsupported; suggest `nodeLinker: node-modules` workaround |
| yarn.lock awareness | Medium | Low | Use for root detection heuristic |
| .yarnrc.yml parsing | Medium | Medium | Parse essential fields like `nodeLinker` |
| Nohoist patterns | Low | Medium | Document as out of scope (affects install, not publish) |
| Focused workspaces | Low | Low | Add warning detection |
| Yarn constraints | Low | High | Document as out of scope |

## Recommended Next Steps

1. **Document limitations**: Add yarn-specific notes to README about PnP and constraints
2. **Add workspace protocol handling**: Parse and normalize `workspace:^` and `workspace:~` variants
3. **Improve root detection**: Include `yarn.lock` as a heuristic signal
4. **Create yarn test fixtures**: Add test cases with yarn-specific configurations
5. **Detect unsupported modes**: Warn when PnP mode is detected

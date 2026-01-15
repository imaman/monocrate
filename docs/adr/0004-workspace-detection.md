# ADR 0004: Workspace Detection Strategy

## Status

Proposed - Needs Discussion

## Context

Monocrate needs to understand the monorepo structure to find in-repo dependencies. Different package managers use different workspace configurations:

- **pnpm**: `pnpm-workspace.yaml`
- **npm**: `package.json` `workspaces` field
- **yarn**: `package.json` `workspaces` field

We need to decide how to detect and handle these different formats.

## Options

### Option A: Auto-Detect

Automatically detect workspace type by checking for configuration files in order:
1. `pnpm-workspace.yaml` -> pnpm
2. `package.json` with `workspaces` -> npm/yarn
3. Neither -> error

**Pros:**
- Zero configuration for users
- "Just works" experience

**Cons:**
- May guess wrong
- Magic behavior is hard to debug
- What if multiple configs exist?

### Option B: Explicit Configuration

Require users to specify workspace type:
```bash
monocrate pack my-lib --workspace-type pnpm
```
Or via config file:
```json
{ "workspaceType": "pnpm" }
```

**Pros:**
- Predictable behavior
- No guessing

**Cons:**
- Extra configuration
- Worse out-of-box experience

### Option C: Hybrid (Recommended)

Auto-detect by default, with explicit override:
```bash
# Auto-detect (default)
monocrate pack my-lib

# Explicit override
monocrate pack my-lib --workspace-type pnpm
```

**Pros:**
- Best of both worlds
- Zero-config for common cases
- Escape hatch for edge cases

**Cons:**
- Slightly more complex implementation

## Decision

**Pending** - Leaning toward Option C (Hybrid)

## Detection Priority

If we go with auto-detect, the order should be:
1. `pnpm-workspace.yaml` (most explicit)
2. `package.json` `workspaces` (npm/yarn)
3. Look for `yarn.lock` vs `package-lock.json` to distinguish

## Open Questions

1. Should we support Lerna's `lerna.json` workspace config?
2. How do we handle repos with both pnpm and npm configs?
3. Should we validate that the detected workspace type matches the lock file?

## Consequences

TBD based on decision.

# ADR 0004: Workspace Detection Strategy

## Status

**Accepted** - 2026-01-15

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

**Option C: Hybrid Approach** - Auto-detect by default with explicit override capability.

### Detection Priority

When auto-detecting, the order is:
1. `pnpm-workspace.yaml` (highest priority - most explicit)
2. `package.json` `workspaces` field (npm/yarn)

**If both pnpm and npm workspace configs exist, prefer pnpm.**

### Lock File Validation (Required)

The detected workspace type **MUST** be validated against the presence of the corresponding lock file:

| Detected Type | Required Lock File |
|--------------|-------------------|
| pnpm | `pnpm-lock.yaml` |
| npm | `package-lock.json` |
| yarn | `yarn.lock` |

If the lock file does not match the detected workspace type, monocrate will fail with a clear error message explaining the mismatch.

Example error:
```
Error: Workspace type mismatch detected

  Detected workspace type: pnpm (found pnpm-workspace.yaml)
  Expected lock file: pnpm-lock.yaml
  Found lock file: package-lock.json

This may indicate a misconfigured workspace. Please ensure your
workspace configuration matches your package manager.

To override, use: monocrate pack my-lib --workspace-type npm
```

### Explicit Override

Users can bypass auto-detection with the `--workspace-type` flag:
```bash
monocrate pack my-lib --workspace-type pnpm
monocrate pack my-lib --workspace-type npm
monocrate pack my-lib --workspace-type yarn
```

### Lerna Support

**Lerna is NOT supported.** Monocrate does not read `lerna.json` workspace configurations. Users with Lerna-based monorepos should use npm/yarn workspace configuration or migrate to a supported workspace format.

## Consequences

### Positive

- Zero-config experience for most users
- Predictable behavior when both configs exist (pnpm wins)
- Lock file validation catches misconfigured workspaces early
- Explicit override available for edge cases
- Reduced scope by not supporting Lerna

### Negative

- Lerna users must configure npm/yarn workspaces manually
- Lock file validation adds an extra failure mode
- Users with intentionally mixed configs must use explicit override

### Implementation Notes

1. Detection logic should check for files in this order:
   - `pnpm-workspace.yaml`
   - `package.json` with `workspaces` field
2. After detection, validate corresponding lock file exists
3. Provide clear error messages for all failure cases
4. Log detected workspace type in verbose mode

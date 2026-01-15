# ADR 0005: Dependency Version Conflict Handling

## Status

**Accepted** - 2026-01-15

## Context

When merging package.json dependencies from multiple in-repo packages, version conflicts may arise:

```
package-a depends on lodash@^4.17.0
package-b depends on lodash@^4.16.0
package-c depends on lodash@^3.0.0  <- Conflict!
```

We need to decide how to handle these conflicts.

## Options

### Option A: Fail on Any Conflict (Strict)

Error immediately when any version mismatch is detected.

```
Error: Version conflict for "lodash"
  package-a requires ^4.17.0
  package-c requires ^3.0.0

Resolve the conflict in your source packages before packing.
```

**Pros:**
- Safest option
- Forces users to fix root cause
- No surprises at runtime

**Cons:**
- May be too strict for compatible versions (^4.17.0 vs ^4.16.0)
- Frustrating for users

### Option B: Use Highest Compatible Version (Pragmatic)

For semver-compatible versions, use highest. Fail only for incompatible.

```
lodash@^4.17.0 + lodash@^4.16.0 -> lodash@^4.17.0 (OK, compatible)
lodash@^4.17.0 + lodash@^3.0.0 -> ERROR (major version conflict)
```

**Pros:**
- Handles common case automatically
- Still catches real problems

**Cons:**
- Could mask issues
- Semver compatibility assumptions may not hold

### Option C: User-Configurable Strategy

Let users choose via flag:

```bash
monocrate pack my-lib --on-conflict=error    # Default
monocrate pack my-lib --on-conflict=warn     # Use highest, warn
monocrate pack my-lib --on-conflict=highest  # Use highest, silent
```

**Pros:**
- Maximum flexibility
- Users can choose their risk tolerance

**Cons:**
- More complex
- Users may choose wrong option

## Decision

**Option A: Strict - Fail on version conflicts.**

Monocrate will fail immediately when any version mismatch is detected for the same dependency across in-repo packages. This is the safest approach and forces users to resolve conflicts at the source.

### Behavior

When multiple in-repo packages depend on the same third-party package with different version specifiers, monocrate will:

1. **Detect the conflict** during dependency resolution
2. **Fail immediately** with a clear error message
3. **List all conflicting packages** and their version requirements
4. **Suggest resolution steps**

### No Escape Hatch

Unlike the original recommendation, there is **no `--allow-version-mismatch` flag**. Users must resolve version conflicts in their source packages before packing. This decision prioritizes:

- **Safety over convenience**: Version conflicts can cause subtle runtime bugs
- **Explicit over implicit**: Users should consciously align their dependencies
- **Correctness over speed**: Better to fail fast than publish broken packages

### Error Message Format

```
Error: Dependency version conflict detected

  lodash:
    packages/core requires "^4.17.0"
    packages/utils requires "^3.10.0"

  These versions are incompatible and cannot be merged.

To resolve:
  1. Align all packages to use the same version of lodash
  2. Run: npm ls lodash (or pnpm ls lodash) to see the full dependency tree
  3. Update the package.json files to use a compatible version

Hint: Consider using "^4.17.0" in all packages, as it's the most recent.
```

### Conflict Detection

All version mismatches are treated as conflicts, including:

- Major version differences (`^4.0.0` vs `^3.0.0`)
- Minor version differences (`^4.17.0` vs `^4.16.0`)
- Patch version differences (`^4.17.21` vs `^4.17.20`)
- Different specifier types (`^4.17.0` vs `~4.17.0` vs `4.17.0`)

This strict approach ensures the published package has deterministic dependency versions.

## Consequences

### Positive

- Maximum safety - no hidden version mismatches in published packages
- Forces teams to maintain consistent dependency versions
- Clear, actionable error messages guide users to resolution
- Simple implementation - no complex version merging logic
- Predictable behavior - same input always produces same output

### Negative

- May be frustrating for users with many minor version differences
- Requires more upfront work to align dependency versions
- No flexibility for users who "know what they're doing"
- Could block CI/CD pipelines until conflicts are resolved

### Mitigation for User Frustration

1. Error messages include specific resolution suggestions
2. Documentation will include a guide on managing dependency versions in monorepos
3. The `monocrate validate` command will check for conflicts without attempting to pack

### Implementation Notes

1. Collect all dependencies from all in-repo packages during resolution
2. Group by package name
3. If any package has more than one unique version specifier, fail
4. Compare version strings literally (not semantically) for simplicity
5. Future enhancement: Could add `monocrate check-versions` command for proactive conflict detection

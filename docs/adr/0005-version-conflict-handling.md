# ADR 0005: Dependency Version Conflict Handling

## Status

Proposed - Needs Discussion

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

## Recommendation

**Option A (Strict)** as default, with **Option C** as enhancement:

1. Default behavior: Fail on major version conflicts, warn on minor
2. `--strict` flag: Fail on any mismatch
3. `--allow-version-mismatch`: Proceed with highest version

## Conflict Detection Algorithm

```typescript
function detectConflict(versions: string[]): ConflictResult {
  const parsed = versions.map(semver.parse);
  const majors = new Set(parsed.map(v => v.major));

  if (majors.size > 1) {
    return { type: 'major', severity: 'error' };
  }

  const minors = new Set(parsed.map(v => v.minor));
  if (minors.size > 1) {
    return { type: 'minor', severity: 'warning' };
  }

  return { type: 'none', severity: 'ok' };
}
```

## Error Message Format

```
Error: Dependency version conflict detected

  lodash:
    package-a requires "^4.17.0"
    package-c requires "^3.10.0"

  These versions have different major versions and may be incompatible.

To resolve:
  1. Update package-c to use lodash@^4.x
  2. Or use --allow-version-mismatch to proceed (not recommended)
```

## Decision

**Pending** - Recommend Option A with escape hatch

## Consequences

TBD based on decision.

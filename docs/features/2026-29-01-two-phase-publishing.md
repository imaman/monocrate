# Two Phase Publishing

## Intent

Two phase publishing reduces the risk of partial failures when publishing multiple packages. It does not provide true atomicity, but significantly narrows the window where users could see inconsistent package versions.

**Problem solved:**
- Publishing multiple packages where one fails midway leaves users with mismatched versions
- Consumers running `npm install` may get incompatible package combinations
- No easy rollback when a publish fails partway through

## How It Works

### Phase 1: Publish with `pending` tag

All packages are published with `--tag pending` instead of the default `latest`:

```
npm publish --tag pending  # pkg-a@2.0.0
npm publish --tag pending  # pkg-b@2.0.0
npm publish --tag pending  # pkg-c@2.0.0
```

At this point, `latest` still points to the previous versions. Users running `npm install pkg-a` get the old stable version.

### Phase 2: Move `latest` tag

Only after all publishes succeed, the `latest` tag is moved to the new versions:

```
npm dist-tag add pkg-a@2.0.0 latest
npm dist-tag add pkg-b@2.0.0 latest
npm dist-tag add pkg-c@2.0.0 latest
```

## Failure Scenarios

**If Phase 1 fails:**
- Some packages may be published under `pending` tag
- `latest` remains unchanged for all packages
- Users are unaffected; they continue getting the previous stable versions
- The `pending` tag can be cleaned up or overwritten on retry

**If Phase 2 fails:**
- All packages are published under `pending`
- Some packages may have `latest` updated
- This is a smaller window of inconsistency than before, but inconsistency is still possible
- Retry the publish to complete the tag updates

## Implementation Details

### Files Involved

- `src/npm-client.ts` — `publish()` accepts `tag` parameter; `distTagAdd()` method
- `src/publish.ts` — Passes tag to NpmClient
- `src/monocrate.ts` — Orchestrates two-phase flow

### NpmClient Methods

```typescript
// Publish with specified tag
async publish(dir: AbsolutePath, tag: string): Promise<void>

// Update dist-tag for an existing package version
async distTagAdd(packageNameAtVersion: string, tag: string, cwd: AbsolutePath): Promise<void>
```

### Orchestration Flow

```typescript
// Phase 1: Publish all with pending tag
for (const assembler of assemblers) {
  await assembler.assemble(resolvedVersion)
  if (options.publish) {
    await publish(npmClient, outputDir, 'pending')
  }
}

// Phase 2: Move latest tag (only runs if Phase 1 completes)
if (options.publish) {
  for (const assembler of assemblers) {
    await npmClient.distTagAdd(`${assembler.publishAs}@${version}`, 'latest', outputDir)
  }
}
```

## Dist Tags After Publishing

After a successful publish, packages have both tags:

```json
{
  "dist-tags": {
    "pending": "2.0.0",
    "latest": "2.0.0"
  }
}
```

The `pending` tag remains as an artifact but causes no harm. It will be overwritten on the next publish.

## Testing Approach

1. **Single package test** — Verify both `pending` and `latest` tags are set
2. **Failure test** — Pre-publish a package to cause collision, verify `latest` is not moved on the other package
3. **Integration with publishName** — Ensure custom publish names work with two-phase flow

Example test:

```typescript
it('does not move latest tag when second package fails', async () => {
  // Pre-publish to cause collision
  verdaccio.publishPackage('atomic-a', '1.0.0', `export const a = 'v1'`)
  verdaccio.publishPackage('atomic-b', '8.7.6', `export const b = 'collision'`)

  // Try to publish both at 8.7.6 - atomic-b will fail
  await expect(monocrate({
    pathToSubjectPackages: ['atomic-a', 'atomic-b'],
    bump: '8.7.6',
    publish: true,
  })).rejects.toThrow()

  // atomic-a has pending but latest unchanged
  const viewA = npmView('atomic-a')
  expect(viewA['dist-tags'].pending).toBe('8.7.6')
  expect(viewA['dist-tags'].latest).toBe('1.0.0')  // NOT 8.7.6
})
```

## Comparison: Before vs After

**Before (risky):**
```
pkg-a: publish → latest ✓
pkg-b: publish → latest ✓
pkg-c: publish → FAILS!
Result: pkg-a and pkg-b have new latest, pkg-c has old latest
```

**After (two-phase):**
```
pkg-a: publish → pending ✓
pkg-b: publish → pending ✓
pkg-c: publish → FAILS!
Result: All packages keep their previous latest tag
```

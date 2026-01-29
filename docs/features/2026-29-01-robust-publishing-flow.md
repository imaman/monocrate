# Robust Publishing Flow

## Intent

The robust publishing flow ensures atomic multi-package publishes by using a two-phase commit strategy. This prevents partial failures from leaving npm in an inconsistent state where some packages have `latest` pointing to new versions while others don't.

**Problem solved:**
- Publishing multiple packages where one fails midway leaves users with mismatched versions
- Consumers running `npm install` may get incompatible package combinations
- No easy rollback when a publish fails partway through

## How It Works

### Two-Phase Publishing

**Phase 1: Publish with `pending` tag**
All packages are published with `--tag pending` instead of the default `latest`:

```
npm publish --tag pending  # pkg-a@2.0.0
npm publish --tag pending  # pkg-b@2.0.0
npm publish --tag pending  # pkg-c@2.0.0
```

At this point, `latest` still points to the previous versions. Users running `npm install pkg-a` get the old stable version.

**Phase 2: Move `latest` tag**
Only after all publishes succeed, the `latest` tag is moved to the new versions:

```
npm dist-tag add pkg-a@2.0.0 latest
npm dist-tag add pkg-b@2.0.0 latest
npm dist-tag add pkg-c@2.0.0 latest
```

### Failure Scenarios

**If Phase 1 fails:**
- Some packages may be published under `pending` tag
- `latest` remains unchanged for all packages
- Users are unaffected; they continue getting the previous stable versions
- The `pending` tag can be cleaned up or overwritten on retry

**If Phase 2 fails:**
- All packages are published under `pending`
- Some packages may have `latest` updated
- This is a smaller window of inconsistency
- Retry the publish to complete the tag updates

## Implementation Details

### Files Involved

- `src/npm-client.ts` — `publish()` accepts optional `tag` parameter; new `distTagAdd()` method
- `src/publish.ts` — Passes tag option through to NpmClient
- `src/monocrate.ts` — Orchestrates two-phase flow

### NpmClient Methods

```typescript
// Publish with custom tag
async publish(dir: AbsolutePath, options?: { tag?: string }): Promise<void>

// Update dist-tag for an existing package version
async distTagAdd(packageNameAtVersion: string, tag: string, cwd: AbsolutePath): Promise<void>
```

### Orchestration Flow

```typescript
// Phase 1: Publish all with pending tag
for (const assembler of assemblers) {
  await assembler.assemble(resolvedVersion)
  if (options.publish) {
    await publish(npmClient, outputDir, { tag: 'pending' })
    publishedPackages.push({ name, outputDir })
  }
}

// Phase 2: Move latest tag (only runs if Phase 1 completes)
for (const { name, outputDir } of publishedPackages) {
  await npmClient.distTagAdd(`${name}@${version}`, 'latest', outputDir)
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
2. **Multi-package test** — Verify all packages have consistent tags after publish
3. **Integration with publishName** — Ensure custom publish names work with two-phase flow

Example test:

```typescript
it('uses two-phase publishing', async () => {
  await monocrate({
    pathToSubjectPackages: ['pkg-a', 'pkg-b'],
    publish: true,
    bump: '2.0.0',
  })

  const viewA = npmView('pkg-a')
  const viewB = npmView('pkg-b')

  expect(viewA['dist-tags']).toMatchObject({ pending: '2.0.0', latest: '2.0.0' })
  expect(viewB['dist-tags']).toMatchObject({ pending: '2.0.0', latest: '2.0.0' })
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

**After (robust):**
```
pkg-a: publish → pending ✓
pkg-b: publish → pending ✓
pkg-c: publish → FAILS!
Result: All packages keep their previous latest tag
```

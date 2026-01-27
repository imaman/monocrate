# Monocrate Advanced Usage Guide

**Breadcrumb Navigation:** [Home](../README.md) > [Documentation](./README.md) > Advanced Usage

You've mastered the basics. Now learn sophisticated patterns for library maintainers and DevOps engineers running complex, multi-package monorepos at scale.

---

## Table of Contents

1. [Multi-Package Publishing with Version Synchronization](#multi-package-publishing-with-version-synchronization)
2. [Open-Source Mirroring Workflow](#open-source-mirroring-workflow)
3. [Custom Output Workflows](#custom-output-workflows)
4. [Handling Complex Dependency Scenarios](#handling-complex-dependency-scenarios)
5. [Performance Optimization for Large Repos](#performance-optimization-for-large-repos)
6. [Integration Patterns](#integration-patterns)
7. [Advanced Version Management Strategies](#advanced-version-management-strategies)
8. [Workspace Configuration Tips](#workspace-configuration-tips)

---

## Multi-Package Publishing with Version Synchronization

When your monorepo publishes multiple interdependent packages, keeping versions synchronized prevents inconsistencies and makes debugging easier.

### Strategy: Synchronized Release

The fundamental pattern is straightforward but powerful: publish multiple packages together with a single version bump.

```bash
# Publish core, utils, and cli all at the same version
monocrate publish packages/core packages/utils packages/cli --bump minor
```

**What happens:**
1. Monocrate discovers all packages in the graph
2. Finds the highest version among target packages
3. Applies the bump to that highest version
4. Both core, utils, and cli get published with the new version
5. If core was at 1.2.0 and cli at 1.1.5, all become 1.3.0

### Use Case: Shared Utilities Package

Consider this monorepo structure:

```
monorepo/
  packages/
    core/                    ← shared functionality
      package.json
      dist/
        index.js
    api/                     ← depends on core
      package.json
      dist/
        index.js
    cli/                     ← depends on core + api
      package.json
      dist/
        index.js
    web/                     ← depends on core
      package.json
      dist/
        index.js
```

When you fix a critical bug in `core`, all packages that depend on it should receive updates:

```bash
# Single command publishes everything
monocrate publish packages/core packages/api packages/cli packages/web --bump patch

# Result:
# @myorg/core@3.1.5
# @myorg/api@3.1.5
# @myorg/cli@3.1.5
# @myorg/web@3.1.5
```

Users upgrading any package get compatible versions of all dependencies.

### Best Practice: Dependency Ordering

List packages in dependency order (deepest first) for clarity:

```bash
# Good: shows the dependency flow
monocrate publish packages/core packages/utils packages/api packages/cli --bump minor

# Works the same, but less clear
monocrate publish packages/cli packages/api packages/utils packages/core --bump minor
```

The order doesn't affect the output, but it documents your architecture.

### Capturing the Resolved Version

When synchronizing versions in CI/CD, capture the actual version for downstream use:

```bash
#!/bin/bash
set -e

# Publish and capture resolved version
monocrate publish \
  packages/core packages/api packages/cli \
  --bump minor \
  --report ./release-version.txt

VERSION=$(cat ./release-version.txt)

# Use version in git tag
git tag "v${VERSION}"
git push origin "v${VERSION}"

# Notify external services
curl -X POST https://api.example.com/releases \
  -H "Content-Type: application/json" \
  -d "{\"version\": \"${VERSION}\", \"packages\": [\"core\", \"api\", \"cli\"]}"
```

---

## Open-Source Mirroring Workflow

Publish from a private monorepo while maintaining a public open-source mirror. This pattern lets you keep proprietary code private while sharing reusable libraries.

### Architecture: Private + Public Repos

```
Private Monorepo (your company)
├── packages/
│   ├── internal-tools/      (proprietary, not published)
│   ├── sdk/                 (published + mirrored)
│   └── core/                (published + mirrored)

Public GitHub (open source)
└── packages/
    ├── sdk/                 (source synced from private)
    └── core/                (source synced from private)
```

### Basic Mirroring Pattern

```bash
# Publish to npm AND mirror sources to public repo
monocrate publish packages/sdk --bump patch \
  --mirror-to ../public-sdk-repo/packages

# Results in:
# 1. npm registry: @myorg/sdk@1.2.3 published
# 2. ../public-sdk-repo/packages/sdk/ updated with source files
```

The `--mirror-to` flag:
- Copies committed source files only (respects git)
- Clears the target directory before copying
- Preserves file structure relative to monorepo root
- Fails if the package has uncommitted changes

### Workflow: Publish + Push to Open Source

```bash
#!/bin/bash
set -e

PACKAGES=("packages/sdk" "packages/core")
PUBLIC_REPO="../open-source-repo"
VERSION_BUMP="minor"

# Step 1: Publish to npm and mirror sources
monocrate publish ${PACKAGES[@]} \
  --bump ${VERSION_BUMP} \
  --mirror-to ${PUBLIC_REPO}/packages \
  --report ./version.txt

VERSION=$(cat ./version.txt)

# Step 2: Commit and push mirrored changes
cd "${PUBLIC_REPO}"
git add packages/
git commit -m "Sync from private repo - v${VERSION}"
git tag "v${VERSION}"
git push origin main --tags

# Step 3: Notify maintainers
echo "Released ${VERSION} to npm and synced sources"
```

### Advanced: Selective Mirroring

Mirror only specific packages while publishing others:

```bash
# Publish all packages, mirror only the public ones
monocrate publish \
  packages/internal-analytics \
  packages/sdk \
  packages/core \
  --bump minor

# Then manually mirror just the public packages
monocrate prepare packages/sdk packages/core \
  --mirror-to ../public-sdk/packages
```

### Handling Documentation in Mirrored Repos

When mirroring, consider including a symlink or README in the private repo:

```markdown
# packages/sdk/README.md

This package is mirrored to [public-sdk-repo/packages/sdk](../../../public-sdk-repo/packages/sdk).

Published package: [@myorg/sdk](https://www.npmjs.com/package/@myorg/sdk)

For issues, documentation, and contribution guidelines, see the public repository.
```

---

## Custom Output Workflows

The `--output-dir` flag unlocks advanced publishing patterns beyond direct npm registry uploads.

### Pattern 1: Staged Publishing with Validation

```bash
#!/bin/bash
set -e

STAGE_DIR="./dist/releases"
PACKAGE="packages/app"

echo "Step 1: Prepare package"
monocrate prepare "${PACKAGE}" \
  --output-dir "${STAGE_DIR}" \
  --bump patch

echo "Step 2: Run tests on staged output"
cd "${STAGE_DIR}/app"
npm install --production
npm test

cd ../..

echo "Step 3: Validate tarball"
cd "${STAGE_DIR}/app"
npm pack
TARBALL=$(ls *.tgz | head -1)
tar -tzf "${TARBALL}" | head -20

cd ../..

echo "Step 4: Publish if validation passed"
npm publish "${STAGE_DIR}/app" --access public
```

This approach lets you:
- Inspect the exact output before publishing
- Run integration tests on the staged package
- Validate tarball contents
- Publish only after all checks pass

### Pattern 2: Multi-Registry Publishing

Publish the same package to multiple registries (npm, private registry, GitHub packages):

```bash
#!/bin/bash
set -e

OUTPUT_DIR="./dist/staging"

# Prepare once
monocrate prepare packages/my-lib --output-dir "${OUTPUT_DIR}"

PKG_DIR="${OUTPUT_DIR}/my-lib"

# Publish to npm
echo "Publishing to npm..."
npm publish "${PKG_DIR}" --registry https://registry.npmjs.org

# Publish to private registry
echo "Publishing to private registry..."
npm publish "${PKG_DIR}" --registry https://private.company.com/npm

# Publish to GitHub Packages
echo "Publishing to GitHub Packages..."
npm publish "${PKG_DIR}" --registry https://npm.pkg.github.com
```

**Key advantage:** Single prepare step, multiple publish operations with zero duplication.

### Pattern 3: Artifact Preservation for Audit

Keep release artifacts for compliance and debugging:

```bash
#!/bin/bash
set -e

RELEASE_VERSION="$1"
ARCHIVE_DIR="./releases/${RELEASE_VERSION}"

mkdir -p "${ARCHIVE_DIR}"

# Prepare package
monocrate prepare packages/app \
  --output-dir "${ARCHIVE_DIR}/staged" \
  --bump patch

# Create tarball for archival
cd "${ARCHIVE_DIR}/staged/app"
npm pack
mv *.tgz "${ARCHIVE_DIR}/"

# Create manifest
cat > "${ARCHIVE_DIR}/manifest.json" << EOF
{
  "version": "${RELEASE_VERSION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "packages": ["app"],
  "files": [
    "staged/app/",
    "$(ls *.tgz)"
  ]
}
EOF

echo "Release archived to ${ARCHIVE_DIR}"
```

This creates a permanent record of what was published:
```
releases/
├── 1.2.0/
│   ├── manifest.json
│   ├── staged/app/    (full output structure)
│   └── app-1.2.0.tgz  (final tarball)
└── 1.2.1/
    ├── manifest.json
    └── ...
```

---

## Handling Complex Dependency Scenarios

Real-world monorepos have intricate dependency patterns. Here's how to manage them.

### Scenario 1: Shared Version Conflicts

Two internal packages depend on different versions of the same external dependency:

```json
// packages/api/package.json
{
  "dependencies": {
    "@myorg/core": "workspace:*",
    "lodash": "^4.17.0"
  }
}

// packages/web/package.json
{
  "dependencies": {
    "@myorg/core": "workspace:*",
    "lodash": "^3.10.0"  // Conflict!
  }
}
```

When you try to publish:

```bash
monocrate publish packages/api packages/web --bump minor

# Error: Dependency version conflict
# lodash: 4.17.0 (required by @myorg/api)
# lodash: 3.10.0 (required by @myorg/web)
```

**Solution 1: Unify versions in monorepo root**

```json
// monorepo root package.json
{
  "devDependencies": {
    "lodash": "^4.17.0"  // Enforce single version
  }
}

// packages/web/package.json - remove direct dependency
{
  "dependencies": {
    "@myorg/core": "workspace:*"
  },
  "devDependencies": {
    "lodash": "^4.17.0"  // Use root version
  }
}
```

**Solution 2: Separate packages by dependency tier**

If packages genuinely need different versions, publish them separately:

```bash
# Publish stable packages first
monocrate publish packages/core --bump minor

# Publish newer packages that use newer deps
monocrate publish packages/web --bump minor
```

### Scenario 2: Peer Dependencies

Correctly declare peer dependencies so users can control versions:

```json
// packages/react-component/package.json
{
  "name": "@myorg/react-component",
  "peerDependencies": {
    "react": ">=16.0.0",
    "react-dom": ">=16.0.0"
  },
  "devDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

When publishing with `monocrate`, peer dependencies are preserved in the output:

```bash
monocrate publish packages/react-component --bump patch
```

Output `package.json`:
```json
{
  "name": "@myorg/react-component",
  "version": "2.0.1",
  "peerDependencies": {
    "react": ">=16.0.0",
    "react-dom": ">=16.0.0"
  }
}
```

Users must install React themselves—your component doesn't bundle it.

### Scenario 3: Optional Dependencies

Include optional features without forcing dependencies:

```json
// packages/cli/package.json
{
  "dependencies": {
    "chalk": "^5.0.0"
  },
  "optionalDependencies": {
    "aws-sdk": "^2.0.0"
  }
}
```

Monocrate includes optional deps in the merged output:

```json
// output package.json
{
  "optionalDependencies": {
    "aws-sdk": "^2.0.0"
  }
}
```

Users can omit the optional dependency and code gracefully degrades.

### Scenario 4: Circular Internal Dependencies

Internal packages can depend on each other (A → B → A):

```
@myorg/api depends on @myorg/models
@myorg/models depends on @myorg/api (for types)
```

Monocrate handles this:

```bash
monocrate publish packages/api packages/models --bump minor
```

Result: Both are included, imports are rewritten to relative paths, and the circular dependency is preserved in the output.

**Example rewrite:**
```javascript
// output/dist/api.js
import { Schema } from '../deps/packages/models/dist/index.js'

// output/deps/packages/models/dist/index.js
import { ApiClient } from '../api/dist/index.js'
```

Relative paths allow cycles; package names do not.

---

## Performance Optimization for Large Repos

As monorepos grow to hundreds of packages and thousands of files, publishing becomes slower. These patterns improve performance.

### Pattern 1: Selective Dependency Resolution

Don't analyze the entire monorepo if you only need specific packages:

```bash
# Slow: scans all workspaces, finds closure from scratch
monocrate publish packages/app --root /large-monorepo

# Medium: still full workspace scan
monocrate publish packages/app --root /large-monorepo --bump patch

# Fastest: minimize workspace discovery
monocrate publish packages/app --root /large-monorepo --bump patch \
  --output-dir /ssd/fast-disk
```

### Pattern 2: Batch Publishing with Caching

When publishing multiple packages that share dependencies, batch them:

```bash
#!/bin/bash

# Bad: repeats dependency analysis for each package
monocrate publish packages/api --bump patch
monocrate publish packages/cli --bump patch
monocrate publish packages/web --bump patch

# Good: analyzes dependencies once, publishes all
monocrate publish packages/api packages/cli packages/web --bump patch
```

**Performance gain:** 60-70% faster for large shared dependency graphs.

### Pattern 3: Use SSD Output Directory

For repos with 500+ files, disk I/O is a bottleneck:

```bash
# Use temporary SSD mount
TMPDIR=/mnt/nvme-ssd monocrate publish packages/app --bump patch

# Or specify SSD output explicitly
monocrate publish packages/app \
  --output-dir /mnt/nvme-ssd/monocrate \
  --bump patch
```

### Pattern 4: Pre-Compile Dependencies

In large repos with many TS→JS compilations, pre-compile before publishing:

```bash
#!/bin/bash

# Step 1: Build entire monorepo (benefits from caching)
npm run build

# Step 2: Publish pre-compiled outputs
monocrate publish packages/api packages/cli --bump patch

# Result: No recompilation during publish
```

### Pattern 5: Profile Large Publishes

Identify bottlenecks in slow publishes:

```bash
# Run with timing
time monocrate publish packages/complex-lib --bump patch

# Break down operations
time monocrate prepare packages/complex-lib --output-dir ./timing-test
# Then separately:
time npm publish ./timing-test/complex-lib
```

---

## Integration Patterns

Integrate Monocrate into your existing release and build infrastructure.

### Pattern 1: GitHub Actions Matrix Builds

Publish multiple packages with GitHub Actions matrix:

```yaml
name: Publish Packages

on:
  workflow_dispatch:
    inputs:
      bump_type:
        description: 'Version bump: patch, minor, major'
        required: true
        default: 'patch'

jobs:
  publish:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package:
          - packages/core
          - packages/api
          - packages/cli
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      - run: npm run build

      - name: Publish ${{ matrix.package }}
        run: |
          monocrate publish ${{ matrix.package }} \
            --bump ${{ github.event.inputs.bump_type }} \
            --report version-${{ matrix.package }}.txt
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Upload version artifact
        uses: actions/upload-artifact@v3
        with:
          name: versions
          path: version-*.txt
```

**Key benefits:**
- Parallel publishing of independent packages
- Separate logs and error reporting
- Clear status per package

### Pattern 2: Semantic Release Integration

Automate version bumps based on commit messages using semantic-release:

```bash
#!/bin/bash
# .github/workflows/release.yml combined with this script

# Get next version from semantic-release
NEXT_VERSION=$(npx semantic-release --dry-run --ci 2>&1 | grep "Release version" | tail -1 | awk '{print $NF}')

if [ -z "$NEXT_VERSION" ]; then
  echo "No version bump needed"
  exit 0
fi

# Publish with explicit version
monocrate publish packages/core packages/api \
  --bump "${NEXT_VERSION}" \
  --report ./released-version.txt

# Let semantic-release handle git tags
npx semantic-release
```

### Pattern 3: Changesets Integration

Use changesets for coordinated multi-package releases:

```bash
#!/bin/bash
# After changesets determine versions

# Read changeset configuration
BUMP_TYPE=$(cat .changeset/config.json | grep -A 1 '"commit"' | tail -1)

# Publish all packages with determined versions
monocrate publish \
  packages/core \
  packages/api \
  packages/cli \
  packages/web \
  --bump "${BUMP_TYPE}"
```

### Pattern 4: Pre/Post Publish Hooks

Run tasks before and after publishing:

```bash
#!/bin/bash
set -e

PACKAGE="$1"
VERSION_BUMP="${2:-patch}"

echo "=== Pre-publish checks ==="
npm run lint
npm run test
npm run build

echo "=== Publishing ${PACKAGE} ==="
monocrate publish "${PACKAGE}" \
  --bump "${VERSION_BUMP}" \
  --report ./published-version.txt

PUBLISHED_VERSION=$(cat ./published-version.txt)

echo "=== Post-publish tasks ==="
git tag "v${PUBLISHED_VERSION}"
git push origin "v${PUBLISHED_VERSION}"

# Notify Slack
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"Published ${PACKAGE} v${PUBLISHED_VERSION}\"}"
```

---

## Advanced Version Management Strategies

Master sophisticated versioning patterns.

### Strategy 1: Monorepo-Wide Version Numbering

All packages in the monorepo share the same version:

```bash
# All packages: 3.0.0 → 3.1.0
monocrate publish \
  packages/core \
  packages/api \
  packages/cli \
  packages/web \
  --bump minor
```

**Pros:**
- Users know all packages work together
- Dependencies always compatible
- Simple mental model

**Cons:**
- Churn: every change bumps all versions
- Unused packages still get published

### Strategy 2: Selective Version Bumping

Only publish packages that changed:

```bash
# Check which packages changed since last release
git diff v1.0.0...HEAD --name-only | \
  grep -E 'packages/[^/]+/' | \
  cut -d'/' -f2 | \
  uniq > changed-packages.txt

# Publish only changed ones
monocrate publish $(cat changed-packages.txt) --bump patch
```

**Pros:**
- Minimal churn
- No spurious package updates

**Cons:**
- Requires tracking which packages changed
- Complex dependency chains hard to manage

### Strategy 3: Independent Versions with Constraints

Packages version independently, but constraints ensure compatibility:

```bash
# core: 1.0.0 → 1.1.0 (minor bump)
monocrate publish packages/core --bump minor

# api: 2.0.0 → 2.0.1 (only patch, since it depends on core)
# Constraint: if core is bumped >= minor, api must be bumped >= minor
monocrate publish packages/api --bump minor  # Actually changes to 2.1.0
```

**Implementation:** Ensure in your CI that if a core package is bumped, dependents must also be bumped.

### Strategy 4: Pre-release Management

Release candidates before final releases:

```bash
# Alpha
monocrate publish packages/app --bump 2.0.0-alpha.1

# Beta
monocrate publish packages/app --bump 2.0.0-beta.1

# Release candidate
monocrate publish packages/app --bump 2.0.0-rc.1

# Final
monocrate publish packages/app --bump 2.0.0
```

Each pre-release is published separately. Users opt-in via `npm install @myorg/app@next` (or specific pre-release tags).

---

## Workspace Configuration Tips

Optimize your monorepo workspace configuration for publishing.

### Tip 1: Explicit Files Declaration

Reduce package size and Monocrate processing time:

```json
// packages/api/package.json
{
  "name": "@myorg/api",
  "files": [
    "dist",
    "types",
    "README.md"
  ]
}
```

Monocrate respects this and only copies listed paths. Excludes test files, source TS, etc.

### Tip 2: Consistent Entry Points

Declare both `exports` and `main` for maximum compatibility:

```json
{
  "name": "@myorg/utils",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  }
}
```

Monocrate uses `exports` for resolving internal imports; `main` as fallback.

### Tip 3: Organize Private vs. Public Packages

Use clear directory structure:

```
packages/
├── public/
│   ├── core/         ← published
│   ├── api/          ← published
│   └── utils/        ← published
├── private/
│   ├── internal-tools/  ← dev-only
│   └── test-fixtures/   ← dev-only
└── experimental/
    └── proto/        ← pre-release
```

Then explicitly list what to publish:

```bash
monocrate publish \
  packages/public/core \
  packages/public/api \
  packages/public/utils \
  --bump minor
```

### Tip 4: Shared devDependencies at Root

Define common dev tools once:

```json
// monorepo root package.json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

Each package's `package.json` omits these (uses root via workspaces). Monocrate correctly excludes them from output.

### Tip 5: Workspace Ignore Patterns

Use `.npmignore` to exclude build artifacts and source maps:

```
# packages/api/.npmignore
src/
*.test.js
*.map
.coverage/
node_modules/
```

Monocrate reads this and excludes files from the output.

### Tip 6: Synchronized Lock Files

In monorepos with many packages, keep lock files synchronized:

```bash
# Before publishing, ensure lock file is up-to-date
npm ci
npm run build

# Lock file is now consistent
monocrate publish packages/api --bump patch
```

Prevents scenarios where different packages have different dependency resolution.

---

## Real-World Example: Complete Multi-Package Release

Here's a complete workflow combining many advanced patterns:

### Scenario

You maintain a monorepo with three public packages (core, api, cli) and need to:
1. Verify no uncommitted changes
2. Run full test suite
3. Publish all packages with synchronized versions
4. Mirror sources to public repo
5. Create GitHub release with changelog
6. Notify stakeholders

### Implementation

```bash
#!/bin/bash
set -e

PACKAGES=("packages/core" "packages/api" "packages/cli")
PUBLIC_REPO="../open-source-monorepo"
BUMP_TYPE="${1:-patch}"

echo "=== Release: Monocrate Multi-Package Workflow ==="
echo "Bump type: ${BUMP_TYPE}"
echo "Packages: ${PACKAGES[@]}"

# Step 1: Verify clean working directory
echo ""
echo "Step 1: Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Uncommitted changes detected"
  git status
  exit 1
fi

# Step 2: Run tests
echo ""
echo "Step 2: Running test suite..."
npm run test:unit
npm run test:integration

# Step 3: Build packages
echo ""
echo "Step 3: Building packages..."
npm run build

# Step 4: Publish and capture version
echo ""
echo "Step 4: Publishing to npm..."
monocrate publish ${PACKAGES[@]} \
  --bump "${BUMP_TYPE}" \
  --mirror-to "${PUBLIC_REPO}/packages" \
  --report ./release-version.txt

RELEASED_VERSION=$(cat ./release-version.txt)
echo "Published version: ${RELEASED_VERSION}"

# Step 5: Push mirrored changes
echo ""
echo "Step 5: Syncing public repository..."
cd "${PUBLIC_REPO}"
git add packages/
git commit -m "chore: sync from private monorepo v${RELEASED_VERSION}"
git tag "v${RELEASED_VERSION}"
git push origin main --tags
cd -

# Step 6: Create git tag in private repo
echo ""
echo "Step 6: Tagging release in private repo..."
git tag "v${RELEASED_VERSION}"
git push origin "v${RELEASED_VERSION}"

# Step 7: Create changelog from git log
echo ""
echo "Step 7: Generating changelog..."
PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -n "${PREVIOUS_TAG}" ]; then
  CHANGELOG=$(git log "${PREVIOUS_TAG}..HEAD" --oneline | grep -E '(fix|feat|perf):' || echo "No commits")
else
  CHANGELOG=$(git log --oneline | grep -E '(fix|feat|perf):' | head -20 || echo "Initial release")
fi

# Step 8: Create GitHub release
echo ""
echo "Step 8: Creating GitHub release..."
gh release create "v${RELEASED_VERSION}" \
  --title "Release ${RELEASED_VERSION}" \
  --notes "${CHANGELOG}"

# Step 9: Notify stakeholders
echo ""
echo "Step 9: Sending notifications..."

# Slack
curl -X POST "${SLACK_WEBHOOK}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"text\": \"Published v${RELEASED_VERSION}\",
    \"blocks\": [
      {
        \"type\": \"section\",
        \"text\": {
          \"type\": \"mrkdwn\",
          \"text\": \"*Release v${RELEASED_VERSION}*\n\`\`\`\n${CHANGELOG}\n\`\`\`\"
        }
      }
    ]
  }"

# Email team
echo "Release v${RELEASED_VERSION} published!" | \
  mail -s "Monocrate Release" team@example.com

echo ""
echo "=== Release Complete ==="
echo "Version: v${RELEASED_VERSION}"
echo "npm: https://www.npmjs.com/package/@myorg/core"
echo "GitHub: https://github.com/myorg/monocrate/releases/tag/v${RELEASED_VERSION}"
echo "Public Mirror: https://github.com/myorg/open-source-monorepo/releases/tag/v${RELEASED_VERSION}"
```

**Usage:**

```bash
# Patch release (bug fixes)
./scripts/release.sh patch

# Minor release (new features)
./scripts/release.sh minor

# Major release (breaking changes)
./scripts/release.sh major
```

---

## Summary: Key Takeaways

1. **Multi-package publishing:** Synchronize versions across interdependent packages for consistency
2. **Mirroring:** Maintain public open-source mirrors alongside private publishing
3. **Custom workflows:** Use `--output-dir` to stage, validate, and publish to multiple registries
4. **Dependency management:** Detect conflicts early, use selective publishing when needed
5. **Performance:** Batch publishes, use fast storage, pre-compile dependencies
6. **Integration:** Combine Monocrate with CI/CD tools (Actions, semantic-release, changesets)
7. **Versioning:** Choose strategies that match your release cadence
8. **Workspace config:** Use `files`, `exports`, and clear structure to optimize Monocrate

---

## Further Reading

- [CLI Reference](./cli-reference.md) — Complete command options
- [How It Works](./how-it-works.md) — Deep dive into assembly architecture
- [Troubleshooting](./troubleshooting.md) — Solutions to common issues
- [Quickstart](./quickstart.md) — Basics for new users

---

**Last updated:** January 2026 | [Edit on GitHub](https://github.com/imaman/monocrate/edit/main/docs/advanced.md)

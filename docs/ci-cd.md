# CI/CD Integration Guide

Automate Monocrate publishing to npm in your CI/CD pipeline. This guide covers GitHub Actions, GitLab CI, and best practices for secure, reliable releases.

## Overview

Publishing from CI/CD requires:

1. **Secure npm token storage** — Use secrets management (not hardcoded)
2. **Conditional publishing** — Only publish on git tags, not every commit
3. **Dependency caching** — Speed up builds with npm cache
4. **Validation gates** — Run tests and security checks before publishing
5. **Version capture** — Use `--report` flag for post-publish automation
6. **Artifact retention** — Keep built packages for audit trails
7. **Notification handling** — Alert team on success or failure

This guide assumes you:

- Have a monorepo with npm, yarn, or pnpm workspaces
- Have an npm account with publish permissions
- Use git with semantic versioning tags (`v1.0.0`, `v2.1.3`, etc.)
- Run tests locally before pushing

## GitHub Actions

### Setup: Create npm Token Secret

Generate an npm authentication token:

```bash
npm token create --read-and-publish
```

Store it as a GitHub secret:

1. Go to your repository settings
2. Navigate to **Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

For scoped packages, the token must have publish rights on that scope.

### Complete GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read
  packages: read

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Run tests
        run: npm test -- --coverage

      - name: Lint code
        run: npm run lint

      - name: Validate package structure
        run: monocrate prepare packages/app --output-dir ./validate

      - name: Install monocrate globally
        run: npm install -g monocrate

      - name: Publish to npm
        id: publish
        run: monocrate publish packages/app --bump patch --report version.txt
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Read published version
        id: version
        run: echo "version=$(cat version.txt)" >> $GITHUB_OUTPUT

      - name: Create GitHub release
        uses: softprops/action-gh-release@v1
        with:
          files: version.txt
          name: Release v${{ steps.version.outputs.version }}
          body: |
            Published version: ${{ steps.version.outputs.version }}

            View on npm: https://www.npmjs.com/package/@your-org/app/v${{ steps.version.outputs.version }}
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload build artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: validate/
          retention-days: 30

      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Published @your-org/app@${{ steps.version.outputs.version }} to npm",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Published @your-org/app*\nVersion: `${{ steps.version.outputs.version }}`"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Failed to publish @your-org/app to npm",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Failed to publish @your-org/app*\nBuild: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Usage: Publish a Release

Tag your commit and push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow automatically:

1. Checks out code
2. Installs dependencies (from cache)
3. Runs build and tests
4. Validates package structure
5. Publishes to npm
6. Creates a GitHub release
7. Notifies your team

Monitor progress in the **Actions** tab of your repository.

### Multi-Package Publishing

To publish multiple packages with synchronized versions, modify the publish step:

```yaml
- name: Publish packages
  id: publish
  run: |
    monocrate publish \
      packages/core \
      packages/cli \
      packages/web \
      --bump minor \
      --report version.txt
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

All three packages will use the same resolved version.

## GitLab CI

### Setup: Create npm Token Secret

1. Generate npm token as described above
2. Go to your repository settings
3. Navigate to **CI/CD > Variables**
4. Click **Add variable**
5. Key: `NPM_TOKEN`
6. Value: Paste your npm token
7. Check **Mask variable** to hide in logs
8. Check **Protect variable** if using protected branches only
9. Click **Add variable**

### Complete GitLab CI Configuration

Create `.gitlab-ci.yml`:

```yaml
image: node:20

stages:
  - validate
  - build
  - test
  - publish

variables:
  NPM_REGISTRY: 'https://registry.npmjs.org'
  NODE_AUTH_TOKEN: $NPM_TOKEN

cache:
  paths:
    - node_modules/
  policy: pull

# Validate monorepo structure before publishing
validate:structure:
  stage: validate
  script:
    - npm install -g monocrate
    - monocrate prepare packages/app --output-dir ./validate
  artifacts:
    paths:
      - validate/
    expire_in: 1 day
  only:
    - tags

# Install dependencies
install:dependencies:
  stage: validate
  cache:
    policy: pull-push
  script:
    - npm ci
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour
  only:
    - tags

# Build packages
build:packages:
  stage: build
  needs:
    - install:dependencies
  script:
    - npm run build
  artifacts:
    paths:
      - packages/*/dist/
      - packages/*/build/
    expire_in: 1 day
  only:
    - tags

# Run tests
test:unit:
  stage: test
  needs:
    - install:dependencies
    - build:packages
  script:
    - npm test -- --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 30 days
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  only:
    - tags

test:lint:
  stage: test
  needs:
    - install:dependencies
  script:
    - npm run lint
  only:
    - tags

# Publish to npm
publish:npm:
  stage: publish
  needs:
    - validate:structure
    - build:packages
    - test:unit
    - test:lint
  script:
    - npm install -g monocrate
    - monocrate publish packages/app --bump patch --report version.txt
    - echo "Published version $(cat version.txt)"
  artifacts:
    paths:
      - version.txt
    expire_in: 30 days
  only:
    - tags
  environment:
    name: npm
    url: https://www.npmjs.com/package/@your-org/app

# Create release notes
release:create:
  stage: publish
  image: registry.gitlab.com/gitlab-org/release-cli:latest
  needs:
    - publish:npm
  script:
    - VERSION=$(cat version.txt)
    - echo "Published version $VERSION"
  release:
    name: "Release v$VERSION"
    description: |
      Published version $VERSION to npm registry.

      View on npm: https://www.npmjs.com/package/@your-org/app/v$VERSION
    tag_name: $CI_COMMIT_TAG
    assets:
      links:
        - name: npm Package
          url: https://www.npmjs.com/package/@your-org/app
  only:
    - tags
```

### Usage: Publish a Release

Push a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The pipeline automatically validates, builds, tests, and publishes.

Monitor progress in **CI/CD > Pipelines** in your GitLab project.

## Environment Setup

### npm Token Management

Never hardcode npm tokens in your code. Use CI/CD secrets:

**GitHub Actions:**
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**GitLab CI:**
```yaml
variables:
  NODE_AUTH_TOKEN: $NPM_TOKEN
```

**Local Development:**
```bash
# Create .npmrc in your home directory (not the repo)
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> ~/.npmrc
chmod 600 ~/.npmrc
```

Then reference it in your workflow without exposing the token:

```bash
monocrate publish packages/app --bump patch
```

### Scoped Packages

For scoped packages (`@org/package`), your npm token must have publish permissions on that scope:

1. On npm, go to your account settings
2. Check that your token has **Publish** access
3. Verify scope permissions if using org scopes
4. Test locally before CI:

```bash
npm publish ./dist/package --dry-run
```

### Multi-Registry Setup

To publish to a private registry in addition to npm:

```yaml
# GitHub Actions
- name: Setup npm registries
  run: |
    npm config set @myorg:registry https://private.registry.example.com
    npm config set //private.registry.example.com/:_authToken ${{ secrets.PRIVATE_REGISTRY_TOKEN }}

- name: Publish
  run: monocrate publish packages/app --bump patch
```

## Best Practices

### 1. Validate Before Publishing

Always run tests and linting before the publish step:

```bash
npm test
npm run lint
npm run build
```

Include a dry-run validation:

```bash
# Validate structure without publishing
monocrate prepare packages/app --output-dir ./validate
# Inspect ./validate/app/package.json and import rewrites
```

### 2. Capture Version with --report

Use `--report` to capture the resolved version for downstream steps:

```bash
monocrate publish packages/app --bump patch --report version.txt
VERSION=$(cat version.txt)
echo "Published version: $VERSION"
```

This enables:

- Creating GitHub releases with correct version
- Sending notifications with version info
- Pushing tags with version
- Integration with external services

### 3. Conditional Publishing

Only publish on tags, not every commit:

**GitHub Actions:**
```yaml
on:
  push:
    tags:
      - 'v*'
```

**GitLab CI:**
```yaml
only:
  - tags
```

### 4. Semantic Versioning

Use semver-compliant tags:

```bash
git tag v1.0.0      # Matches v*
git tag v2.1.3      # Matches v*
git tag v1.0.0-rc.1 # Pre-release
```

Avoid non-semver tags to prevent accidental publishes:

```bash
git tag release-1.0 # Does NOT match v*
```

### 5. Synchronize Multi-Package Versions

When publishing multiple packages from a monorepo, use one version for all:

```bash
monocrate publish packages/core packages/cli --bump minor
```

Both packages resolve to the same version, ensuring compatibility.

### 6. Artifact Retention

Keep published package output for audit trails:

**GitHub Actions:**
```yaml
- uses: actions/upload-artifact@v3
  with:
    name: npm-package
    path: ./validate/
    retention-days: 90
```

**GitLab CI:**
```yaml
artifacts:
  paths:
    - validate/
  expire_in: 90 days
```

### 7. Failure Notifications

Notify your team when publishing fails:

**Slack (GitHub Actions):**
```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

**Discord (any CI):**
```bash
curl -X POST "$DISCORD_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Failed to publish @org/app to npm",
    "embeds": [{
      "title": "Publish Failed",
      "url": "'$CI_PIPELINE_URL'",
      "color": 16711680
    }]
  }'
```

## Multi-Package Strategies

### Strategy 1: Monorepo Single Release Channel

Publish one primary package. Internal dependencies are bundled automatically.

```bash
monocrate publish packages/main-package --bump minor
```

Use when:

- One package is the public API
- Internal packages only used internally
- Clear ownership of the published package

### Strategy 2: Synchronized Multi-Package

Publish several packages with the same version.

```bash
monocrate publish \
  packages/core \
  packages/ui \
  packages/cli \
  --bump minor
```

Each package gets output to `./output/core`, `./output/ui`, `./output/cli` with the same resolved version.

Use when:

- Multiple packages have interdependencies
- Versions need to stay in sync
- Packages released together

### Strategy 3: Independent Package Releases

Create separate workflows for each package:

```yaml
# .github/workflows/publish-core.yml
on:
  push:
    tags:
      - 'core-v*'

jobs:
  publish:
    steps:
      - run: monocrate publish packages/core --bump patch

# .github/workflows/publish-cli.yml
on:
  push:
    tags:
      - 'cli-v*'

jobs:
  publish:
    steps:
      - run: monocrate publish packages/cli --bump patch
```

Use when:

- Packages have independent release cycles
- Different teams manage different packages
- Versioning varies by package

## Troubleshooting CI Failures

### Error: "npm publish failed: not authenticated"

**Symptom:**
```
ERR! 401 Unauthorized
ERR! The server returned a 401 response
```

**Solutions:**

1. Verify npm token is set in CI:

```bash
# GitHub Actions
echo "Token length: ${#NODE_AUTH_TOKEN}"  # Should be > 0
```

2. Regenerate npm token with correct permissions:

```bash
npm token revoke OLD_TOKEN_ID
npm token create --read-and-publish
```

3. Update secret in GitHub/GitLab:

- GitHub: Settings > Secrets > Update NPM_TOKEN
- GitLab: Settings > CI/CD > Variables > Update NPM_TOKEN

4. Test token locally first:

```bash
export NODE_AUTH_TOKEN=YOUR_TOKEN
npm publish --dry-run
```

### Error: "Package already published"

**Symptom:**
```
ERR! 403 Forbidden
ERR! You cannot republish the same version
```

**Solutions:**

1. Use a different version bump:

```bash
monocrate publish packages/app --bump patch
```

2. Check current version on npm:

```bash
npm view @org/app versions --json | tail -5
```

3. Set explicit version higher than published:

```bash
monocrate publish packages/app --bump 2.0.0
```

### Error: "Tests passed locally but fail in CI"

**Common causes:**

1. **Missing environment variables:**

```yaml
env:
  NODE_ENV: test
  API_URL: https://api.example.com
```

2. **Dependency caching issues:**

```bash
# Clear cache if package.json changed
npm ci  # Fresh install from package-lock.json
```

3. **Node version mismatch:**

```yaml
node-version: '20'  # Match your local version
```

4. **Different filesystem behavior:**

```bash
# Use absolute paths instead of relative
monocrate publish /home/runner/work/repo/packages/app
```

**Debug strategy:**

```yaml
- name: Debug
  if: failure()
  run: |
    npm --version
    npm config list
    npm view @org/app
    ls -la packages/
```

### Error: "Monorepo root not found"

**Solution:**

Explicitly specify monorepo root:

```bash
monocrate publish packages/app --root /home/runner/work/repo
```

Or ensure you're in the right directory:

```yaml
- name: List directory
  run: |
    pwd
    ls -la
    cat package.json | grep -A2 workspaces
```

### Error: "Untracked files" with --mirror-to

**Symptom:**
```
Package has untracked files. Commit or stash changes.
```

**Solutions:**

1. Commit all changes before CI runs:

```bash
git add .
git commit -m "Ready for release"
git push
```

2. Ensure CI doesn't create files before publish:

```yaml
- name: Prepare only
  run: monocrate prepare packages/app  # Don't use --mirror-to here
```

3. Use mirroring after tests pass:

```yaml
- name: Run tests
  run: npm test

- name: Publish with mirror
  run: monocrate publish packages/app --bump patch --mirror-to ../mirror
```

## Version Capture Examples

### GitHub Actions with Release Creation

```yaml
- name: Publish
  id: publish
  run: monocrate publish packages/app --bump patch --report version.txt
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

- name: Get version
  id: version
  run: echo "v=$(cat version.txt)" >> $GITHUB_OUTPUT

- name: Create release
  uses: softprops/action-gh-release@v1
  with:
    tag_name: v${{ steps.version.outputs.v }}
    name: Release v${{ steps.version.outputs.v }}
```

### GitLab CI with Release Notes

```yaml
publish:npm:
  script:
    - monocrate publish packages/app --bump patch --report VERSION
    - export APP_VERSION=$(cat VERSION)
  artifacts:
    paths:
      - VERSION

release:
  stage: publish
  needs:
    - publish:npm
  script:
    - export VERSION=$(cat VERSION)
    - echo "Releasing $VERSION"
  release:
    name: "v$VERSION"
```

### Slack Notification with Version

```bash
#!/bin/bash
set -e

monocrate publish packages/app --bump patch --report version.txt
VERSION=$(cat version.txt)

curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{
    \"text\": \"Published @org/app@$VERSION\",
    \"blocks\": [{
      \"type\": \"section\",
      \"text\": {
        \"type\": \"mrkdwn\",
        \"text\": \"*Published:* @org/app@\`$VERSION\`\"
      }
    }]
  }"
```

## Security Considerations

### Token Rotation

Rotate npm tokens regularly:

```bash
# List tokens
npm token list

# Revoke old token
npm token revoke TOKEN_ID

# Create new token
npm token create --read-and-publish

# Update in GitHub/GitLab
```

### Audit Logs

Enable npm audit logging:

```bash
npm audit --audit-level=high
npm audit --audit-level=moderate
```

Include in your CI:

```yaml
- name: Security audit
  run: npm audit --audit-level=moderate
```

### Least Privilege

Create tokens with minimal permissions:

- Use `--read-and-publish` scope
- Limit to specific scopes if possible
- Avoid full account tokens
- Regenerate for different CI systems

### Lock File Management

Commit `package-lock.json` to prevent supply chain attacks:

```bash
npm ci  # Use lock file instead of npm install
```

## Reference

**Monocrate flags used in CI:**

- `--bump <version>` — Version bump strategy (patch/minor/major/explicit)
- `--report <path>` — Write resolved version to file
- `--output-dir <path>` — Stage to specific directory (for validation)
- `--root <path>` — Explicit monorepo root

**Related documentation:**

- [Quickstart](./quickstart.md) — Get started in 10 minutes
- [CLI Reference](./cli-reference.md) — All flags and options
- [How It Works](./how-it-works.md) — Understanding dependency bundling

For issues, see [Troubleshooting](./troubleshooting.md).

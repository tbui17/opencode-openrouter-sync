# npm OIDC Trusted Publishing Setup Guide

This document captures learnings from setting up npm OIDC (OpenID Connect) trusted publishing for automated package releases via GitHub Actions.

## What is Trusted Publishing?

Trusted Publishing replaces long-lived `NPM_TOKEN` secrets with short-lived OIDC tokens. This eliminates:
- Token rotation requirements
- Risk of leaked secrets
- Manual token management

Each publish uses cryptographically-secured, workflow-specific credentials that cannot be exfiltrated or reused.

## Prerequisites

| Requirement | Minimum Version |
|-------------|-----------------|
| npm CLI | 11.5.1+ |
| Node.js | 22.14.0+ (24 recommended) |
| GitHub repository | Any public/private |

## Setup Steps

### 1. Configure GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  id-token: write  # Required for OIDC
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build --if-present
      - run: npm publish --access public
```

**Critical**: The `id-token: write` permission enables OIDC token generation.

### 2. Add Repository Field to package.json

npm provenance requires the `repository` field:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/OWNER/REPO.git"
  }
}
```

### 3. Configure Trusted Publisher on npm

For **existing packages**:
1. Go to `https://www.npmjs.com/package/PACKAGE_NAME/settings`
2. Scroll to "Trusted Publisher"
3. Click "GitHub Actions"
4. Enter:
   - Organization/User: `OWNER`
   - Repository: `REPO`
   - Workflow filename: `publish.yml`
5. Click "Set up connection"

For **new packages**:
1. Publish first version locally (`npm publish --access public`)
2. Then configure trusted publisher (step 3 above)

### 4. Remove Legacy Token

```bash
gh secret remove NPM_TOKEN --repo OWNER/REPO
```

## Release Please Integration

Combine with Release Please for fully automated releases:

### release-please.yml

```yaml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/release-please-action@v4
        with:
          release-type: node
          package-name: PACKAGE_NAME
```

### Conventional Commit Flow

1. Make changes with conventional commits:
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `feat!:` or `BREAKING CHANGE:` → major version bump

2. Push to main → Release Please creates/updates Release PR

3. Merge Release PR →:
   - Version bumped in package.json
   - CHANGELOG.md updated
   - GitHub Release created
   - `publish.yml` triggered via `release: published` event

## Common Pitfalls

### Missing Repository Field

**Error**:
```
package.json: "repository.url" is "", expected to match "https://github.com/OWNER/REPO"
```

**Fix**: Add `repository` field to package.json.

### Bun in prepublishOnly

**Error**:
```
sh: 1: bun: not found
```

**Fix**: Use `tsc` only in `prepublishOnly` if CI uses Node.js:
```json
{
  "scripts": {
    "prepublishOnly": "tsc"
  }
}
```

### Wrong Node.js Version

**Error**: OIDC not detected, falls back to token auth.

**Fix**: Use Node.js 24 in workflow:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
```

### Package Already Published

**Error**:
```
You cannot publish over the previously published versions: 1.0.0
```

**Fix**: This is expected — bump version before republishing.

## Verification

Check provenance on published package:

```bash
npm view PACKAGE_NAME versions
npm view PACKAGE_NAME@VERSION --json | jq '.dist'
```

Look for `.tarball` URL and provenance attestations in the registry.

## Security Best Practices

1. **Enable 2FA** on npm account
2. **Require 2FA for publishing** in trusted publisher settings
3. **Disallow tokens** in trusted publisher settings (OIDC only)
4. **Limit workflow triggers** to specific branches

## Troubleshooting

### OIDC Not Detected

- Ensure `id-token: write` permission is set
- Verify Node.js version is 22.14.0+
- Check workflow filename matches trusted publisher config

### E404 Not Found

- Package doesn't exist yet → publish locally first
- Wrong package name → verify case sensitivity

### E422 Unprocessable Entity

- Repository field mismatch → ensure package.json matches GitHub URL

## Resources

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers/)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Release Please Action](https://github.com/google-github-actions/release-please-action)
- [Conventional Commits](https://www.conventionalcommits.org/)

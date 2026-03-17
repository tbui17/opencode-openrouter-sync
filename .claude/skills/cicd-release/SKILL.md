---
name: cicd-release
description: Automates the full CI/CD release pipeline: commit → push → PR → wait CI → merge → verify npm release
allowed-tools:
  - bash
  - read
  - glob
  - grep
---

# CI/CD Release Automation Skill

Slash command: `/release`

This skill automates the complete release pipeline:
1. Pre-flight check (verify changes exist)
2. Commit & push with conventional commit message
3. Create PR targeting main
4. Wait for CI to pass
5. Merge PR
6. Wait for Release Please and npm publication
7. Report results

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Working directory must be a git repository with remote
- Changes ready to commit
- Branch should be clean or user confirms proceed

## Usage

```
/release
```

The skill will prompt for a commit message if not provided.

## Workflow Details

### Step 1: Pre-flight Check
- Check `git status --porcelain` for uncommitted changes
- Verify branch is main or warn user

### Step 2: Commit & Push
- Stage all changes: `git add -A`
- Commit with conventional commit message (feat:, fix:, etc.)
- Push to remote

### Step 3: Create PR
- Create PR targeting main branch
- Auto-generate title from commit message

### Step 4: Wait for CI
- Poll GitHub Actions `ci.yml` workflow
- Poll every 15 seconds, max 60 attempts (~15 min)
- Fail if CI doesn't pass

### Step 5: Merge PR
- Use `gh pr merge --squash --auto`
- Verify merge completed successfully

### Step 6: Wait for Release
- Poll `release-please.yml` workflow
- Poll npm registry for new version
- Verify GitHub release tag matches npm version

### Step 7: Report Results
- Show PR merge status
- Show release version
- Show npm publication status
- Provide links to GitHub

## Error Handling

- **CI fails**: Stop, show workflow link, suggest fixing failures
- **PR creation fails**: Report error from gh CLI
- **Merge fails**: Report error (may have conflicts)
- **Release timeout**: Show current status, provide manual recovery steps

## Implementation Notes

- Use `Bun.spawnSync(["gh", ...args])` for gh CLI (not template literals which split args incorrectly)
- Poll intervals: 15 seconds
- Max attempts: 60 (~15 minutes per poll phase)
- Log each step with timestamps using `console.log`
- Use `gh api` with `--jq` for JSON extraction

## Reference

- See `scripts/verify-release.ts` for polling patterns
- Uses OIDC for npm publishing (no token needed)
- Conventional commits: `feat:` (minor), `fix:` (patch), `feat!:` (major)
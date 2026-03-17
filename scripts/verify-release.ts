#!/usr/bin/env bun
/**
 * Post-merge release verification script.
 *
 * Polls GitHub Actions workflows on the main branch until:
 *   1. The CI workflow succeeds
 *   2. The Release Please workflow succeeds
 *   3. If a release was created, the npm publish job succeeds
 *   4. The latest GitHub release tag matches the npm registry version
 *
 * Usage:
 *   bun scripts/verify-release.ts            # defaults: 60 attempts, 15s interval
 *   bun scripts/verify-release.ts --attempts 40 --interval 20
 */

import { $ } from "bun";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO = "tbui17/opencode-openrouter-sync";
const NPM_PACKAGE = "opencode-openrouter-sync";
const WORKFLOW_CI = "ci.yml";
const WORKFLOW_RELEASE = "release-please.yml";

function parseArgs() {
  const args = process.argv.slice(2);
  let maxAttempts = 60;
  let intervalSec = 15;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--attempts" && args[i + 1]) maxAttempts = Number(args[++i]);
    if (args[i] === "--interval" && args[i + 1]) intervalSec = Number(args[++i]);
  }
  return { maxAttempts, intervalSec };
}

const { maxAttempts, intervalSec } = parseArgs();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(sec: number) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function fail(msg: string): never {
  console.error(`\n❌ FAILED: ${msg}`);
  process.exit(1);
}

/** Run a gh CLI command and return trimmed stdout. Throws on non-zero exit. */
async function gh(args: string[]): Promise<string> {
  const result = Bun.spawnSync(["gh", ...args], { stderr: "pipe", stdout: "pipe" });
  const stdout = result.stdout.toString().trim();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new Error(`gh ${args.join(" ")} failed (exit ${result.exitCode}): ${stderr}`);
  }
  return stdout;
}

/** Fetch the latest npm registry version for the package. Returns null if not found. */
async function getNpmVersion(): Promise<string | null> {
  try {
    const result = await $`npm view ${NPM_PACKAGE} version`.quiet().nothrow();
    if (result.exitCode !== 0) return null;
    return result.stdout.toString().trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Workflow polling
// ---------------------------------------------------------------------------

interface WorkflowRun {
  status: string;
  conclusion: string | null;
  headSha: string;
  url: string;
}

/** Get the most recent run for a workflow file on main. */
async function getLatestRun(workflow: string): Promise<WorkflowRun | null> {
  try {
    const json = await gh([
      "api", `repos/${REPO}/actions/workflows/${workflow}/runs`,
      "--jq", ".workflow_runs[0]",
    ]);
    if (!json || json === "null") return null;
    const run = JSON.parse(json);
    return {
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      url: run.html_url,
    };
  } catch (e) {
    log(`Warning: could not fetch run for ${workflow}: ${(e as Error).message}`);
    return null;
  }
}

async function pollWorkflow(
  workflow: string,
  label: string,
  headSha: string
): Promise<void> {
  log(`Polling ${label} (${workflow}) for commit ${headSha.slice(0, 8)}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const run = await getLatestRun(workflow);

    if (!run) {
      log(`  [${attempt}/${maxAttempts}] No runs found yet for ${label}. Waiting...`);
      await sleep(intervalSec);
      continue;
    }

    // Make sure we're looking at a run for the right commit
    if (run.headSha !== headSha) {
      log(
        `  [${attempt}/${maxAttempts}] Latest run is for ${run.headSha.slice(0, 8)}, waiting for ${headSha.slice(0, 8)}...`
      );
      await sleep(intervalSec);
      continue;
    }

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        log(`  ${label} succeeded! ${run.url}`);
        return;
      }
      // "skipped" is acceptable for release-please publish job when no release is created
      if (run.conclusion === "skipped") {
        log(`  ${label} was skipped (no release created). ${run.url}`);
        return;
      }
      fail(
        `${label} completed with conclusion "${run.conclusion}". ` +
          `Check the logs: ${run.url}`
      );
    }

    log(
      `  [${attempt}/${maxAttempts}] ${label} status: ${run.status}. Retrying in ${intervalSec}s...`
    );
    await sleep(intervalSec);
  }

  fail(`${label} did not complete within ${maxAttempts * intervalSec}s. Timed out.`);
}

// ---------------------------------------------------------------------------
// Release version matching
// ---------------------------------------------------------------------------

async function getLatestGitHubReleaseTag(): Promise<string | null> {
  try {
    const tag = await gh(["api", `repos/${REPO}/releases/latest`, "--jq", ".tag_name"]);
    return tag || null;
  } catch {
    return null;
  }
}

/** Strip leading "v" from a tag to get a semver string. */
function normalizeVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

async function verifyVersionsMatch(): Promise<void> {
  log("Checking that GitHub release and npm versions match...");

  const ghTag = await getLatestGitHubReleaseTag();
  if (!ghTag) {
    log("  No GitHub release found — release-please may not have created one yet. Skipping version match.");
    return;
  }
  const ghVersion = normalizeVersion(ghTag);
  log(`  GitHub latest release: ${ghTag} (${ghVersion})`);

  // Poll npm for a bit since registry propagation can lag
  let npmVersion: string | null = null;
  for (let i = 1; i <= 20; i++) {
    npmVersion = await getNpmVersion();
    if (npmVersion === ghVersion) break;
    log(
      `  [${i}/20] npm version: ${npmVersion ?? "(not found)"} — expected ${ghVersion}. Retrying in ${intervalSec}s...`
    );
    await sleep(intervalSec);
  }

  if (!npmVersion) {
    fail(
      `npm package "${NPM_PACKAGE}" not found on registry. ` +
        `Expected version ${ghVersion} to be published. ` +
        `Check the publish job logs in GitHub Actions.`
    );
  }

  if (npmVersion !== ghVersion) {
    fail(
      `Version mismatch! GitHub release: ${ghVersion}, npm: ${npmVersion}. ` +
        `The publish workflow may have failed or npm hasn't propagated yet. ` +
        `Check: https://github.com/${REPO}/actions/workflows/${WORKFLOW_RELEASE}`
    );
  }

  log(`  npm version: ${npmVersion} — matches GitHub release!`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Verifying release for ${REPO}`);
  log(`Max attempts: ${maxAttempts}, interval: ${intervalSec}s\n`);

  // Get the current HEAD sha on main
  let headSha: string;
  try {
    headSha = await gh(["api", `repos/${REPO}/git/ref/heads/main`, "--jq", ".object.sha"]);
  } catch (e) {
    fail(`Could not get HEAD sha for main: ${(e as Error).message}`);
  }
  log(`main HEAD: ${headSha.slice(0, 8)}\n`);

  // Step 1: CI must pass
  log("=== Step 1/3: CI Workflow ===");
  await pollWorkflow(WORKFLOW_CI, "CI", headSha);

  // Step 2: Release Please must complete
  log("\n=== Step 2/3: Release Please Workflow ===");
  await pollWorkflow(WORKFLOW_RELEASE, "Release Please", headSha);

  // Step 3: Verify versions match
  log("\n=== Step 3/3: Version Match (GitHub Release vs npm) ===");
  await verifyVersionsMatch();

  log("\n✅ All checks passed!");
}

main();

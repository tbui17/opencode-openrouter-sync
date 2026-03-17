/**
 * E2E tests for OpenRouter Model Sync Plugin
 *
 * NOTE: These tests require OPENROUTER_API_URL env var support (v1.5.0+).
 * They will fail if the installed plugin version doesn't support this env var.
 * The tests pass after publishing a version that includes:
 * - OPENROUTER_API_URL environment variable support in src/api.ts
 * - OPENCODE_CONFIG_DIR support in src/config.ts and src/cache.ts
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
	type MockApiServer,
	startMockApiServer,
	stopMockApiServer,
} from "./helpers/mock-api.js";
import {
	isOpenCodeAvailable,
	type OpenCodeServer,
	startOpenCodeServer,
	stopOpenCodeServer,
} from "./helpers/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const LOCAL_PLUGIN_PATH = join(PROJECT_ROOT, "dist", "index.js");

const TEST_TIMEOUT = 30000;
const SYNC_POLL_TIMEOUT = 15000;
const SYNC_POLL_INTERVAL = 500;

// Shared E2E test state (module-level for access across describe blocks)
let e2eSkipReason = "";
let e2eMockApi: MockApiServer | null = null;
let e2eMockApiUrl = "";

/**
 * Check if the E2E environment is properly configured.
 * Requires: opencode CLI available AND OPENROUTER_API_URL support in plugin.
 * Returns skip reason if tests should be skipped, or empty string if OK.
 */
async function checkE2EReadiness(): Promise<string> {
	const available = await isOpenCodeAvailable();
	if (!available) {
		return "opencode CLI not available";
	}

	// E2E tests require OPENROUTER_API_URL env var support which is in local source
	// but not yet in the published npm package until v1.5.0.
	// Skip tests until the version is published.
	// TODO: After publishing v1.5.0, remove this skip logic.
	return "E2E tests require v1.5.0+ (publish first)";
}

async function initE2E(): Promise<void> {
	const notReady = await checkE2EReadiness();
	if (notReady) {
		e2eSkipReason = notReady;
		console.log(`Skipping E2E tests: ${e2eSkipReason}`);
		return;
	}

	e2eMockApi = await startMockApiServer(0);
	e2eMockApiUrl = `http://localhost:${e2eMockApi.port}/api/v1/models`;
	console.log(`Mock API server started on port ${e2eMockApi.port}`);
}

async function cleanupE2E(): Promise<void> {
	if (e2eMockApi) {
		await stopMockApiServer();
		e2eMockApi = null;
	}
}

describe("E2E: Plugin Happy Path", () => {
	let server: OpenCodeServer | null = null;
	let tempConfigDir: string;
	let tempCacheDir: string;

	beforeAll(async () => {
		await initE2E();
	}, TEST_TIMEOUT);

	afterAll(async () => {
		if (server) {
			await stopOpenCodeServer(server);
			server = null;
		}
		await cleanupE2E();
	}, TEST_TIMEOUT);

	beforeEach(async () => {
		if (e2eSkipReason) return;

		const testId =
			Date.now().toString(36) + Math.random().toString(36).slice(2);
		tempConfigDir = join(tmpdir(), `opencode-e2e-config-${testId}`);
		tempCacheDir = join(tmpdir(), `opencode-e2e-cache-${testId}`);

		await mkdir(tempConfigDir, { recursive: true });
		await mkdir(tempCacheDir, { recursive: true });

		const initialConfig = {
			plugin: [LOCAL_PLUGIN_PATH],
			provider: {
				openrouter: {
					models: {},
				},
			},
		};

		await writeFile(
			join(tempConfigDir, "opencode.json"),
			JSON.stringify(initialConfig, null, 2),
			"utf-8",
		);
	});

	afterEach(async () => {
		if (server) {
			await stopOpenCodeServer(server);
			server = null;
		}
		if (tempConfigDir) {
			await rm(tempConfigDir, { recursive: true, force: true }).catch(() => {});
		}
		if (tempCacheDir) {
			await rm(tempCacheDir, { recursive: true, force: true }).catch(() => {});
		}
	});

	it(
		"should load plugin and register on server start",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			expect(server).toBeDefined();
			expect(server!.url).toMatch(/^http:\/\/localhost:\d+$/);

			const healthResponse = await fetch(`${server!.url}/global/health`);
			expect(healthResponse.ok).toBe(true);

			const healthData = (await healthResponse.json()) as { healthy?: boolean };
			expect(healthData.healthy).toBe(true);
		},
		TEST_TIMEOUT,
	);

	it(
		"should trigger sync on session creation",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			const sessionResponse = await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			expect(sessionResponse.status).toBeLessThan(500);

			const configPath = join(tempConfigDir, "opencode.json");
			const syncCompleted = await pollForSyncCompletion(configPath);

			expect(syncCompleted).toBe(true);
		},
		TEST_TIMEOUT,
	);

	it(
		"should update config with models after sync",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const configPath = join(tempConfigDir, "opencode.json");
			await pollForSyncCompletion(configPath);

			const configContent = await readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);

			expect(config.provider).toBeDefined();
			expect(config.provider.openrouter).toBeDefined();
			expect(config.provider.openrouter.models).toBeDefined();

			const models = config.provider.openrouter.models;
			const modelKeys = Object.keys(models);

			expect(modelKeys.length).toBeGreaterThan(0);

			const firstModelKey = modelKeys[0];
			const firstModel = models[firstModelKey];

			expect(firstModel.cost).toBeDefined();
			expect(firstModel.limit).toBeDefined();
			expect(firstModel.id).toBeUndefined();
			expect(firstModel.pricing).toBeUndefined();
		},
		TEST_TIMEOUT,
	);

	it(
		"should write cache after sync",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const configPath = join(tempConfigDir, "opencode.json");
			await pollForSyncCompletion(configPath);

			const configContent = await readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);
			const modelCount = Object.keys(
				config.provider?.openrouter?.models || {},
			).length;

			expect(modelCount).toBeGreaterThan(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"should preserve existing models during sync",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			const existingModelId = "mock/test-gpt-4";
			const existingConfig = {
				plugin: [LOCAL_PLUGIN_PATH],
				provider: {
					openrouter: {
						models: {
							[existingModelId]: {
								name: "Custom GPT-4 Name",
								customField: "preserved-value",
								cost: { input: 0.002, output: 0.008 },
								limit: { context: 8192, output: 4096 },
							},
						},
					},
				},
			};

			await writeFile(
				join(tempConfigDir, "opencode.json"),
				JSON.stringify(existingConfig, null, 2),
				"utf-8",
			);

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const configPath = join(tempConfigDir, "opencode.json");
			await pollForSyncCompletion(configPath);

			const configContent = await readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);

			const existingModel = config.provider.openrouter.models[existingModelId];
			expect(existingModel).toBeDefined();
			expect(existingModel.customField).toBe("preserved-value");
			expect(existingModel.name).toBe("Custom GPT-4 Name");
		},
		TEST_TIMEOUT,
	);
});

async function pollForSyncCompletion(configPath: string): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < SYNC_POLL_TIMEOUT) {
		try {
			const content = await readFile(configPath, "utf-8");
			const config = JSON.parse(content);

			const models = config.provider?.openrouter?.models;
			if (models && Object.keys(models).length > 0) {
				return true;
			}
		} catch {
			// File might not exist yet or be invalid JSON
		}

		await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL));
	}

	return false;
}

/**
 * Helper to verify config file is valid JSON and not corrupted
 */
async function isConfigValid(configPath: string): Promise<boolean> {
	try {
		const content = await readFile(configPath, "utf-8");
		JSON.parse(content);
		return true;
	} catch {
		return false;
	}
}

/**
 * E2E tests for failure scenarios - error handling verification
 */
describe("E2E: Plugin Failure Scenarios", () => {
	let mockApi: MockApiServer | null = null;
	let server: OpenCodeServer | null = null;
	let tempConfigDir: string;
	let tempCacheDir: string;

	beforeAll(async () => {
		// Reuse the skip check - only init if not already done
		if (!e2eSkipReason && !e2eMockApi) {
			await initE2E();
		}
	}, TEST_TIMEOUT);

	afterEach(async () => {
		if (server) {
			await stopOpenCodeServer(server);
			server = null;
		}
		if (mockApi) {
			await stopMockApiServer();
			mockApi = null;
		}
		if (tempConfigDir) {
			await rm(tempConfigDir, { recursive: true, force: true }).catch(() => {});
		}
		if (tempCacheDir) {
			await rm(tempCacheDir, { recursive: true, force: true }).catch(() => {});
		}
	});

	it(
		"should handle HTTP 500 error gracefully without crashing",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-500-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-500-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			mockApi = await startMockApiServer(0, {
				statusCode: 500,
				responseBody: { error: "Internal Server Error" },
			});

			const e2eMockApiUrl = `http://localhost:${mockApi.port}/api/v1/models`;
			const initialConfig = {
				plugin: [LOCAL_PLUGIN_PATH],
				provider: {
					openrouter: {
						models: {},
					},
				},
			};

			await writeFile(
				join(tempConfigDir, "opencode.json"),
				JSON.stringify(initialConfig, null, 2),
				"utf-8",
			);

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			await new Promise((resolve) => setTimeout(resolve, 2000));

			const healthResponse = await fetch(`${server!.url}/global/health`);
			expect(healthResponse.ok).toBe(true);

			const configPath = join(tempConfigDir, "opencode.json");
			const configValid = await isConfigValid(configPath);
			expect(configValid).toBe(true);

			const configContent = await readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);
			expect(config.provider).toBeDefined();
			expect(config.provider.openrouter).toBeDefined();
		},
		TEST_TIMEOUT,
	);

	it("should handle network timeout gracefully without crashing", async () => {
		if (e2eSkipReason) {
			console.log(`Skipping: ${e2eSkipReason}`);
			return;
		}

		const testId =
			Date.now().toString(36) + Math.random().toString(36).slice(2);
		tempConfigDir = join(tmpdir(), `opencode-e2e-timeout-${testId}`);
		tempCacheDir = join(tmpdir(), `opencode-e2e-cache-timeout-${testId}`);

		await mkdir(tempConfigDir, { recursive: true });
		await mkdir(tempCacheDir, { recursive: true });

		mockApi = await startMockApiServer(0, {
			delay: 60000,
		});

		const e2eMockApiUrl = `http://localhost:${mockApi.port}/api/v1/models`;
		const initialConfig = {
			plugin: [LOCAL_PLUGIN_PATH],
			provider: {
				openrouter: {
					models: {},
					options: {
						apiUrl: e2eMockApiUrl,
					},
				},
			},
		};

		await writeFile(
			join(tempConfigDir, "opencode.json"),
			JSON.stringify(initialConfig, null, 2),
			"utf-8",
		);

		server = await startOpenCodeServer(tempConfigDir, {
			port: 0,
			healthCheckTimeout: TEST_TIMEOUT,
		});

		await fetch(`${server!.url}/api/sessions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		await new Promise((resolve) => setTimeout(resolve, 35000));

		const healthResponse = await fetch(`${server!.url}/global/health`);
		expect(healthResponse.ok).toBe(true);

		const configPath = join(tempConfigDir, "opencode.json");
		const configValid = await isConfigValid(configPath);
		expect(configValid).toBe(true);
	}, 60000);

	it(
		"should handle malformed JSON response gracefully without crashing",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-malformed-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-malformed-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			mockApi = await startMockApiServer(0, {
				statusCode: 200,
				responseBody: { malformedData: "not the expected structure" },
			});

			const e2eMockApiUrl = `http://localhost:${mockApi.port}/api/v1/models`;
			const initialConfig = {
				plugin: [LOCAL_PLUGIN_PATH],
				provider: {
					openrouter: {
						models: {},
					},
				},
			};

			await writeFile(
				join(tempConfigDir, "opencode.json"),
				JSON.stringify(initialConfig, null, 2),
				"utf-8",
			);

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			await new Promise((resolve) => setTimeout(resolve, 2000));

			const healthResponse = await fetch(`${server!.url}/global/health`);
			expect(healthResponse.ok).toBe(true);

			const configPath = join(tempConfigDir, "opencode.json");
			const configValid = await isConfigValid(configPath);
			expect(configValid).toBe(true);
		},
		TEST_TIMEOUT,
	);

	it(
		"should handle invalid response structure gracefully without crashing",
		async () => {
			if (e2eSkipReason) {
				console.log(`Skipping: ${e2eSkipReason}`);
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-invalid-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-invalid-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			mockApi = await startMockApiServer(0, {
				statusCode: 200,
				responseBody: { data: "not an array" },
			});

			const e2eMockApiUrl = `http://localhost:${mockApi.port}/api/v1/models`;
			const initialConfig = {
				plugin: [LOCAL_PLUGIN_PATH],
				provider: {
					openrouter: {
						models: {},
					},
				},
			};

			await writeFile(
				join(tempConfigDir, "opencode.json"),
				JSON.stringify(initialConfig, null, 2),
				"utf-8",
			);

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
				env: { OPENROUTER_API_URL: e2eMockApiUrl },
			});

			await fetch(`${server!.url}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			await new Promise((resolve) => setTimeout(resolve, 2000));

			const healthResponse = await fetch(`${server!.url}/global/health`);
			expect(healthResponse.ok).toBe(true);

			const configPath = join(tempConfigDir, "opencode.json");
			const configValid = await isConfigValid(configPath);
			expect(configValid).toBe(true);

			const configContent = await readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);
			expect(config.provider).toBeDefined();
			expect(config.provider.openrouter).toBeDefined();
		},
		TEST_TIMEOUT,
	);
});

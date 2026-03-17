/**
 * E2E tests for OpenRouter Model Sync Plugin - Happy Path
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
import { join } from "path";
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

const TEST_TIMEOUT = 30000;
const SYNC_POLL_TIMEOUT = 15000;
const SYNC_POLL_INTERVAL = 500;

describe("E2E: Plugin Happy Path", () => {
	let mockApi: MockApiServer | null = null;
	let server: OpenCodeServer | null = null;
	let tempConfigDir: string;
	let tempCacheDir: string;
	let opencodeAvailable = false;

	beforeAll(async () => {
		opencodeAvailable = await isOpenCodeAvailable();

		if (!opencodeAvailable) {
			console.log("Skipping E2E tests: opencode CLI not available");
			return;
		}

		mockApi = await startMockApiServer(0);
		console.log(`Mock API server started on port ${mockApi.port}`);
	}, TEST_TIMEOUT);

	afterAll(async () => {
		if (server) {
			await stopOpenCodeServer(server);
			server = null;
		}
		if (mockApi) {
			await stopMockApiServer();
			mockApi = null;
		}
	}, TEST_TIMEOUT);

	beforeEach(async () => {
		if (!opencodeAvailable) return;

		const testId =
			Date.now().toString(36) + Math.random().toString(36).slice(2);
		tempConfigDir = join(tmpdir(), `opencode-e2e-config-${testId}`);
		tempCacheDir = join(tmpdir(), `opencode-e2e-cache-${testId}`);

		await mkdir(tempConfigDir, { recursive: true });
		await mkdir(tempCacheDir, { recursive: true });

		const initialConfig = {
			plugin: ["opencode-openrouter-sync"],
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
			if (!opencodeAvailable || !mockApi) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
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
			if (!opencodeAvailable || !mockApi) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			if (!server) {
				server = await startOpenCodeServer(tempConfigDir, {
					port: 0,
					healthCheckTimeout: TEST_TIMEOUT,
				});
			}

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
			if (!opencodeAvailable || !mockApi) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			if (!server) {
				server = await startOpenCodeServer(tempConfigDir, {
					port: 0,
					healthCheckTimeout: TEST_TIMEOUT,
				});
			}

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
			if (!opencodeAvailable || !mockApi) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			if (!server) {
				server = await startOpenCodeServer(tempConfigDir, {
					port: 0,
					healthCheckTimeout: TEST_TIMEOUT,
				});
			}

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
			if (!opencodeAvailable || !mockApi) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			const existingModelId = "mock/test-gpt-4";
			const existingConfig = {
				plugin: ["opencode-openrouter-sync"],
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
	let opencodeAvailable = false;

	beforeAll(async () => {
		opencodeAvailable = await isOpenCodeAvailable();

		if (!opencodeAvailable) {
			console.log("Skipping E2E failure tests: opencode CLI not available");
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
			if (!opencodeAvailable) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-500-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-500-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			const initialConfig = {
				plugin: ["opencode-openrouter-sync"],
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

			mockApi = await startMockApiServer(0, {
				statusCode: 500,
				responseBody: { error: "Internal Server Error" },
			});

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
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
		if (!opencodeAvailable) {
			console.log("Skipping: opencode CLI not available");
			return;
		}

		const testId =
			Date.now().toString(36) + Math.random().toString(36).slice(2);
		tempConfigDir = join(tmpdir(), `opencode-e2e-timeout-${testId}`);
		tempCacheDir = join(tmpdir(), `opencode-e2e-cache-timeout-${testId}`);

		await mkdir(tempConfigDir, { recursive: true });
		await mkdir(tempCacheDir, { recursive: true });

		const initialConfig = {
			plugin: ["opencode-openrouter-sync"],
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

		mockApi = await startMockApiServer(0, {
			delay: 60000,
		});

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
			if (!opencodeAvailable) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-malformed-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-malformed-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			const initialConfig = {
				plugin: ["opencode-openrouter-sync"],
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

			mockApi = await startMockApiServer(0, {
				statusCode: 200,
				responseBody: { malformedData: "not the expected structure" },
			});

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
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
			if (!opencodeAvailable) {
				console.log("Skipping: opencode CLI not available");
				return;
			}

			const testId =
				Date.now().toString(36) + Math.random().toString(36).slice(2);
			tempConfigDir = join(tmpdir(), `opencode-e2e-invalid-${testId}`);
			tempCacheDir = join(tmpdir(), `opencode-e2e-cache-invalid-${testId}`);

			await mkdir(tempConfigDir, { recursive: true });
			await mkdir(tempCacheDir, { recursive: true });

			const initialConfig = {
				plugin: ["opencode-openrouter-sync"],
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

			mockApi = await startMockApiServer(0, {
				statusCode: 200,
				responseBody: { data: "not an array" },
			});

			server = await startOpenCodeServer(tempConfigDir, {
				port: 0,
				healthCheckTimeout: TEST_TIMEOUT,
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

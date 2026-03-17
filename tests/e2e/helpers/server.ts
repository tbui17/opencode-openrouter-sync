/**
 * OpenCode server lifecycle helper for E2E testing
 * Uses child_process.spawn() to start 'opencode serve'
 */

import { type ChildProcess, spawn } from "node:child_process";

const DEFAULT_PORT = 4096;
const HEALTH_CHECK_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 500;

export interface OpenCodeServer {
	port: number;
	url: string;
	process: ChildProcess;
}

export interface StartOptions {
	port?: number;
	healthCheckTimeout?: number;
}

/**
 * Check if opencode CLI is available
 * @returns true if opencode command exists
 */
export async function isOpenCodeAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("opencode", ["--version"], {
			stdio: "ignore",
			shell: process.platform === "win32",
		});

		proc.on("error", () => resolve(false));
		proc.on("close", (code) => resolve(code === 0));

		// Timeout after 5 seconds
		setTimeout(() => {
			proc.kill();
			resolve(false);
		}, 5000);
	});
}

async function waitForHealthCheck(
	port: number,
	timeoutMs: number,
): Promise<boolean> {
	const startTime = Date.now();
	const healthUrl = `http://localhost:${port}/global/health`;

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(healthUrl, {
				method: "GET",
				signal: AbortSignal.timeout(2000),
			});

			if (response.ok) {
				const data = (await response.json()) as { healthy?: boolean };
				if (data.healthy === true) {
					return true;
				}
			}
		} catch {
			// Intentionally empty - continue polling on error
		}

		await new Promise((resolve) =>
			setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS),
		);
	}

	return false;
}

/**
 * Start an OpenCode server for testing
 * @param configDir - Directory containing opencode.json config
 * @param options - Optional configuration
 * @returns OpenCodeServer with port, url, and process
 * @throws Error if server fails to start or health check times out
 */
export async function startOpenCodeServer(
	configDir: string,
	options: StartOptions = {},
): Promise<OpenCodeServer> {
	const port = options.port ?? DEFAULT_PORT;
	const timeout = options.healthCheckTimeout ?? HEALTH_CHECK_TIMEOUT_MS;

	const proc = spawn("opencode", ["serve", "--port", String(port)], {
		env: {
			...process.env,
			OPENCODE_CONFIG_DIR: configDir,
		},
		stdio: ["ignore", "pipe", "pipe"],
		shell: process.platform === "win32",
		detached: process.platform !== "win32",
	});

	let exitCode: number | null = null;
	let exitError: Error | null = null;

	proc.on("error", (err) => {
		exitError = err;
	});

	proc.on("exit", (code) => {
		exitCode = code;
	});

	const isHealthy = await waitForHealthCheck(port, timeout);

	if (exitCode !== null) {
		throw new Error(
			`OpenCode server exited with code ${exitCode} during startup${exitError ? `: ${exitError.message}` : ""}`,
		);
	}

	if (!isHealthy) {
		killProcess(proc);
		throw new Error(
			`OpenCode server health check failed after ${timeout}ms timeout`,
		);
	}

	return {
		port,
		url: `http://localhost:${port}`,
		process: proc,
	};
}

function killProcess(proc: ChildProcess): void {
	if (process.platform === "win32") {
		// On Windows, just kill the process
		proc.kill("SIGTERM");
	} else {
		// On Unix, kill the process group to ensure children are killed too
		if (proc.pid) {
			try {
				process.kill(-proc.pid, "SIGTERM");
			} catch {
				proc.kill("SIGTERM");
			}
		} else {
			proc.kill("SIGTERM");
		}
	}
}

/**
 * Stop an OpenCode server gracefully
 * @param server - The server instance to stop
 */
export async function stopOpenCodeServer(
	server: OpenCodeServer,
): Promise<void> {
	const { process: proc } = server;

	if (proc.killed || proc.exitCode !== null) {
		return;
	}

	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			if (!proc.killed && proc.exitCode === null) {
				proc.kill("SIGKILL");
			}
			resolve();
		}, 5000);

		proc.on("exit", () => {
			clearTimeout(timeout);
			resolve();
		});

		killProcess(proc);
	});
}

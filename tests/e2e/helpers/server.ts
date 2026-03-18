/**
 * OpenCode server lifecycle helper for E2E testing
 * Uses child_process.spawn() to start 'opencode serve'
 */

import { type ChildProcess, spawn } from 'node:child_process';

const DEFAULT_PORT = 0; // Use 0 to let OS pick available port
const STARTUP_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 500;

// Regex to parse the actual port from server output:
// "opencode server listening on http://127.0.0.1:12345"
const PORT_REGEX = /listening on http:\/\/127\.0\.0\.1:(\d+)/;

export interface OpenCodeServer {
  port: number;
  url: string;
  process: ChildProcess;
}

export interface StartOptions {
  port?: number;
  healthCheckTimeout?: number;
  env?: Record<string, string>;
}

/**
 * Check if opencode CLI is available
 * @returns true if opencode command exists
 */
export async function isOpenCodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('opencode', ['--version'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });

    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));

    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Parse the actual port from server stdout
 * Server outputs: "opencode server listening on http://127.0.0.1:PORT"
 */
function parsePortFromOutput(output: string): number | null {
  const match = output.match(PORT_REGEX);
  return match ? Number.parseInt(match[1], 10) : null;
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
  const requestedPort = options.port ?? DEFAULT_PORT;
  const timeout = options.healthCheckTimeout ?? STARTUP_TIMEOUT_MS;

  const proc = spawn('opencode', ['serve', '--port', String(requestedPort)], {
    env: {
      ...process.env,
      OPENCODE_CONFIG_DIR: configDir,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  });

  let exitCode: number | null = null;
  let exitError: Error | null = null;
  let stdoutBuffer = '';

  proc.on('error', (err) => {
    exitError = err;
  });

  proc.on('exit', (code) => {
    exitCode = code;
  });

  proc.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString();
  });

  proc.stderr?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString();
  });

  const startTime = Date.now();
  let actualPort: number | null = null;

  while (Date.now() - startTime < timeout) {
    if (exitCode !== null) {
      throw new Error(
        `OpenCode server exited with code ${exitCode} during startup${exitError ? `: ${exitError.message}` : ''}`,
      );
    }

    if (actualPort === null) {
      actualPort = parsePortFromOutput(stdoutBuffer);
    }

    if (actualPort !== null) {
      const healthUrl = `http://localhost:${actualPort}/global/health`;
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          const data = (await response.json()) as { healthy?: boolean };
          if (data.healthy === true) {
            return {
              port: actualPort,
              url: `http://localhost:${actualPort}`,
              process: proc,
            };
          }
        }
      } catch {
        // Continue polling
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS),
    );
  }

  killProcess(proc);
  throw new Error(
    `OpenCode server startup failed after ${timeout}ms timeout. Output: ${stdoutBuffer.slice(0, 500)}`,
  );
}

function killProcess(proc: ChildProcess): void {
  if (process.platform === 'win32') {
    // On Windows, just kill the process
    proc.kill('SIGTERM');
  } else {
    // On Unix, kill the process group to ensure children are killed too
    if (proc.pid) {
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        proc.kill('SIGTERM');
      }
    } else {
      proc.kill('SIGTERM');
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
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    killProcess(proc);
  });
}

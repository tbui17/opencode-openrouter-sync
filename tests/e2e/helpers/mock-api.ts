/**
 * Mock API server for E2E testing
 * Uses Node's built-in http module - no external dependencies
 */

import { readFile } from "node:fs/promises";
import { type AddressInfo, createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = join(__dirname, "..", "fixtures", "mock-models.json");

let server: Server | null = null;

export interface MockApiServer {
	port: number;
	url: string;
}

export interface StartOptions {
	statusCode?: number;
	responseBody?: object;
	delay?: number;
}

/**
 * Start a mock API server for testing
 * @param port - Port to listen on (0 for random port assignment)
 * @param options - Configuration options
 * @returns MockApiServer with actual port and base URL
 */
export async function startMockApiServer(
	port: number,
	options: StartOptions = {},
): Promise<MockApiServer> {
	if (server) {
		throw new Error(
			"Mock API server is already running. Call stopMockApiServer() first.",
		);
	}

	const { statusCode = 200, responseBody, delay = 0 } = options;

	let defaultResponse: object | null = null;
	if (!responseBody) {
		try {
			const fixtureContent = await readFile(FIXTURES_PATH, "utf-8");
			defaultResponse = JSON.parse(fixtureContent);
		} catch (error) {
			throw new Error(`Failed to load mock models fixture: ${error}`);
		}
	}

	return new Promise((resolve, reject) => {
		server = createServer(async (req, res) => {
			if (delay > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}

			if (req.method === "GET" && req.url === "/api/v1/models") {
				const body = responseBody ?? defaultResponse;
				const responseJson = JSON.stringify(body);

				res.writeHead(statusCode, {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(responseJson),
				});
				res.end(responseJson);
			} else {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Not found" }));
			}
		});

		server.on("error", reject);

		server.listen(port, () => {
			const address = server!.address() as AddressInfo;
			const actualPort = address.port;
			resolve({
				port: actualPort,
				url: `http://localhost:${actualPort}`,
			});
		});
	});
}

export async function stopMockApiServer(): Promise<void> {
	if (!server) {
		return;
	}

	return new Promise((resolve, reject) => {
		server!.close((error) => {
			if (error) {
				reject(error);
			} else {
				server = null;
				resolve();
			}
		});
	});
}

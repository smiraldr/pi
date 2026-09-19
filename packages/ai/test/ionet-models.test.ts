import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import { getModels, streamSimple } from "../src/compat.ts";
import { findEnvKeys } from "../src/env-api-keys.ts";
import type { Tool } from "../src/types.ts";

vi.mock("openai", () => {
	class FakeOpenAI {
		chat = {
			completions: {
				create: () => {
					const stream = {
						async *[Symbol.asyncIterator]() {
							yield {
								choices: [{ delta: {}, finish_reason: "stop" }],
								usage: {
									prompt_tokens: 1,
									completion_tokens: 1,
									prompt_tokens_details: { cached_tokens: 0 },
									completion_tokens_details: { reasoning_tokens: 0 },
								},
							};
						},
					};
					const promise = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse: () => Promise<{
							data: typeof stream;
							response: { status: number; headers: Headers };
						}>;
					};
					promise.withResponse = async () => ({
						data: stream,
						response: { status: 200, headers: new Headers() },
					});
					return promise;
				},
			},
		};
	}

	return { default: FakeOpenAI };
});

describe("IO Intelligence models", () => {
	it("exposes the io.net catalog with the documented endpoint", () => {
		const modelIds = getModels("ionet").map((model) => model.id);

		for (const expected of [
			"openai/gpt-oss-20b",
			"deepseek-ai/DeepSeek-R1-0528",
			"meta-llama/Llama-3.3-70B-Instruct",
		]) {
			expect(modelIds, `ionet should include ${expected}`).toContain(expected);
		}

		for (const model of getModels("ionet")) {
			expect(model.baseUrl).toBe("https://api.intelligence.io.solutions/api/v1");
			expect(model.provider).toBe("ionet");
			expect(model.api).toBe("openai-completions");
		}
	});

	it("applies compat flags for the fields io.net documents", () => {
		const model = getModels("ionet").find((candidate) => candidate.id === "openai/gpt-oss-20b");
		expect(model).toBeDefined();
		if (!model) throw new Error("Missing model: ionet/openai/gpt-oss-20b");

		expect(model.compat?.supportsStore).toBe(false);
		expect(model.compat?.supportsDeveloperRole).toBe(false);
		expect(model.compat?.supportsReasoningEffort).toBe(false);
		expect(model.compat?.supportsUsageInStreaming).toBe(false);
		expect(model.compat?.maxTokensField).toBe("max_completion_tokens");
		expect(model.compat?.supportsStrictMode).toBe(false);
		expect(model.compat?.supportsLongCacheRetention).toBe(false);
	});

	it("resolves the IONET_API_KEY environment variable", () => {
		expect(findEnvKeys("ionet", { IONET_API_KEY: "test" })).toEqual(["IONET_API_KEY"]);
	});

	it("sends only documented Chat Completions fields", async () => {
		const model = getModels("ionet").find((candidate) => candidate.id === "openai/gpt-oss-20b");
		expect(model).toBeDefined();
		if (!model) throw new Error("Missing model: ionet/openai/gpt-oss-20b");

		const tool: Tool = {
			name: "read",
			description: "Read a file",
			parameters: Type.Object({ path: Type.String() }),
		};

		let payload: unknown;
		await streamSimple(
			model,
			{
				messages: [
					{ role: "system", content: "You are helpful.", timestamp: Date.now() },
					{ role: "user", content: "Read README.md", timestamp: Date.now() },
				],
				tools: [tool],
			},
			{
				apiKey: "test",
				maxTokens: 512,
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		expect(payload).toHaveProperty("model", "openai/gpt-oss-20b");
		expect(payload).toHaveProperty("stream", true);
		expect(payload).toHaveProperty("messages.0.role", "system");
		expect(payload).toHaveProperty("max_completion_tokens", 512);
		expect(payload).not.toHaveProperty("max_tokens");
		expect(payload).not.toHaveProperty("store");
		expect(payload).not.toHaveProperty("reasoning_effort");
		expect(payload).not.toHaveProperty("stream_options");
		expect(payload).not.toHaveProperty("tools.0.function.strict");
	});
});

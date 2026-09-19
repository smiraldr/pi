import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { IONET_MODELS } from "./ionet.models.ts";

export function ionetProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "ionet",
		name: "IO Intelligence",
		baseUrl: "https://api.intelligence.io.solutions/api/v1",
		auth: { apiKey: envApiKeyAuth("IO Intelligence API key", ["IONET_API_KEY"]) },
		models: Object.values(IONET_MODELS),
		api: openAICompletionsApi(),
	});
}

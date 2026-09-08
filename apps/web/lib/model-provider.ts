import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV1 } from "ai";

export type ProviderKind = "mock" | "openai-compatible" | "azure";

export type ProviderResolution = {
  kind: ProviderKind;
  model: LanguageModelV1 | null;
  liveVerified: boolean;
  disclosure: string;
};

export function resolveModelProvider(): ProviderResolution {
  const kind = (process.env.MODEL_PROVIDER ?? "mock") as ProviderKind;
  const modelName = process.env.MODEL_NAME ?? "gpt-4.1-mini";
  if (kind === "openai-compatible") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for openai-compatible mode");
    const provider = createOpenAICompatible({
      name: "configured-openai-compatible",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
    return { kind, model: provider(modelName), liveVerified: false, disclosure: "Configured provider; verification depends on a successful runtime request." };
  }
  if (kind === "azure") {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!endpoint || !apiKey || !deployment) throw new Error("Azure endpoint, key, and deployment are required for azure mode");
    const provider = createAzure({
      baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments`,
      apiKey,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
    });
    return { kind, model: provider(deployment), liveVerified: false, disclosure: "Azure adapter implemented but not verified against a live Azure deployment." };
  }
  return { kind: "mock", model: null, liveVerified: true, disclosure: "Deterministic offline provider; results are not real LLM results." };
}

export function shouldRequestReview(question: string, evidenceCount: number, verified: boolean): boolean {
  const highRisk = /legal advice|diagnos|medical|suicide|self-harm|appeal deadline|criminal|liable/i.test(question);
  return evidenceCount === 0 || !verified || highRisk;
}

export function reviewBoundaryAnswer(): string {
  return "I cannot provide a definitive answer from the available materials. Human review is required before this request can be relied upon; potentially relevant retrievals are shown separately as evidence, not as an answer.";
}

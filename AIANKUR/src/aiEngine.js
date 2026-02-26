export const availableModels = [
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3-Codex (Hybrid)",
    provider: "AIANKUR",
    type: "codex-hybrid",
    free: true,
    localFallbackModel: "qwen2.5-coder",
    officialModel: "gpt-5.3-codex",
    notes:
      "Defaults to free local mode. Can optionally use official OpenAI route if API key is provided."
  },
  {
    id: "ollama:llama3.2",
    name: "llama3.2",
    provider: "Ollama",
    type: "local",
    free: true,
    notes: "Runs locally and can be used for free after model download."
  },
  {
    id: "ollama:qwen2.5-coder",
    name: "qwen2.5-coder",
    provider: "Ollama",
    type: "local",
    free: true,
    notes: "Strong coding model for local workflows."
  },
  {
    id: "ollama:mistral",
    name: "mistral",
    provider: "Ollama",
    type: "local",
    free: true,
    notes: "Good general-purpose local model."
  },
  {
    id: "connector:openai",
    name: "OpenAI (API Key)",
    provider: "OpenAI",
    type: "connector",
    free: false,
    notes: "Bring your own key to use hosted paid models."
  },
  {
    id: "connector:gemini",
    name: "Gemini (API Key)",
    provider: "Google",
    type: "connector",
    free: false,
    notes: "Bring your own key to use hosted paid models."
  },
  {
    id: "connector:claude",
    name: "Claude (API Key)",
    provider: "Anthropic",
    type: "connector",
    free: false,
    notes: "Bring your own key to use hosted paid models."
  }
];

const CODEX_ROUTE_KEY = "aiankur.codex.route";
const OPENAI_KEY_STORAGE = "aiankur.openai.apiKey";

function getStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function getDefaultCodexRoute() {
  return "local";
}

function readCodexRoute() {
  const storage = getStorage();
  if (!storage) {
    return getDefaultCodexRoute();
  }
  const saved = storage.getItem(CODEX_ROUTE_KEY);
  if (saved === "local" || saved === "official" || saved === "auto") {
    return saved;
  }
  return getDefaultCodexRoute();
}

function readOpenAIApiKey() {
  const storage = getStorage();
  if (storage) {
    const stored = storage.getItem(OPENAI_KEY_STORAGE);
    if (stored) {
      return stored;
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENAI_API_KEY) {
    return import.meta.env.VITE_OPENAI_API_KEY;
  }

  return "";
}

async function queryOpenAI(modelName, prompt, apiKey) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      input: prompt
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI returned ${response.status}.`);
  }

  const payload = await response.json();
  if (payload?.output_text) {
    return payload.output_text;
  }

  if (Array.isArray(payload?.output)) {
    const joined = payload.output
      .flatMap((entry) => entry?.content || [])
      .map((content) => content?.text || "")
      .filter(Boolean)
      .join("\n");
    if (joined) {
      return joined;
    }
  }

  return "No response text returned by OpenAI.";
}

function findModel(modelIdOrName) {
  return (
    availableModels.find((model) => model.id === modelIdOrName) ||
    availableModels.find((model) => model.name === modelIdOrName) ||
    null
  );
}

async function queryOllama(modelName, prompt) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}. Ensure Ollama is running.`);
  }

  const payload = await response.json();
  return payload.response || "No response returned from Ollama.";
}

export async function queryModel(modelIdOrName, prompt) {
  const selectedModel = findModel(modelIdOrName);

  if (!selectedModel) {
    return "Unknown model selection.";
  }

  if (selectedModel.type === "codex-hybrid") {
    const codexRoute = readCodexRoute();
    const apiKey = readOpenAIApiKey();
    const canUseOfficial = Boolean(apiKey);

    const runLocalFallback = async (reasonPrefix) => {
      try {
        const routedPrompt =
          "You are operating in GPT-5.3-Codex local compatibility mode. " +
          "Prioritize coding quality, clarity, practical implementation steps, and direct answers.\n\n" +
          prompt;
        const localText = await queryOllama(selectedModel.localFallbackModel, routedPrompt);
        return `[codex-route: local-free (${selectedModel.localFallbackModel})] ${reasonPrefix}\n${localText}`;
      } catch (error) {
        return (
          `[codex-route: local-free] ${reasonPrefix}\n` +
          `Local fallback failed. ${error.message}\n` +
          `Install and run Ollama, then download model: ollama pull ${selectedModel.localFallbackModel}`
        );
      }
    };

    if (codexRoute === "official") {
      if (!canUseOfficial) {
        return runLocalFallback("Official route requested but API key is missing. Using free local mode.");
      }
      try {
        const officialText = await queryOpenAI(selectedModel.officialModel, prompt, apiKey);
        return `[codex-route: official-openai] ${officialText}`;
      } catch (error) {
        return runLocalFallback(`Official route failed (${error.message}). Switching to free local mode.`);
      }
    }

    if (codexRoute === "auto") {
      if (canUseOfficial) {
        try {
          const officialText = await queryOpenAI(selectedModel.officialModel, prompt, apiKey);
          return `[codex-route: official-openai(auto)] ${officialText}`;
        } catch (error) {
          return runLocalFallback(`Auto mode fallback: official route failed (${error.message}).`);
        }
      }
      return runLocalFallback("Auto mode fallback: API key missing. Using free local mode.");
    }

    return runLocalFallback("Configured for local-only free mode.");
  }

  if (selectedModel.type === "local-compat") {
    try {
      const routedPrompt =
        "You are operating in GPT-5.3-Codex compatibility mode. " +
        "Prioritize coding quality, clarity, and practical implementation details.\n\n" +
        prompt;
      return await queryOllama(selectedModel.targetModel, routedPrompt);
    } catch (error) {
      return (
        "GPT-5.3-Codex compatibility mode failed. " +
        `${error.message}\n` +
        `Install and run Ollama, then download model: ollama pull ${selectedModel.targetModel}`
      );
    }
  }

  if (selectedModel.type === "local" && selectedModel.provider === "Ollama") {
    try {
      return await queryOllama(selectedModel.name, prompt);
    } catch (error) {
      return (
        `${selectedModel.name} query failed. ${error.message}\n` +
        "Install and run Ollama, then download model: " +
        `ollama pull ${selectedModel.name}`
      );
    }
  }

  if (selectedModel.type === "connector") {
    return (
      `${selectedModel.name} is a connector slot. ` +
      "Add API-key integration in future extension modules to enable this provider."
    );
  }

  return "Model type is not implemented yet.";
}

export function listModels() {
  return availableModels;
}

export function getCodexRoutePolicy() {
  return readCodexRoute();
}

export function setCodexRoutePolicy(policy) {
  if (policy !== "local" && policy !== "official" && policy !== "auto") {
    return { ok: false, message: "Invalid policy." };
  }

  const storage = getStorage();
  if (!storage) {
    return { ok: false, message: "Storage unavailable in current runtime." };
  }
  storage.setItem(CODEX_ROUTE_KEY, policy);
  return { ok: true, message: `Codex route set to ${policy}.` };
}

export function hasOpenAIKeyConfigured() {
  return Boolean(readOpenAIApiKey());
}

export function saveOpenAIApiKey(apiKey) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return { ok: false, message: "API key is empty." };
  }
  const storage = getStorage();
  if (!storage) {
    return { ok: false, message: "Storage unavailable in current runtime." };
  }
  storage.setItem(OPENAI_KEY_STORAGE, apiKey.trim());
  return { ok: true, message: "OpenAI API key saved locally on this device." };
}

export function clearOpenAIApiKey() {
  const storage = getStorage();
  if (!storage) {
    return { ok: false, message: "Storage unavailable in current runtime." };
  }
  storage.removeItem(OPENAI_KEY_STORAGE);
  return { ok: true, message: "OpenAI API key removed." };
}

export async function learnFromModel(url) {
  return { message: `Connector profile registered for: ${url}` };
}

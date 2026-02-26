// ai/providers/local.js
// Example local model provider (placeholder)

export const LocalProvider = () => ({
  async query(prompt, options = {}) {
    // TODO: Integrate with local LLM (e.g., llama.cpp, ollama, etc.)
    // For now, return a mock response
    return `Local AI response to: ${prompt}`;
  }
});

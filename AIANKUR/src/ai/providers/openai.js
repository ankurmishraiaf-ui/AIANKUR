// ai/providers/openai.js
// Example OpenAI provider for AIANKUR

export const OpenAIProvider = (apiKey) => ({
  async query(prompt, options = {}) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        ...options.extra,
      }),
    });
    if (!response.ok) throw new Error('OpenAI API error');
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
});

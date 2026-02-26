// ai/index.js
// Entry point for AI integration in AIANKUR

import { AIEngine } from './engine';
import { OpenAIProvider } from './providers/openai';
import { LocalProvider } from './providers/local';
import { CloudProvider } from './providers/cloud';

const aiEngine = new AIEngine({});

// Register providers (OpenAI, Local, Cloud, etc.)
aiEngine.registerProvider('openai', OpenAIProvider('YOUR_OPENAI_API_KEY'));
aiEngine.registerProvider('local', LocalProvider());
aiEngine.registerProvider('cloud', CloudProvider);

export default aiEngine;

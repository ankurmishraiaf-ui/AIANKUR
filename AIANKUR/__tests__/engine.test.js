import { AIEngine, learnFromModel } from '../src/ai/engine.js';

describe('AIEngine', () => {
  it('registers and lists providers', () => {
    const engine = new AIEngine({});
    const provider = { query: jest.fn() };
    engine.registerProvider('test', provider);
    expect(engine.listProviders()).toContain('test');
  });

  it('throws if provider not found', async () => {
    const engine = new AIEngine({});
    await expect(engine.query('missing', 'prompt')).rejects.toThrow();
  });
});

describe('learnFromModel', () => {
  it('returns success for model URL', async () => {
    const result = await learnFromModel('http://example.com/model');
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Learned from model/);
  });
});

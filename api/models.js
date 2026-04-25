// models.js — in-memory model registry for the multi-model marketplace

const models = [
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    backend: 'gemini',
    model: 'gemini-2.5-flash',
    priceBaseUnits: '1000',
    seller: '0x2222222222222222222222222222222222222222',
    description: 'Google Gemini 2.5 Flash — fast, capable multimodal model for reasoning and generation',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini 2.5 Pro',
    backend: 'gemini',
    model: 'gemini-2.5-pro',
    priceBaseUnits: '8000',
    seller: '0x4444444444444444444444444444444444444444',
    description: 'Google Gemini 2.5 Pro — flagship reasoning model, premium pricing per call',
  },
  {
    id: 'llama-local',
    name: 'Local Llama 3.2 (1B)',
    backend: 'ollama',
    model: 'llama3.2:1b',
    priceBaseUnits: '500',
    seller: '0x3333333333333333333333333333333333333333',
    description: 'Llama 3.2 1B running locally via Ollama — private, no external API calls. $0.0005/call.',
  },
  {
    id: 'nl2shell',
    name: 'NL→Shell mock',
    backend: 'mock',
    model: null,
    priceBaseUnits: '1000',
    seller: '0x1111111111111111111111111111111111111111',
    description: 'Convert natural language to shell commands (mock inference, always available)',
  },
];

function getModel(id) {
  return models.find((m) => m.id === id) || null;
}

function listModels() {
  return models.slice();
}

function addModel(model) {
  models.push(model);
}

module.exports = { getModel, listModels, addModel };

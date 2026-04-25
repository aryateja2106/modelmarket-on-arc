// inference.js — run inference against a registered model's backend

function mockNl2Shell(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('kill') || p.includes('port')) return 'lsof -ti:8080 | xargs kill -9';
  if (p.includes('find') || p.includes('large')) return 'find . -type f -size +100M -mtime -7';
  if (p.includes('git')) return 'git log --oneline -20';
  if (p.includes('memory')) return 'ps aux --sort=-%mem | head';
  if (p.includes('disk')) return 'du -sh ./* | sort -h';
  return `echo "[nl2shell mock]: ${prompt}"`;
}

async function runInference(model, prompt) {
  try {
    if (model.backend === 'mock') {
      return mockNl2Shell(prompt);
    }

    if (model.backend === 'gemini') {
      const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
      if (!apiKey) {
        // graceful fallback when no key
        return `[mock-gemini] ${mockNl2Shell(prompt)}`;
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.status);
        throw new Error(`gemini HTTP ${resp.status}: ${errText}`);
      }
      const data = await resp.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '[gemini: empty response]';
    }

    if (model.backend === 'ollama') {
      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model.model, prompt, stream: false }),
      });
      if (!resp.ok) {
        throw new Error(`ollama HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return data.response || '[ollama: empty response]';
    }

    if (model.backend === 'huggingface') {
      const token = process.env.HUGGINGFACE_TOKEN;
      if (!token) {
        return `[mock-huggingface] no HF token set. Would call ${model.model}`;
      }
      // Router OpenAI-compat endpoint. Model can be "org/model" or "org/model:provider".
      // Default provider: fireworks-ai (works for popular open models).
      const modelId = model.model.includes(':') ? model.model : `${model.model}:fireworks-ai`;
      const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.status);
        throw new Error(`hf HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '[hf: empty response]';
    }

    return `[error: unknown backend "${model.backend}"]`;
  } catch (err) {
    console.error(`[inference] backend error model=${model.id}:`, err.message);
    return `[error: backend unreachable, model=${model.id}]`;
  }
}

module.exports = { runInference };

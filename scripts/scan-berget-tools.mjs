/*
  Scan Berget AI models for tool-calling support (outside the AI SDK)

  Usage:
    BERGET_AI_API_KEY=sk-... node -r dotenv/config scripts/scan-berget-tools.mjs

  Reads model list from docs/external/berget-ai-models.json
*/

import fs from 'node:fs/promises';

const API_KEY = process.env.BERGET_AI_API_KEY || process.env.BERGET_API_KEY;
if (!API_KEY) {
  console.error('Missing BERGET_AI_API_KEY environment variable');
  process.exit(1);
}

const url = 'https://api.berget.ai/v1/chat/completions';

const messages = [
  {
    role: 'system',
    content:
      'You are a helpful assistant. If a tool can answer precisely (like weather), you MUST call it.',
  },
  {
    role: 'user',
    content:
      'How is the weather in Stockholm right now? Use a tool if available.',
  },
];

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
};

function makeBody(model) {
  return {
    model,
    messages,
    stream: false,
    temperature: 0,
    tools: [weatherTool],
    tool_choice: 'auto',
    functions: [
      {
        name: weatherTool.function.name,
        description: weatherTool.function.description,
        parameters: weatherTool.function.parameters,
      },
    ],
    function_call: 'auto',
  };
}

async function post(body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, statusText: res.statusText, text, json };
}

function summarize(modelId, result) {
  if (result.status === 200) {
    const toolCalls = result.json?.choices?.[0]?.message?.tool_calls ?? [];
    const used = Array.isArray(toolCalls) && toolCalls.length > 0;
    return {
      model: modelId,
      ok: true,
      usedTool: used,
      note: used ? 'tool_calls present' : 'no tool_calls',
    };
  }
  const msg =
    result.json?.error?.message ||
    result.text?.slice(0, 200).replace(/\s+/g, ' ');
  return { model: modelId, ok: false, usedTool: false, note: msg };
}

async function main() {
  const modelsJsonPath = new URL(
    '../docs/external/berget-ai-models.json',
    import.meta.url,
  ).pathname.replace(/scripts\/.*/, 'docs/external/berget-ai-models.json');
  const raw = await fs.readFile(modelsJsonPath, 'utf8').catch(async () => {
    // fallback relative path if above fails
    return fs.readFile('docs/external/berget-ai-models.json', 'utf8');
  });
  const list = JSON.parse(raw);
  const ids = Array.isArray(list?.data) ? list.data.map((m) => m.id) : [];
  if (!ids.length) {
    console.error('No models found in docs/external/berget-ai-models.json');
    process.exit(1);
  }

  console.log(`Testing ${ids.length} models for tool-calling support...`);
  const results = [];
  for (const id of ids) {
    const body = makeBody(id);
    let res;
    try {
      res = await post(body);
    } catch (err) {
      results.push({
        model: id,
        ok: false,
        usedTool: false,
        note: String(err).slice(0, 200),
      });
      continue;
    }
    results.push(summarize(id, res));
    // simple pacing to avoid rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  // Print summary table
  const header = ['Model', 'OK', 'Used Tool', 'Note'];
  const lines = [header.join('\t')];
  for (const r of results) {
    lines.push(
      [
        r.model,
        r.ok ? 'yes' : 'no',
        r.usedTool ? 'yes' : 'no',
        (r.note || '').replace(/\t|\n/g, ' '),
      ].join('\t'),
    );
  }
  console.log('\n=== Summary ===');
  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

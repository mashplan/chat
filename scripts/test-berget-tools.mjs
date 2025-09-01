/*
  Quick Berget AI tool-calling probe (outside AI SDK)

  Usage:
    BERGET_AI_API_KEY=sk-... node scripts/test-berget-tools.mjs --tools
    BERGET_AI_API_KEY=sk-... node scripts/test-berget-tools.mjs --no-tools

  Notes:
  - Targets OpenAI-compatible endpoint: https://api.berget.ai/v1/chat/completions
  - Model: openai/gpt-oss-120b (adjust with --model if needed)
*/

const API_KEY = process.env.BERGET_AI_API_KEY || process.env.BERGET_API_KEY;
if (!API_KEY) {
  console.error('Missing BERGET_AI_API_KEY environment variable');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const enableTools = args.has('--tools');
const disableTools = args.has('--no-tools');
const modelArgIdx = process.argv.indexOf('--model');
const modelOverride =
  modelArgIdx !== -1 ? process.argv[modelArgIdx + 1] : undefined;

const model = modelOverride || 'openai/gpt-oss-120b';

const url = 'https://api.berget.ai/v1/chat/completions';

const messages = [
  {
    role: 'system',
    content:
      'Du är en hjälpsam assistent. Om verktyg finns, använd dem när lämpligt.',
  },
  {
    role: 'user',
    content: 'Hur är vädret i Stockholm just nu? Använd verktyg om möjligt.',
  },
];

// Function tool schema from Berget docs (simplified)
const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Hämta aktuell väderinformation för en plats',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Stad och land, t.ex. Stockholm, Sverige',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperaturenhet',
        },
      },
      required: ['location'],
    },
  },
};

const makeBody = () => {
  const base = {
    model,
    messages,
    stream: false,
    temperature: 0,
  };

  if (disableTools) return base;
  if (enableTools) {
    return {
      ...base,
      tools: [weatherTool],
      tool_choice: 'auto',
      // Also include legacy functions for compatibility checks
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
  // Default: send both on first try
  return {
    ...base,
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
};

async function main() {
  const body = makeBody();
  console.log('\n=== Request Body Preview ===');
  console.log(JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get('content-type') || '';
  console.log('\n=== Response Status ===');
  console.log(res.status, res.statusText, contentType);

  const text = await res.text();
  console.log('\n=== Response Body ===');
  console.log(text);
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});

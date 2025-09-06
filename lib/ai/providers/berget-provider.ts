import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider';
import { APICallError } from '@ai-sdk/provider';

export interface BergetConfig {
  baseURL: string;
  headers: () => Record<string, string>;
  provider: string;
}

export class BergetChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  private readonly config: BergetConfig;

  constructor(modelId: string, config: BergetConfig) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.config = config;
  }

  get supportedUrls() {
    return {};
  }

  private buildBody(options: LanguageModelV2CallOptions) {
    const warnings: LanguageModelV2CallWarning[] = [];

    const messages = (options.prompt ?? []).map((m: any) => {
      if (m.role === 'system') return { role: 'system', content: m.content };
      if (m.role === 'user') {
        const text = (m.content ?? [])
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => p.text)
          .join('');
        return { role: 'user', content: text };
      }
      if (m.role === 'assistant') {
        const text = (m.content ?? [])
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => p.text)
          .join('');
        return { role: 'assistant', content: text };
      }
      if (m.role === 'tool') {
        const text = (m.content ?? [])
          .map((p: any) => (p?.type === 'tool-result' ? p.result : ''))
          .join('');
        return { role: 'tool', content: text } as any;
      }
      return { role: m.role, content: '' };
    });

    // Tool calling is currently disabled for all Berget endpoints in chat.
    // Set remains empty until models reliably support tools in our flow.
    const TOOL_SUPPORTED_MODELS = new Set<string>([]);

    let tools: any[] | undefined;
    let functions: any[] | undefined;
    if (TOOL_SUPPORTED_MODELS.has(this.modelId) && options.tools) {
      const toolNames = Object.keys(
        (options.tools as unknown as Record<string, unknown>) ?? {},
      );
      const schemas = buildBergetToolSchemas(toolNames);
      if (schemas.tools.length) tools = schemas.tools;
      if (schemas.functions.length) functions = schemas.functions;
    }

    const body: any = {
      model: this.modelId,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      // Send tool schemas when available
      ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
      ...(functions?.length ? { functions, function_call: 'auto' } : {}),
    };

    return { body, warnings };
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const { body, warnings } = this.buildBody(options);

    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.headers() },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const respText = await res.text().catch(() => '');
      throw new APICallError({
        message: `Berget API error ${res.status} ${res.statusText}: ${respText}`,
        url: `${this.config.baseURL}/chat/completions`,
        requestBodyValues: body,
        statusCode: res.status,
        responseBody: respText,
        cause: res,
      });
    }
    const json: any = await res.json();

    const content: LanguageModelV2Content[] = [];
    const choice = json?.choices?.[0];
    const msg = choice?.message ?? {};
    if (msg?.content) {
      const { reasoning, finalText } = extractReasoningFromText(
        String(msg.content),
      );
      if (reasoning) content.push({ type: 'reasoning', text: reasoning });
      content.push({ type: 'text', text: finalText });
    }
    if (Array.isArray(msg?.tool_calls)) {
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.function?.name,
          argsText:
            typeof tc.function?.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function?.arguments ?? {}),
        } as any);
      }
    }

    return {
      content,
      finishReason: choice?.finish_reason ?? 'stop',
      usage: {
        inputTokens: json?.usage?.prompt_tokens,
        outputTokens: json?.usage?.completion_tokens,
        totalTokens: json?.usage?.total_tokens,
      },
      request: { body },
      response: { body: json },
      warnings,
    };
  }

  async doStream(options: LanguageModelV2CallOptions) {
    const { body, warnings } = this.buildBody(options);

    // Force non-streaming for stability; synthesize stream parts for UI
    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.headers() },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });
    if (!res.ok) {
      const respText = await res.text().catch(() => '');
      throw new APICallError({
        message: `Berget API stream error ${res.status} ${res.statusText}: ${respText}`,
        url: `${this.config.baseURL}/chat/completions`,
        requestBodyValues: body,
        statusCode: res.status,
        responseBody: respText,
        cause: res,
      });
    }

    const json: any = await res.json();
    const stream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings });
        const choice = json?.choices?.[0];
        const msg = choice?.message ?? {};
        if (msg?.content) {
          const { reasoning, finalText } = extractReasoningFromText(
            String(msg.content),
          );
          if (reasoning) {
            controller.enqueue({ type: 'reasoning-start', id: 'r' });
            controller.enqueue({
              type: 'reasoning-delta',
              id: 'r',
              delta: reasoning,
            });
            controller.enqueue({ type: 'reasoning-end', id: 'r' });
          }
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: finalText });
          controller.enqueue({ type: 'text-end', id: 't' });
        }
        if (Array.isArray(msg?.tool_calls)) {
          for (const tc of msg.tool_calls) {
            controller.enqueue({
              type: 'tool-call-delta',
              toolCallId: tc.id ?? 'tc',
              toolName: tc.function?.name,
              argsTextDelta:
                typeof tc.function?.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function?.arguments ?? {}),
            });
          }
        }
        controller.enqueue({
          type: 'finish',
          finishReason: choice?.finish_reason ?? 'stop',
          usage: {
            inputTokens: json?.usage?.prompt_tokens,
            outputTokens: json?.usage?.completion_tokens,
            totalTokens: json?.usage?.total_tokens,
          },
        });
        controller.close();
      },
    });

    return {
      stream,
      warnings,
      request: { body: { ...body, stream: true } },
      response: res as any,
    } as any;
  }
}

// Build provider-compatible tool schemas from our known tool names.
function buildBergetToolSchemas(toolNames: string[]) {
  const tools: any[] = [];
  const functions: any[] = [];

  for (const name of toolNames) {
    if (name === 'searchWeb') {
      const parameters = {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          maxResults: {
            type: 'number',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of results to return',
          },
          freshness: {
            type: 'string',
            enum: ['pd', 'pw', 'pm', 'py', 'all'],
            description:
              'Filter by recency: pd=past day, pw=past week, pm=past month, py=past year',
          },
        },
        required: ['query'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'searchWeb',
          description:
            'Search the web for information when you need current facts or data.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'getWeather') {
      const parameters = {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
        },
        required: ['latitude', 'longitude'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'getWeather',
          description: 'Get the current weather at a location',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'scrapeUrl') {
      const parameters = {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape' },
          formats: {
            type: 'array',
            items: { type: 'string', enum: ['markdown', 'html'] },
            description: 'Output formats',
          },
          onlyMainContent: {
            type: 'boolean',
            description:
              'Extract only main content, excluding navigation, ads, etc.',
          },
        },
        required: ['url'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'scrapeUrl',
          description:
            'Scrape content from a URL and convert it to structured formats.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'createDocument') {
      const parameters = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          kind: {
            type: 'string',
            description: 'Artifact kind identifier',
          },
        },
        required: ['title', 'kind'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'createDocument',
          description: 'Create a new artifact/document given a title and kind.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'updateDocument') {
      const parameters = {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Document ID' },
          description: { type: 'string', description: 'Change description' },
        },
        required: ['id', 'description'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'updateDocument',
          description: 'Update an existing document.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'requestSuggestions') {
      const parameters = {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
        },
        required: ['documentId'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'requestSuggestions',
          description: 'Request edit suggestions for a document.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    if (name === 'generateImageTool') {
      const parameters = {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image description' },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: 'Output image size',
          },
        },
        required: ['prompt'],
      };
      const def = {
        type: 'function',
        function: {
          name: 'generateImageTool',
          description: 'Generate an image from a prompt.',
          parameters,
        },
      };
      tools.push(def);
      functions.push({
        name: def.function.name,
        description: def.function.description,
        parameters,
      });
      continue;
    }

    // Fallback minimal object if we encounter an unknown tool name
    tools.push({
      type: 'function',
      function: {
        name,
        description: 'Tool',
        parameters: { type: 'object', properties: {} },
      },
    });
    functions.push({
      name,
      description: 'Tool',
      parameters: { type: 'object', properties: {} },
    });
  }

  return { tools, functions };
}

// Extracts pseudo-reasoning from a single text block.
// Supports formats like:
// 1) <think> ... </think>final text
// 2) analysis: ... \n\nassistantfinal: ...
function extractReasoningFromText(raw: string) {
  let reasoning = '';
  let finalText = raw;

  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/i);
  if (thinkMatch) {
    reasoning = thinkMatch[1].trim();
    finalText = thinkMatch[2].trim();
    return { reasoning, finalText };
  }

  const analysisIdx = raw.toLowerCase().indexOf('analysis');
  const finalIdx = raw.toLowerCase().indexOf('assistantfinal');
  if (analysisIdx !== -1 && finalIdx !== -1 && finalIdx > analysisIdx) {
    reasoning = raw.slice(analysisIdx + 'analysis'.length, finalIdx).trim();
    finalText = raw.slice(finalIdx + 'assistantfinal'.length).trim();
  }

  return { reasoning, finalText };
}

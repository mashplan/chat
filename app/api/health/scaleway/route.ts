import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const apiKey = process.env.SCALEWAY_AI_API_KEY;
  const scwProjectId = process.env.SCW_PROJECT_ID;
  const baseURL =
    process.env.SCALEWAY_AI_BASE_URL ||
    `https://api.scaleway.ai/${scwProjectId}/v1`;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'SCALEWAY_AI_API_KEY is not set' },
      { status: 500 },
    );
  }

  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in one short sentence.' },
        ],
        max_tokens: 32,
        temperature: 0.2,
        stream: false,
      }),
    });

    const text = await response.text();

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        endpoint: url,
        baseURL,
        raw: safeParseJson(text),
        rawText: text,
      },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: url,
        baseURL,
      },
      { status: 500 },
    );
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Test script to verify GPT-OSS streaming is working correctly
 *
 * Usage:
 *   BERGET_AI_API_KEY=sk-... node scripts/test-gpt-oss-streaming.mjs
 */

const API_KEY = process.env.BERGET_AI_API_KEY || process.env.BERGET_API_KEY;

if (!API_KEY) {
  console.error('Missing BERGET_AI_API_KEY environment variable');
  process.exit(1);
}

const url = 'https://api.berget.ai/v1/chat/completions';
const model = 'openai/gpt-oss-120b';

const body = {
  model,
  messages: [
    {
      role: 'user',
      content: 'Write one sentence and think step-by-step.',
    },
  ],
  stream: true,
};

console.log('Testing GPT-OSS streaming with Berget AI...');
console.log(`Model: ${model}`);
console.log(`Endpoint: ${url}`);
console.log('---');

let streamStartReceived = false;
let deltaCount = 0;
let finishReceived = false;
let hasTextDelta = false;
let hasReasoningDelta = false;
let fullResponse = '';

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}\n${errorText}`,
    );
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const chunk = JSON.parse(jsonStr);

        // Check for stream start
        if (chunk.type === 'stream-start') {
          streamStartReceived = true;
          console.log('✓ Received stream-start');
        }

        // Check for deltas
        if (chunk.choices && chunk.choices.length > 0) {
          const delta = chunk.choices[0].delta;

          if (delta) {
            deltaCount++;

            if (delta.content) {
              hasTextDelta = true;
              fullResponse += delta.content;
              process.stdout.write(delta.content);
            }

            if (delta.reasoning_content) {
              hasReasoningDelta = true;
              console.log(`[REASONING] ${delta.reasoning_content}`);
            }
          }

          // Check for finish
          if (chunk.choices[0].finish_reason) {
            finishReceived = true;
            console.log(
              `\n✓ Received finish (reason: ${chunk.choices[0].finish_reason})`,
            );
          }
        }
      } catch (e) {
        console.error('Failed to parse SSE chunk:', trimmed);
      }
    }
  }

  console.log('\n---');
  console.log('Test Results:');
  console.log(`Stream start received: ${streamStartReceived ? '✓' : '✗'}`);
  console.log(`Delta count: ${deltaCount}`);
  console.log(`Text deltas received: ${hasTextDelta ? '✓' : '✗'}`);
  console.log(`Reasoning deltas received: ${hasReasoningDelta ? '✓' : '✗'}`);
  console.log(`Finish received: ${finishReceived ? '✓' : '✗'}`);

  console.log('\n---');
  if (deltaCount === 0 && finishReceived) {
    console.log(
      '❌ ISSUE REPRODUCED: Received finish without any deltas (the original bug)',
    );
    process.exit(1);
  } else if (deltaCount > 0 && hasTextDelta) {
    console.log(
      '✅ ISSUE RESOLVED: Stream is working correctly with proper deltas',
    );
    process.exit(0);
  } else {
    console.log('⚠️  UNCLEAR: Unexpected streaming behavior');
    console.log(`   Deltas: ${deltaCount}, Text: ${hasTextDelta}`);
    process.exit(2);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

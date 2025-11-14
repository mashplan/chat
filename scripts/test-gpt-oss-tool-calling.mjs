/*
  Test GPT-OSS 120B tool calling support
  
  This script verifies if Berget AI's GPT-OSS 120B endpoint accepts tool calls.
  Expected: HTTP 400 if tool calling is not supported
  Expected: HTTP 200 with tool_calls if tool calling is supported
  
  Usage:
    BERGET_AI_API_KEY=sk-... node scripts/test-gpt-oss-tool-calling.mjs
*/

const API_KEY = process.env.BERGET_AI_API_KEY || process.env.BERGET_API_KEY;
if (!API_KEY) {
  console.error('❌ Missing BERGET_AI_API_KEY environment variable');
  process.exit(1);
}

const MODEL = 'openai/gpt-oss-120b';
const URL = 'https://api.berget.ai/v1/chat/completions';

const messages = [
  {
    role: 'system',
    content:
      'You are a helpful assistant. If a tool can answer precisely (like weather), you MUST call it.',
  },
  {
    role: 'user',
    content:
      'What is the current weather in Stockholm, Sweden? Use a tool if available.',
  },
];

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather information for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and country, e.g. Stockholm, Sweden',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit',
        },
      },
      required: ['location'],
    },
  },
};

async function testWithoutTools() {
  console.log('\n📋 Test 1: Request WITHOUT tools (baseline)');
  console.log('─'.repeat(60));

  const body = {
    model: MODEL,
    messages,
    stream: false,
    temperature: 0,
  };

  try {
    const res = await fetch(URL, {
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

    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.status === 200) {
      console.log('✅ Request succeeded (expected)');
      const content = json?.choices?.[0]?.message?.content;
      if (content) {
        console.log(`Response preview: ${content.substring(0, 100)}...`);
      }
    } else {
      console.log('❌ Request failed');
      console.log('Response:', text.substring(0, 500));
    }

    return { status: res.status, success: res.status === 200 };
  } catch (error) {
    console.error('❌ Request error:', error.message);
    return { status: 0, success: false, error };
  }
}

async function testWithTools() {
  console.log('\n📋 Test 2: Request WITH tools (testing tool calling support)');
  console.log('─'.repeat(60));

  const body = {
    model: MODEL,
    messages,
    stream: false,
    temperature: 0,
    tools: [weatherTool],
    tool_choice: 'auto',
  };

  console.log('Request body:');
  console.log(JSON.stringify(body, null, 2));

  try {
    const res = await fetch(URL, {
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

    console.log(`\nStatus: ${res.status} ${res.statusText}`);

    if (res.status === 200) {
      console.log('✅ SUCCESS: Tool calling is SUPPORTED!');
      const toolCalls = json?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        console.log(`✅ Tool calls returned: ${toolCalls.length}`);
        console.log('Tool call details:');
        toolCalls.forEach((tc, i) => {
          console.log(
            `  ${i + 1}. ${tc.function?.name}(${JSON.stringify(tc.function?.arguments)})`,
          );
        });
      } else {
        console.log(
          '⚠️  No tool_calls in response (model may have chosen not to use tools)',
        );
        console.log(
          'Response message:',
          json?.choices?.[0]?.message?.content?.substring(0, 200),
        );
      }
      return { status: res.status, success: true, supportsTools: true };
    } else if (res.status === 400) {
      console.log('❌ FAILED: HTTP 400 Bad Request');
      console.log(
        'This indicates tool calling is NOT supported for GPT-OSS 120B',
      );
      const errorMsg = json?.error?.message || text.substring(0, 500);
      console.log('Error message:', errorMsg);
      return {
        status: res.status,
        success: false,
        supportsTools: false,
        error: errorMsg,
      };
    } else {
      console.log(`❌ Unexpected status: ${res.status}`);
      console.log('Response:', text.substring(0, 500));
      return {
        status: res.status,
        success: false,
        supportsTools: false,
        error: text,
      };
    }
  } catch (error) {
    console.error('❌ Request error:', error.message);
    return {
      status: 0,
      success: false,
      supportsTools: false,
      error: error.message,
    };
  }
}

async function compareWithWorkingModel() {
  console.log('\n📋 Test 3: Compare with DeepSeek R1 (known to support tools)');
  console.log('─'.repeat(60));

  const body = {
    model: 'unsloth/MAI-DS-R1-GGUF', // DeepSeek R1 - known to support tools
    messages,
    stream: false,
    temperature: 0,
    tools: [weatherTool],
    tool_choice: 'auto',
  };

  try {
    const res = await fetch(URL, {
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

    console.log(`Status: ${res.status} ${res.statusText}`);

    if (res.status === 200) {
      const toolCalls = json?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        console.log(
          `✅ DeepSeek R1 supports tools: ${toolCalls.length} tool call(s) returned`,
        );
        return true;
      } else {
        console.log('⚠️  DeepSeek R1 returned 200 but no tool_calls');
        return false;
      }
    } else {
      console.log(`❌ DeepSeek R1 returned ${res.status} (unexpected)`);
      return false;
    }
  } catch (error) {
    console.error('❌ Request error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing GPT-OSS 120B Tool Calling Support');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Endpoint: ${URL}`);
  console.log('='.repeat(60));

  // Test 1: Baseline (without tools)
  const baseline = await testWithoutTools();

  // Test 2: With tools (the critical test)
  const withTools = await testWithTools();

  // Test 3: Compare with working model
  const comparison = await compareWithWorkingModel();

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  console.log(
    `Baseline (no tools): ${baseline.success ? '✅' : '❌'} (${baseline.status})`,
  );
  console.log(
    `With tools: ${withTools.success ? '✅' : '❌'} (${withTools.status})`,
  );

  if (withTools.status === 400) {
    console.log(
      '\n❌ VERIFICATION: GPT-OSS 120B does NOT support tool calling',
    );
    console.log('   - Returns HTTP 400 when tools are sent');
    console.log('   - Manual fallback is still necessary');
    console.log('   - Support ticket should be filed/updated');
  } else if (withTools.status === 200 && withTools.supportsTools) {
    console.log('\n✅ VERIFICATION: GPT-OSS 120B DOES support tool calling!');
    console.log('   - Returns HTTP 200 with tool_calls');
    console.log('   - Manual fallback can be removed');
    console.log(
      '   - Update fallbackSearchIntentModels to remove GPT-OSS 120B',
    );
  } else if (withTools.status === 200 && !withTools.supportsTools) {
    console.log(
      '\n⚠️  VERIFICATION: GPT-OSS 120B accepts tools but may not use them',
    );
    console.log('   - Returns HTTP 200');
    console.log('   - No tool_calls in response (may need different prompt)');
    console.log('   - Further investigation needed');
  }

  if (comparison) {
    console.log(`\nComparison: DeepSeek R1 supports tools: ✅`);
  } else {
    console.log(`\nComparison: DeepSeek R1 test failed: ❌`);
  }

  console.log(`\n${'='.repeat(60)}`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

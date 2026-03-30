#!/usr/bin/env node
/**
 * LLM Prompt Enhancer
 * 
 * 接收一個 seed prompt，透過 MiniMax Text API (MiniMax-M2.7) 增強為更高品質的 prompt。
 * 系統提示詞融合 Senior Prompt Engineer 的專業原則。
 * 
 * 用法:
 *   node llm-enhancer.js "seed prompt text"
 *   echo '{"content":"seed text","theme":"theme name"}' | node llm-enhancer.js
 */

const axios = require('axios');

const API_BASE = 'https://api.minimax.io';
const TEXT_API = `${API_BASE}/v1/text/chatcompletion_v2`;
const MODEL = 'MiniMax-M2.7';

// Senior Prompt Engineer system prompt
const SYSTEM_PROMPT = `You are a Senior Prompt Engineer specializing in AI image generation prompts for MiniMax Image-01.
Your task is to enhance seed prompts into HIGH-QUALITY, production-ready image generation prompts.

## Golden Rules for Prompt Crafting

1. **Be Specific & Vivid**: Replace vague descriptions with concrete, sensory-rich details
   - Instead of "a person" → "a weathered 65-year-old craftsman in a denim apron, calloused hands carefully carving wood"
   - Instead of "a city" → "narrow Venetian backstreets at dusk, laundry hanging between pastel buildings, a lone motorino buzzes past"

2. **Layer Technical Photography/Cinematography Terms**:
   - Lighting: "golden hour side-lighting", "diffused overcast light", "high-key studio lighting", "cinematic rim light"
   - Composition: "rule of thirds", "foreground leading lines", "shallow depth of field with creamy bokeh", "Dutch angle"
   - Lens: "shot on 85mm f/1.4", "wide-angle 24mm", "medium format Hasselblad aesthetic"
   - Mood: "moody and introspective", "vibrant and energetic", "quietly melancholic"

3. **Preserve & Elevate the Core Concept**:
   - Keep the seed's intended subject, setting, and emotion
   - Add ONE unexpected creative twist if it fits naturally (e.g., "a cyberpunk twist on a Renaissance painting")
   - Never change the fundamental story or subject

4. **Prompt Length & Structure**:
   - Aim for 2-4 well-crafted sentences or 80-300 words
   - Use commas to separate descriptive clauses (follows English descriptive structure)
   - Avoid redundancy; each phrase should add new information
   - End with the most important visual anchor

5. **Style Consistency**:
   - If seed mentions "photorealistic" → maintain photographic quality
   - If seed mentions "anime" → maintain cel-shaded/illustrated quality
   - If seed mentions "cinematic" → include film terminology (lens, grain, color grade)

6. **Avoid Over-Generated Clichés**:
   - Skip: "stunningly beautiful", "breathtakingly", "incredibly detailed"
   - Use specific sensory details instead: "face creased by 40 years of sun exposure", "paint peeling in cobalt blue curls"

## Output Format
Return ONLY the enhanced prompt in English. No explanations, no quotes, no prefixes. Just the raw prompt text ready for image generation.`;

// ============ Call LLM ============
async function enhancePrompt({ seedPrompt, theme, apiKey, model = MODEL }) {
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is required for LLM enhancement');
  }

  const userMessage = seedPrompt
    ? `## Seed Prompt to Enhance\nTheme: ${theme || 'General'}\n\nSeed: "${seedPrompt}"\n\nPlease enhance this into a high-quality MiniMax Image-01 prompt following the guidelines above.`
    : `## Theme to Elaborate\nTheme: ${theme}\n\nCreate an original, vivid, and technically-detailed MiniMax Image-01 prompt for this theme. Follow all the guidelines above carefully.`;

  try {
    const response = await axios.post(
      TEXT_API,
      {
        model,
        messages: [
          { role: 'system', name: 'Senior Prompt Engineer', content: SYSTEM_PROMPT },
          { role: 'user', name: 'User', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 512,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    const { choices, base_resp } = response.data;

    if (base_resp && base_resp.status_code !== 0) {
      const errorMessages = {
        1002: 'Rate limit hit. Please retry later.',
        1004: 'Invalid API Key.',
        1008: 'Insufficient account balance.',
        2013: 'Invalid input parameters.',
        2049: 'Invalid API Key.',
      };
      throw new Error(`Text API Error ${base_resp.status_code}: ${errorMessages[base_resp.status_code] || base_resp.status_msg}`);
    }

    const enhanced = choices[0].message.content.trim();

    return {
      original: seedPrompt || theme,
      theme,
      enhanced,
      model,
      finish_reason: choices[0].finish_reason,
    };
  } catch (err) {
    if (err.response) {
      throw new Error(`HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

// ============ CLI Mode ============
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--batch') {
    // Batch mode
    const inputFile = args[1];
    if (!inputFile) {
      console.error('Usage: node llm-enhancer.js --batch <file.json>');
      process.exit(1);
    }
    const prompts = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.error('Error: MINIMAX_API_KEY environment variable is required');
      process.exit(1);
    }

    async function run() {
      const results = [];
      for (const p of prompts) {
        try {
          const result = await enhancePrompt({
            seedPrompt: p.content || p.prompt || p,
            theme: p.theme,
            apiKey,
          });
          console.log(`✅ Enhanced: ${result.enhanced.substring(0, 60)}...`);
          results.push(result);
        } catch (e) {
          console.error(`❌ Failed: ${e.message}`);
          results.push({ original: p.content || p, theme: p.theme, error: e.message });
        }
      }
      const outputFile = inputFile.replace('.json', '.enhanced.json');
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results → ${outputFile}`);
    }
    run();

  } else if (args[0] && !args[0].startsWith('--')) {
    // Single prompt mode: node llm-enhancer.js "your prompt here"
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.error('Error: MINIMAX_API_KEY environment variable is required');
      process.exit(1);
    }

    const model = (() => {
      const m = args.find(a => a.startsWith('--model='));
      return m ? m.split('=')[1] : 'MiniMax-M2.7';
    })();
    const promptText = args.filter(a => !a.startsWith('--')).join(' ');

    enhancePrompt({ seedPrompt: promptText, apiKey, model })
      .then(result => {
        console.log('\n✨ Enhanced Prompt:\n');
        console.log(result.enhanced);
        console.log(`\n(model: ${result.model}, ${result.finish_reason})`);
      })
      .catch(err => {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
      });

  } else {
    // Interactive/repl mode: reads JSON from stdin
    let input = '';
    process.stdin.on('data', d => input += d);
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input.trim());
        const apiKey = process.env.MINIMAX_API_KEY;
        if (!apiKey) {
          console.error('Error: MINIMAX_API_KEY is required');
          process.exit(1);
        }
        const model = data.model || 'MiniMax-M2.7';
        enhancePrompt({
          seedPrompt: data.content || data.prompt,
          theme: data.theme,
          apiKey,
          model,
        }).then(result => {
          console.log(JSON.stringify(result, null, 2));
        }).catch(err => {
          console.error(err.message);
          process.exit(1);
        });
      } catch (e) {
        console.error('Usage: echo \'{"content":"prompt","theme":"theme"}\' | node llm-enhancer.js');
        process.exit(1);
      }
    });
  }
}

module.exports = { enhancePrompt, MODEL, SYSTEM_PROMPT };

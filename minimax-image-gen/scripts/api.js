#!/usr/bin/env node
/**
 * MiniMax Image-01 API Wrapper
 * 用法:
 *   node api.js "prompt text" [--aspect 16:9] [--n 3] [--output json|text]
 *   MINIMAX_API_KEY=xxx node api.js "prompt" 
 */

const axios = require('axios');

const API_BASE = 'https://api.minimax.io/v1/image_generation';
const ASPECT_RATIOS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 1152, height: 864 },
  '3:2': { width: 1248, height: 832 },
  '2:3': { width: 832, height: 1248 },
  '3:4': { width: 864, height: 1152 },
  '9:16': { width: 720, height: 1280 },
  '21:9': { width: 1344, height: 576 },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const prompt = args.find(a => !a.startsWith('--')) || '';
  const aspect = (args.find(a => a.startsWith('--aspect=')) || '--aspect=1:1').split('=')[1];
  const n = parseInt((args.find(a => a.startsWith('--n=')) || '--n=1').split('=')[1], 10);
  const output = (args.find(a => a.startsWith('--output=')) || '--output=text').split('=')[1];
  const apiKey = process.env.MINIMAX_API_KEY || '';
  return { prompt, aspect, n, output, apiKey };
}

async function generateImage({ apiKey, prompt, aspectRatio = '1:1', n = 1, responseFormat = 'url', promptOptimizer = false }) {
  if (!apiKey) throw new Error('MINIMAX_API_KEY environment variable is required');
  if (!prompt) throw new Error('Prompt is required');
  if (prompt.length > 1500) throw new Error('Prompt exceeds 1500 character limit');

  const payload = {
    model: 'image-01',
    prompt,
    n: Math.min(Math.max(n, 1), 9),
    response_format: responseFormat,
    prompt_optimizer: promptOptimizer,
  };

  // Handle aspect ratio
  if (ASPECT_RATIOS[aspectRatio]) {
    payload.aspect_ratio = aspectRatio;
  } else {
    throw new Error(`Invalid aspect_ratio: ${aspectRatio}. Valid: ${Object.keys(ASPECT_RATIOS).join(', ')}`);
  }

  try {
    const response = await axios.post(API_BASE, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 60000,
    });

    const { data, metadata, id, base_resp } = response.data;

    if (base_resp && base_resp.status_code !== 0) {
      const errorMessages = {
        1002: 'Rate limit hit. Please retry later.',
        1004: 'Invalid API Key.',
        1008: 'Insufficient account balance.',
        1026: 'Sensitive content detected in prompt.',
        2013: 'Invalid parameters.',
        2049: 'Invalid API Key.',
      };
      throw new Error(`API Error ${base_resp.status_code}: ${errorMessages[base_resp.status_code] || base_resp.status_msg}`);
    }

    return {
      id,
      images: responseFormat === 'url' ? data.image_urls : data.image_base64,
      successCount: metadata.success_count,
      failedCount: metadata.failed_count,
      aspectRatio,
      promptLength: prompt.length,
    };
  } catch (err) {
    if (err.response) {
      throw new Error(`HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

// CLI mode
if (require.main === module) {
  const { prompt, aspect, n, output, apiKey } = parseArgs();

  if (!prompt) {
    console.error('Usage: node api.js "prompt text" [--aspect=16:9] [--n=3] [--output=json|text]');
    console.error('Required env: MINIMAX_API_KEY');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: MINIMAX_API_KEY environment variable is required');
    process.exit(1);
  }

  generateImage({ apiKey, prompt, aspectRatio: aspect, n, responseFormat: 'url' })
    .then(result => {
      if (output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`✅ Generated ${result.successCount} image(s) (ID: ${result.id})\n`);
        result.images.forEach((url, i) => {
          console.log(`  [${i + 1}] ${url}`);
        });
      }
    })
    .catch(err => {
      console.error(`❌ Error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { generateImage, ASPECT_RATIOS };

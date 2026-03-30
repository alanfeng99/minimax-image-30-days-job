#!/usr/bin/env node
/**
 * Daily Prompt Scheduler — LLM-Enhanced Version
 * 
 * 流程:
 *   1. 程式生成 seed prompts (from 30 themes)
 *   2. LLM (MiniMax-M2.7) 增強每個 seed → 高品質 prompt
 *   3. Senior Prompt Engineer Review (規則型) 把關
 *   4. 寫入 approved.json
 * 
 * 用法:
 *   node scheduler.js [--date YYYY-MM-DD] [--dry-run] [--count 50] [--no-llm]
 * 
 * 環境變數:
 *   MINIMAX_API_KEY  — 文字+圖片 API Key（同一組）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { evaluatePrompt } = require('./senior-reviewer');

// ============ Configuration ============
const CONFIG = {
  daily_prompt_count: 50,
  review_threshold: 7.0,
  safety_veto: true,
  output_daily: true,
  output_append_approved: true,
  llm_batch_size: 5,        // 每批 LLM 呼叫數
  llm_delay_ms: 200,        // LLM 呼叫間隔（防速率限制）
  llm_temperature: 0.8,
};

const BASE_DIR = path.join(__dirname, '..');
const THEMES_FILE = path.join(BASE_DIR, 'references', 'themes.json');
const PROMPTS_DIR = path.join(BASE_DIR, 'references', 'prompts');
const DAILY_DIR = path.join(PROMPTS_DIR, 'daily');

// ============ Load Themes ============
function loadThemes() {
  if (!fs.existsSync(THEMES_FILE)) {
    throw new Error(`Themes file not found: ${THEMES_FILE}\nRun theme-generator.js first.`);
  }
  return JSON.parse(fs.readFileSync(THEMES_FILE, 'utf8'));
}

// ============ API Key Check ============
function checkApiKey() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey || apiKey === 'YOUR_TOKEN_PLAN_API_KEY_HERE') {
    return false;
  }
  return true;
}

function getApiKey() {
  return process.env.MINIMAX_API_KEY || '';
}

// ============ MiniMax Text API (LLM Enhancement) ============
const TEXT_API = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const LLM_MODEL = 'MiniMax-M2.7';

const LLM_SYSTEM_PROMPT = `You are a Senior Prompt Engineer specializing in AI image generation prompts for MiniMax Image-01.
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
   - Add ONE unexpected creative twist if it fits naturally
   - Never change the fundamental story or subject

4. **Prompt Length & Structure**:
   - Aim for 2-4 well-crafted sentences or 80-250 words
   - Use commas to separate descriptive clauses
   - End with the most important visual anchor

5. **Style Consistency**:
   - If seed mentions "photorealistic" → maintain photographic quality
   - If seed mentions "anime" → maintain cel-shaded/illustrated quality
   - If seed mentions "cinematic" → include film terminology

6. **Avoid Over-Generated Clichés**:
   - Skip: "stunningly beautiful", "breathtakingly", "incredibly detailed"
   - Use specific sensory details instead

## Output Format
Return ONLY the enhanced prompt in English. No explanations, no quotes, no prefixes. Just the raw prompt text ready for image generation.`;

const axios = require('axios');

async function enhanceWithLLM({ seedPrompt, theme, apiKey }) {
  const userMessage = `## Seed Prompt to Enhance
Theme: ${theme || 'General'}

Seed: "${seedPrompt}"

Please enhance this into a high-quality MiniMax Image-01 prompt following all guidelines above.
Return ONLY the enhanced prompt text — nothing else.`;

  const response = await axios.post(
    TEXT_API,
    {
      model: LLM_MODEL,
      messages: [
        { role: 'system', name: 'Senior Prompt Engineer', content: LLM_SYSTEM_PROMPT },
        { role: 'user', name: 'User', content: userMessage },
      ],
      temperature: CONFIG.llm_temperature,
      max_tokens: 400,
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
      1002: 'Rate limit. Will retry.',
      1004: 'Invalid API Key.',
      1008: 'Insufficient balance.',
      2013: 'Invalid parameters.',
      2049: 'Invalid API Key.',
    };
    throw new Error(`LLM API Error ${base_resp.status_code}: ${errorMessages[base_resp.status_code] || base_resp.status_msg}`);
  }

  return choices[0].message.content.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Prompt Generation (Stage 1) ============

/**
 * 生成一個符合指定主題的 seed prompt 變體
 */
function generatePromptVariant(theme, seed) {
  const { example_prompts, aspect_ratios, tags } = theme;
  const base = example_prompts[seed % example_prompts.length];

  const lightingVariants = [
    'golden hour', 'blue hour', 'soft diffused daylight', 'dramatic rim lighting',
    'moody overcast', 'high key studio', 'low key cinematic', 'warm tungsten',
    'cool moonlight', 'volumetric fog light', 'anamorphic lens flare',
  ];
  const compositionVariants = [
    'wide angle', 'telephoto compression', 'tilt-shift effect', 'dutch angle',
    'symmetrical composition', 'rule of thirds', 'centered', 'foreground leading lines',
    'shallow depth of field', 'deep focus', 'extreme close-up', 'establishing wide shot',
  ];
  const styleVariants = [
    'film grain', 'digital clean', 'vintage Kodak portra', 'cinematic color grade',
    'high contrast mono', 'desaturated', 'cross-processed', 'infrared effect',
    'shot on Canon 5D Mark IV', 'medium format Hasselblad', '35mm cinema lens',
  ];
  const vibeVariants = [
    'peaceful atmosphere', 'tense mood', 'mysterious vibe', 'nostalgic feeling',
    'futuristic aesthetic', 'raw documentary feel', 'editorial elegance', 'gritty realism',
  ];

  const s = seed * 17 + theme.id * 31;
  const pick = (arr, offset = 0) => arr[(s + offset) % arr.length];

  let prompt;
  if (seed % 3 === 0) {
    prompt = base + `, ${pick(lightingVariants)}, ${pick(compositionVariants)}, ${pick(styleVariants)}`;
  } else if (seed % 3 === 1) {
    const baseParts = base.split(',').map(p => p.trim());
    const lastPart = baseParts[baseParts.length - 1];
    prompt = baseParts.slice(0, -1).join(', ') +
      `, ${pick(lightingVariants)}, ${lastPart}, ${pick(styleVariants)}, ${pick(vibeVariants)}`;
  } else {
    prompt = `${pick(vibeVariants)} scene, ${base}, ${pick(lightingVariants)}, ${pick(compositionVariants)}`;
  }

  if (prompt.length > 1500) {
    prompt = prompt.substring(0, 1497) + '...';
  }

  return {
    seed_content: prompt,
    theme: theme.theme,
    theme_id: theme.id,
    aspect_ratio: aspect_ratios[s % aspect_ratios.length],
    tags,
    seed,
  };
}

/**
 * 生成 N 個隨機 seed prompts
 */
function generateDailySeeds(themes, count = 50) {
  const prompts = [];
  const usedSeeds = new Set();
  const weights = themes.map(t =>
    t.tags.some(tag => ['vintage', 'surreal', 'sci-fi', 'steampunk'].includes(tag)) ? 1.5 : 1
  );

  const baseCountPerTheme = Math.floor(count / themes.length);
  let remaining = count;

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const myCount = (i === themes.length - 1) ? remaining : Math.max(1, Math.round(baseCountPerTheme * weights[i]));

    for (let j = 0; j < myCount && prompts.length < count; j++) {
      let seed;
      do { seed = Math.floor(Math.random() * 100000); } while (usedSeeds.has(seed));
      usedSeeds.add(seed);
      prompts.push(generatePromptVariant(theme, seed));
      remaining--;
    }
  }

  // Shuffle
  for (let i = prompts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [prompts[i], prompts[j]] = [prompts[j], prompts[i]];
  }

  return prompts;
}

// ============ Main Scheduler ============
async function runDailyScheduler({ date, dryRun = false, count = CONFIG.daily_prompt_count, useLLM = true }) {
  const runDate = date || new Date().toISOString().split('T')[0];
  const hasApiKey = checkApiKey();
  const apiKey = getApiKey();

  console.log(`\n🚀 Daily Prompt Scheduler — ${runDate}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | LLM: ${useLLM && hasApiKey ? '✅ ON (MiniMax-M2.7)' : '❌ OFF (rule-based only)'}`);
  console.log(`   Config: ${count} prompts, threshold ${CONFIG.review_threshold}\n`);

  if (!hasApiKey) {
    console.warn('⚠️  MINIMAX_API_KEY not set. LLM enhancement disabled.');
    console.warn('   Set via: export MINIMAX_API_KEY="your Token Plan key"');
    console.warn('   Get key: https://platform.minimax.io/user-center/basic-information/interface-key\n');
  }

  // Stage 1: Generate seed prompts
  const themes = loadThemes();
  console.log(`📚 Loaded ${themes.length} themes`);
  const seeds = generateDailySeeds(themes, count);
  console.log(`✍️  Stage 1: Generated ${seeds.length} seed prompts`);

  // Stage 2: LLM Enhancement
  let enhancedPrompts = seeds;

  if (useLLM && hasApiKey) {
    console.log(`\n🤖 Stage 2: LLM Enhancement (MiniMax-M2.7)...`);
    enhancedPrompts = [];

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const progress = `[${i + 1}/${seeds.length}]`;

      try {
        const enhanced = await enhanceWithLLM({
          seedPrompt: seed.seed_content,
          theme: seed.theme,
          apiKey,
        });

        // Check if LLM returned something useful
        if (enhanced && enhanced.length > 10) {
          enhancedPrompts.push({
            ...seed,
            content: enhanced,
            llm_enhanced: true,
            seed_content: seed.seed_content,
          });
          process.stdout.write(`  ${progress} ✅ "${enhanced.substring(0, 50)}..."\n`);
        } else {
          // LLM returned garbage, fall back to seed
          enhancedPrompts.push({
            ...seed,
            content: seed.seed_content,
            llm_enhanced: false,
          });
          process.stdout.write(`  ${progress} ⚠️  LLM empty, used seed\n`);
        }
      } catch (err) {
        // On LLM error, fall back to seed
        enhancedPrompts.push({
          ...seed,
          content: seed.seed_content,
          llm_enhanced: false,
          llm_error: err.message,
        });
        process.stdout.write(`  ${progress} ⚠️  LLM failed: ${err.message.substring(0, 50)}, used seed\n`);
      }

      // Rate limit delay (but not on last item)
      if (i < seeds.length - 1 && CONFIG.llm_delay_ms > 0) {
        await sleep(CONFIG.llm_delay_ms);
      }
    }

    const llmSuccessCount = enhancedPrompts.filter(p => p.llm_enhanced).length;
    console.log(`\n   🤖 LLM Enhanced: ${llmSuccessCount}/${seeds.length} (${((llmSuccessCount / seeds.length) * 100).toFixed(0)}%)`);
  } else {
    // No LLM — just use seed prompts
    enhancedPrompts = seeds.map(s => ({
      ...s,
      content: s.seed_content,
      llm_enhanced: false,
    }));
    console.log(`\n🤖 Stage 2: Skipped (LLM disabled or no API key — using seed prompts)`);
  }

  // Stage 3: Senior Prompt Engineer Review
  console.log(`\n🔍 Stage 3: Senior Prompt Engineer Review...`);
  const reviewed = enhancedPrompts.map(p => evaluatePrompt(p));

  const approved = reviewed.filter(r => r.review.passed);
  const rejected = reviewed.filter(r => !r.review.passed);

  const llmApproved = approved.filter(r => r.llm_enhanced).length;
  const seedApproved = approved.filter(r => !r.llm_enhanced).length;

  console.log(`\n📊 Review Results:`);
  console.log(`   ✅ Approved:  ${approved.length} (${((approved.length / reviewed.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Rejected: ${rejected.length} (${((rejected.length / reviewed.length) * 100).toFixed(1)}%)`);
  if (approved.length > 0) {
    const avgScore = approved.reduce((s, r) => s + r.review.final_score, 0) / approved.length;
    console.log(`   📈 Avg approved score: ${avgScore.toFixed(2)}/10`);
    if (useLLM && hasApiKey) {
      console.log(`   🤖 LLM-enhanced: ${llmApproved} | Seed-only: ${seedApproved}`);
    }
  }

  const scoreBuckets = { '9-10': 0, '7-8': 0, '5-6': 0, '3-4': 0, '0-2': 0 };
  reviewed.forEach(r => {
    const s = r.review.final_score;
    if (s >= 9) scoreBuckets['9-10']++;
    else if (s >= 7) scoreBuckets['7-8']++;
    else if (s >= 5) scoreBuckets['5-6']++;
    else if (s >= 3) scoreBuckets['3-4']++;
    else scoreBuckets['0-2']++;
  });
  console.log(`\n📊 Score Distribution:`);
  Object.entries(scoreBuckets).forEach(([bucket, cnt]) => {
    const pct = ((cnt / reviewed.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(cnt / 2)) + '░'.repeat(Math.round((reviewed.length - cnt) / 2));
    console.log(`   ${bucket.padEnd(5)} ${bar} ${cnt} (${pct}%)`);
  });

  if (dryRun) {
    console.log(`\n⚠️  Dry run — no files written`);
    console.log(`\nSample approved prompts:`);
    approved.slice(0, 3).forEach((p, i) => {
      const src = p.llm_enhanced ? '🤖 LLM' : '🌱 Seed';
      console.log(`\n  [${i + 1}] ${src} (${p.review.final_score}/10) — ${p.theme}`);
      console.log(`      ${p.content.substring(0, 120)}...`);
    });
    return { approved, rejected, reviewed };
  }

  // ========== Write Files ==========
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString();

  const dailyFile = path.join(DAILY_DIR, `${runDate}.json`);
  const dailyReport = {
    date: runDate,
    generated_at: timestamp,
    config: { count, threshold: CONFIG.review_threshold, llm_enhanced: useLLM && hasApiKey },
    summary: {
      total: reviewed.length,
      approved: approved.length,
      rejected: rejected.length,
      pass_rate: parseFloat(((approved.length / reviewed.length) * 100).toFixed(1)),
      avg_score: approved.length > 0
        ? parseFloat((approved.reduce((s, r) => s + r.review.final_score, 0) / approved.length).toFixed(2))
        : 0,
      llm_enhanced_count: llmApproved,
      seed_only_count: seedApproved,
    },
    approved,
    rejected: rejected.map(r => ({ ...r, review: { ...r.review, content: r.content } })),
  };
  fs.writeFileSync(dailyFile, JSON.stringify(dailyReport, null, 2), 'utf8');
  console.log(`\n💾 Daily report → ${dailyFile}`);

  // Cumulative approved
  const approvedFile = path.join(PROMPTS_DIR, 'approved.json');
  let existingApproved = [];
  if (fs.existsSync(approvedFile)) {
    try { existingApproved = JSON.parse(fs.readFileSync(approvedFile, 'utf8')); } catch (e) {}
  }

  const newApproved = approved.map(p => ({
    ...p,
    approved_date: runDate,
    approved_at: timestamp,
  }));

  const existingHashes = new Set(existingApproved.map(p =>
    crypto.createHash('md5').update(p.content).digest('hex')
  ));
  const trulyNew = newApproved.filter(p =>
    !existingHashes.has(crypto.createHash('md5').update(p.content).digest('hex'))
  );

  const mergedApproved = [...existingApproved, ...trulyNew];
  fs.writeFileSync(approvedFile, JSON.stringify(mergedApproved, null, 2), 'utf8');
  console.log(`💾 Approved (cumulative) → ${approvedFile} (${mergedApproved.length} total, +${trulyNew.length} new)`);

  // Cumulative rejected
  const rejectedFile = path.join(PROMPTS_DIR, 'rejected.json');
  let existingRejected = [];
  if (fs.existsSync(rejectedFile)) {
    try { existingRejected = JSON.parse(fs.readFileSync(rejectedFile, 'utf8')); } catch (e) {}
  }
  const newRejected = rejected.map(r => ({
    ...r,
    rejected_date: runDate,
    rejected_at: timestamp,
  }));
  const mergedRejected = [...existingRejected, ...newRejected];
  fs.writeFileSync(rejectedFile, JSON.stringify(mergedRejected, null, 2), 'utf8');
  console.log(`💾 Rejected (cumulative) → ${rejectedFile} (${mergedRejected.length} total)`);

  // Stats
  const statsFile = path.join(PROMPTS_DIR, 'stats.json');
  const stats = {
    last_updated: timestamp,
    total_approved: mergedApproved.length,
    total_rejected: mergedRejected.length,
    last_run: {
      date: runDate,
      approved: approved.length,
      rejected: rejected.length,
      pass_rate: parseFloat(((approved.length / reviewed.length) * 100).toFixed(1)),
      avg_score: approved.length > 0
        ? parseFloat((approved.reduce((s, r) => s + r.review.final_score, 0) / approved.length).toFixed(2))
        : 0,
    },
  };
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf8');

  console.log(`\n✅ Scheduler complete.`);
  return { approved, rejected, reviewed };
}

// ============ CLI ============
if (require.main === module) {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  const dryRun = args.includes('--dry-run');
  const countArg = args.find(a => a.startsWith('--count='));
  const noLLM = args.includes('--no-llm');

  const date = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : CONFIG.daily_prompt_count;

  runDailyScheduler({ date, dryRun, count, useLLM: !noLLM })
    .catch(err => {
      console.error('❌ Scheduler error:', err.message);
      process.exit(1);
    });
}

module.exports = { runDailyScheduler, generateDailySeeds, generatePromptVariant };

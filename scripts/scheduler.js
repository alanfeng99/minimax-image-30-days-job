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
  llm_concurrency: 10,       // 並行 LLM 呼叫數
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

const LLM_SYSTEM_PROMPT = `You are a Senior Prompt Engineer. Enhance seed prompts into vivid, specific, detailed image prompts. Add lighting/composition/style terms. Preserve core subject. Avoid clichés. Output ONLY the enhanced prompt.`;

const axios = require('axios');

async function enhanceWithLLM({ seedPrompt, theme, apiKey, model = LLM_MODEL }) {
  const userMessage = `Theme: ${theme || 'General'}\nSeed: "${seedPrompt}"\n\nEnhance into a vivid, detailed image prompt. Return ONLY the result.`;

  const response = await axios.post(
    TEXT_API,
    {
      model,
      messages: [
        { role: 'system', name: 'Senior Prompt Engineer', content: LLM_SYSTEM_PROMPT },
        { role: 'user', name: 'User', content: userMessage },
      ],
      temperature: CONFIG.llm_temperature,
      max_tokens: 600,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 60000,
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

// sleep removed — using parallel LLM calls

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
 * 生成 N 個隨機 seed prompts，均匀分配給各主題
 */
function generateDailySeeds(themes, count = 50) {
  const prompts = [];
  const usedSeeds = new Set();

  // 計算加權配額
  const weights = themes.map(t =>
    t.tags.some(tag => ['vintage', 'surreal', 'sci-fi', 'steampunk'].includes(tag)) ? 1.5 : 1
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // 分配：每主題基礎配額 + 剩餘隨機分發
  const baseQuota = themes.map((_, i) => Math.floor((weights[i] / totalWeight) * count));
  let remainder = count - baseQuota.reduce((a, b) => a + b, 0);

  // 隨機分配多餘名額（避免某主題總是被眷顧）
  const pool = [];
  themes.forEach((_, i) => {
    for (let k = 0; k < baseQuota[i]; k++) pool.push(i);
  });
  while (remainder > 0) {
    pool.push(themes[Math.floor(Math.random() * themes.length)].id - 1);
    remainder--;
  }

  const quota = new Array(themes.length).fill(0);
  for (const i of pool) quota[i]++;

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    for (let j = 0; j < quota[i]; j++) {
      let seed;
      do { seed = Math.floor(Math.random() * 100000); } while (usedSeeds.has(seed));
      usedSeeds.add(seed);
      prompts.push(generatePromptVariant(theme, seed));
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
async function runDailyScheduler({ date, dryRun = false, count = CONFIG.daily_prompt_count, useLLM = true, model = LLM_MODEL }) {
  const runDate = date || new Date().toISOString().split('T')[0];
  const hasApiKey = checkApiKey();
  const apiKey = getApiKey();

  console.log(`\n🚀 Daily Prompt Scheduler — ${runDate}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | LLM: ${useLLM && hasApiKey ? `✅ ON (${model})` : '❌ OFF (rule-based only)'}`);
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

  // ============ Concurrency helper ============
  async function asyncPool(concurrency, items, fn) {
    const results = [];
    let active = 0;
    let idx = 0;
    return new Promise(resolve => {
      function start() {
        while (active < concurrency && idx < items.length) {
          const i = idx++;
          const item = items[i];
          active++;
          fn(item, i).then(result => {
            results[i] = result;
            active--;
            start();
          }).catch(err => {
            results[i] = { error: err.message };
            active--;
            start();
          });
        }
        if (active === 0) resolve(results);
      }
      start();
    });
  }

  // Stage 2: LLM Enhancement (parallel)
  if (useLLM && hasApiKey) {
    console.log(`\n🤖 Stage 2: LLM Enhancement (${model}, ${CONFIG.llm_concurrency} parallel)...`);

    const results = await asyncPool(CONFIG.llm_concurrency, seeds, async (seed, i) => {
      const progress = `[${i + 1}/${seeds.length}]`;
      try {
        const enhanced = await enhanceWithLLM({
          seedPrompt: seed.seed_content,
          theme: seed.theme,
          apiKey,
          model,
        });
        if (enhanced && enhanced.length > 10) {
          process.stdout.write(`  ${progress} ✅\n`);
          return { ...seed, content: enhanced, llm_enhanced: true, seed_content: seed.seed_content };
        } else {
          process.stdout.write(`  ${progress} ⚠️  empty\n`);
          return { ...seed, content: seed.seed_content, llm_enhanced: false };
        }
      } catch (err) {
        process.stdout.write(`  ${progress} ⚠️  ${err.message.substring(0, 40)}\n`);
        return { ...seed, content: seed.seed_content, llm_enhanced: false, llm_error: err.message };
      }
    });

    enhancedPrompts = results;
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
  const countArg = args.find(a => a.startsWith('--count=')) || args.find(a => a === '--count');
  const noLLM = args.includes('--no-llm');
  const modelArg = args.find(a => a.startsWith('--model='));

  const date = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];
  const countRaw = countArg ? (countArg.includes('=') ? countArg.split('=')[1] : args[args.indexOf(countArg) + 1]) : CONFIG.daily_prompt_count;
  const count = parseInt(countRaw, 10);
  const model = modelArg ? modelArg.split('=')[1] : LLM_MODEL;

  runDailyScheduler({ date, dryRun, count, useLLM: !noLLM, model })
    .catch(err => {
      console.error('❌ Scheduler error:', err.message);
      process.exit(1);
    });
}

module.exports = { runDailyScheduler, generateDailySeeds, generatePromptVariant };

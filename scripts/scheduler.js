#!/usr/bin/env node
/**
 * Daily Prompt Scheduler
 * 
 * 每日從 30 主題庫中隨機生成 50 個 prompts，經 Senior Reviewer 審查後寫入 approved.json
 * 
 * 用法:
 *   node scheduler.js [--date YYYY-MM-DD] [--dry-run] [--count 50]
 * 
 * 排程建議: 透過 OpenClaw HEARTBEAT.md 每日執行一次
 */

const fs = require('fs');
const path = require('path');
const { evaluatePrompt } = require('./senior-reviewer');

// ============ Configuration ============
const CONFIG = {
  daily_prompt_count: 50,
  review_threshold: 7.0,
  safety_veto: true,
  output_daily: true,
  output_append_approved: true,
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
    console.warn('⚠️  MINIMAX_API_KEY not set. Set it via: export MINIMAX_API_KEY="your Token Plan key"');
    console.warn('   Get your key at: https://platform.minimax.io/user-center/basic-information/interface-key');
    // Don't exit — scheduler can still generate prompts without calling the API
    return false;
  }
  return true;
}

// ============ Prompt Generation ============

/**
 * 生成一個符合指定主題的 prompt 變體
 * 每次調用产生不同角度/光線/風格的變化
 */
function generatePromptVariant(theme, seed) {
  const { example_prompts, aspect_ratios, tags } = theme;
  
  // 從主題的 example_prompts 中選擇一個作為基底
  const base = example_prompts[seed % example_prompts.length];
  
  // 變化修飾詞
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

  // Seeding for reproducibility
  const s = seed * 17 + theme.id * 31;
  
  const pick = (arr, offset = 0) => arr[(s + offset) % arr.length];
  
  // 建構最終 prompt
  const baseParts = base.split(',').map(p => p.trim());
  
  // 注入變化：置換或新增元素
  let prompt;
  if (seed % 3 === 0) {
    // 模式1: 在結尾追加變化修飾
    prompt = base + `, ${pick(lightingVariants)}, ${pick(compositionVariants)}, ${pick(styleVariants)}`;
  } else if (seed % 3 === 1) {
    // 模式2: 置換最後一個描述片段，加入新語境
    const lastPart = baseParts[baseParts.length - 1];
    prompt = baseParts.slice(0, -1).join(', ') + 
      `, ${pick(lightingVariants)}, ${lastPart}, ${pick(styleVariants)}, ${pick(vibeVariants)}`;
  } else {
    // 模式3: 前綴強調+原始風格
    prompt = `${pick(vibeVariants)} scene, ${base}, ${pick(lightingVariants)}, ${pick(compositionVariants)}`;
  }

  // 截斷至 1500 字元
  if (prompt.length > 1500) {
    prompt = prompt.substring(0, 1497) + '...';
  }

  return {
    content: prompt,
    theme: theme.theme,
    theme_id: theme.id,
    aspect_ratio: aspect_ratios[s % aspect_ratios.length],
    tags,
    seed,
  };
}

/**
 * 生成 50 個隨機 prompts，確保多樣性
 */
function generateDailyPrompts(themes, count = 50) {
  const prompts = [];
  const usedSeeds = new Set();

  // 簡單加權：每個主題至少貢獻 1 個，多的根據權重分配
  const weights = themes.map(t => {
    // 稀有標籤加權
    const rareBoost = t.tags.some(tag => ['vintage', 'surreal', 'sci-fi', 'steampunk'].includes(tag)) ? 1.5 : 1;
    return rareBoost;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // 每個主題分配數量
  const baseCountPerTheme = Math.floor(count / themes.length);
  let remaining = count;

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    // 最後一個主題拿完剩餘配額
    const myCount = (i === themes.length - 1) ? remaining : Math.max(1, Math.round(baseCountPerTheme * weights[i]));
    
    for (let j = 0; j < myCount && prompts.length < count; j++) {
      let seed;
      do {
        seed = Math.floor(Math.random() * 100000);
      } while (usedSeeds.has(seed));
      usedSeeds.add(seed);

      const prompt = generatePromptVariant(theme, seed);
      prompts.push(prompt);
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

// ============ Daily Run ============
async function runDailyScheduler({ date, dryRun = false, count = CONFIG.daily_prompt_count }) {
  const runDate = date || new Date().toISOString().split('T')[0];
  checkApiKey(); // Warns if key not set
  console.log(`\n🚀 Daily Prompt Scheduler — ${runDate}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no files written)' : 'LIVE'}`);
  console.log(`   Config: ${count} prompts, threshold ${CONFIG.review_threshold}\n`);

  // Load themes
  const themes = loadThemes();
  console.log(`📚 Loaded ${themes.length} themes`);

  // Generate prompts
  const rawPrompts = generateDailyPrompts(themes, count);
  console.log(`✍️  Generated ${rawPrompts.length} raw prompts`);

  // Senior Review
  console.log(`\n🔍 Running Senior Prompt Engineer Review...`);
  const reviewed = rawPrompts.map(p => evaluatePrompt(p));

  const approved = reviewed.filter(r => r.review.passed);
  const rejected = reviewed.filter(r => !r.review.passed);

  console.log(`\n📊 Review Results:`);
  console.log(`   ✅ Approved:  ${approved.length} (${((approved.length / reviewed.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Rejected: ${rejected.length} (${((rejected.length / reviewed.length) * 100).toFixed(1)}%)`);
  
  if (approved.length > 0) {
    const avgScore = approved.reduce((s, r) => s + r.review.final_score, 0) / approved.length;
    console.log(`   📈 Avg approved score: ${avgScore.toFixed(2)}/10`);
  }

  // Score distribution
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
  Object.entries(scoreBuckets).forEach(([bucket, count]) => {
    const pct = ((count / reviewed.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(count / 2)) + '░'.repeat(Math.round((reviewed.length - count) / 2));
    console.log(`   ${bucket.padEnd(5)} ${bar} ${count} (${pct}%)`);
  });

  if (dryRun) {
    console.log(`\n⚠️  Dry run — no files written`);
    console.log(`\nSample approved prompts:`);
    approved.slice(0, 3).forEach((p, i) => {
      console.log(`\n  [${i + 1}] (${p.review.final_score}/10) — ${p.theme}`);
      console.log(`      ${p.content.substring(0, 120)}...`);
    });
    return { approved, rejected, reviewed };
  }

  // ========== Write Files ==========
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString();

  // 1. Daily file
  const dailyFile = path.join(DAILY_DIR, `${runDate}.json`);
  const dailyReport = {
    date: runDate,
    generated_at: timestamp,
    config: { count, threshold: CONFIG.review_threshold },
    summary: {
      total: reviewed.length,
      approved: approved.length,
      rejected: rejected.length,
      pass_rate: parseFloat(((approved.length / reviewed.length) * 100).toFixed(1)),
      avg_score: approved.length > 0 
        ? parseFloat((approved.reduce((s, r) => s + r.review.final_score, 0) / approved.length).toFixed(2))
        : 0,
    },
    approved,
    rejected: rejected.map(r => ({ ...r, review: { ...r.review, content: r.content } })),
  };
  fs.writeFileSync(dailyFile, JSON.stringify(dailyReport, null, 2), 'utf8');
  console.log(`\n💾 Daily report → ${dailyFile}`);

  // 2. Append to cumulative approved.json
  const approvedFile = path.join(PROMPTS_DIR, 'approved.json');
  let existingApproved = [];
  if (fs.existsSync(approvedFile)) {
    try {
      existingApproved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
    } catch (e) {
      existingApproved = [];
    }
  }

  const newApproved = approved.map(p => ({
    ...p,
    approved_date: runDate,
    approved_at: timestamp,
  }));

  // Merge (avoid exact duplicates by content hash)
  const existingHashes = new Set(existingApproved.map(p => 
    require('crypto').createHash('md5').update(p.content).digest('hex')
  ));
  const trulyNew = newApproved.filter(p => 
    !existingHashes.has(require('crypto').createHash('md5').update(p.content).digest('hex'))
  );

  const mergedApproved = [...existingApproved, ...trulyNew];
  fs.writeFileSync(approvedFile, JSON.stringify(mergedApproved, null, 2), 'utf8');
  console.log(`💾 Approved (cumulative) → ${approvedFile} (${mergedApproved.length} total, +${trulyNew.length} new)`);

  // 3. Rejected cumulative
  const rejectedFile = path.join(PROMPTS_DIR, 'rejected.json');
  let existingRejected = [];
  if (fs.existsSync(rejectedFile)) {
    try {
      existingRejected = JSON.parse(fs.readFileSync(rejectedFile, 'utf8'));
    } catch (e) {
      existingRejected = [];
    }
  }
  const newRejected = rejected.map(r => ({
    ...r,
    rejected_date: runDate,
    rejected_at: timestamp,
  }));
  const mergedRejected = [...existingRejected, ...newRejected];
  fs.writeFileSync(rejectedFile, JSON.stringify(mergedRejected, null, 2), 'utf8');
  console.log(`💾 Rejected (cumulative) → ${rejectedFile} (${mergedRejected.length} total)`);

  // 4. Stats
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

  console.log(`\n✅ Scheduler complete. Total approved prompts: ${mergedApproved.length}`);
  return { approved, rejected, reviewed };
}

// ============ CLI ============
if (require.main === module) {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  const dryRun = args.includes('--dry-run');
  const countArg = args.find(a => a.startsWith('--count='));

  const date = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : CONFIG.daily_prompt_count;

  runDailyScheduler({ date, dryRun, count })
    .catch(err => {
      console.error('❌ Scheduler error:', err.message);
      process.exit(1);
    });
}

module.exports = { runDailyScheduler, generateDailyPrompts, generatePromptVariant };

#!/usr/bin/env node
/**
 * Senior Prompt Engineer Reviewer
 * 
 * 對給定的 raw prompts 進行六維度評分審查：
 *   Clarity / Specificity / Technical / Safety / Creativity / Fluency
 * 
 * 用法:
 *   node senior-reviewer.js '{"content": "prompt text", "theme": "theme name"}'
 *   echo '{"content": "..."}' | node senior-reviewer.js
 *   node senior-reviewer.js --batch ../references/prompts/pending.json
 */

const fs = require('fs');
const path = require('path');

// 敏感詞列表（觸發 Safety = 0 否決）
const SENSITIVE_PATTERNS = [
  /nazi|nazism|hitler/i,
  /\bkkk\b/i,
  /\bwhite power\b/i,
  /\bwhite nationalist\b/i,
  /blood sport/i,
  /\bdog fighting\b/i,
  /bestiality/i,
  /\bchild (?:porn|abuse|nudity)\b/i,
  /executed? (?:on|by)/i,
  /\bexecutions?\b/i,
  /guillotine/i,
  /\bslave(?:ry| trade)\b/i,
  /\bhate (?:crime|speech)\b/i,
  /\bterrorist(?: attack| organization)?\b/i,
];

// 強烈正面加分關鍵詞（提升 Creativity）
const CREATIVITY_BOOST = [
  'unexpected', 'juxtaposition', 'fusion', 'metaphor', 'allegory',
  'paradox', 'nostalgic yet futuristic', 'impossible geometry',
  'dreamlike', 'liminal space', 'magical realism', 'subverted expectations',
];

// Technical completeness 期望關鍵詞
const TECHNICAL_KEYWORDS = {
  lighting: ['lighting', 'light', 'sunlight', 'moonlight', 'rim light', 'backlight', 'soft light', 'dramatic light', 'diffused', 'natural light'],
  composition: ['composition', 'framing', 'foreground', 'background', 'centered', 'rule of thirds', 'depth of field', 'shallow', 'bokeh', 'close-up', 'wide', 'panoramic'],
  style: ['style', 'aesthetic', 'photorealistic', 'cinematic', 'documentary', 'editorial', 'vintage', 'modern', 'minimalist', 'detailed'],
  mood: ['mood', 'atmosphere', 'vibe', 'tone', 'emotion', 'dramatic', 'peaceful', 'serene', 'tense', 'mysterious'],
  camera: ['35mm', '85mm', 'wide angle', 'fisheye', 'shot on', 'Canon', 'Nikon', 'Hasselblad', 'medium format', 'tilt-shift'],
};

function evaluatePrompt(promptObj) {
  const { content, theme, aspect_ratio, llm_enhanced, seed_content, theme_id, tags } = promptObj;
  const text = content || promptObj.prompt || '';

  // ========== Safety Check (Veto) ==========
  let safetyScore = 10;
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      safetyScore = 0;
      break;
    }
  }

  const safetyVeto = safetyScore === 0;

  // ========== Dimension Scoring ==========

  // 1. Clarity (0-10) — 描述是否清晰無歧義
  let clarityScore = 5;
  const hasSubject = /^[A-Z].*(?:of|with|in|on|at)\b/i.test(text) || /person|man|woman|child|figure|animal|object|landscape|city|scene/i.test(text);
  const hasContext = /wearing|holding|sitting|standing|surrounded|location|time|setting/i.test(text);
  const hasDescription = text.split(',').length >= 2 || text.split(' and ').length >= 2;
  
  if (hasSubject && hasContext && hasDescription) clarityScore = 9;
  else if (hasSubject && hasContext) clarityScore = 7;
  else if (hasSubject) clarityScore = 5;
  else clarityScore = 3;

  // 2. Specificity (0-10) — 主體/場景/細節具體程度
  let specificityScore = 4;
  const specificDetails = [
    /in their \d+s/, /\d+th (?:century|century|year)/, /golden hour|blue hour|midday|twilight/i,
    /\b(?:Japanese|Chinese|African|American|European|Indian|Brazilian|Mexican|Korean)\b/i,
    /specific |exact |precise /i,
    /named |called |known as /i,
    /vintage |antique |modern |futuristic |ancient /i,
    /marble|wooden|glass|concrete|metal|textured/i,
  ];
  const detailMatches = specificDetails.filter(r => r.test(text)).length;
  specificityScore = Math.min(10, 4 + detailMatches * 1.5);

  // 3. Technical Completeness (0-10) — 光線/構圖/風格描述
  let technicalScore = 3;
  let techMatches = 0;
  for (const [category, keywords] of Object.entries(TECHNICAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        techMatches++;
      }
    }
  }
  // Also check for multi-word descriptors
  if (/\d+[Kk]?\s*(?:mm|MP|pixel)/.test(text)) techMatches += 0.5;
  if (/soft|hard|harsh|natural|artificial/.test(text)) techMatches += 0.5;
  
  technicalScore = Math.min(10, Math.round(techMatches * 1.5 + 3));

  // 4. Creativity (0-10) — 新穎程度
  let creativityScore = 5;
  const lowerText = text.toLowerCase();
  const creativityMatches = CREATIVITY_BOOST.filter(phrase => lowerText.includes(phrase)).length;
  
  // Unusual combinations boost creativity
  const hasUnexpectedCombo = 
    (/medieval|ancient|victorian/i.test(text) && /cyberpunk|neon|3d render/i.test(text)) ||
    (/realistic|photorealistic/i.test(text) && /painting|illustration|anime/i.test(text)) ||
    (/tiny|giant|microscopic|macro/i.test(text) && !/macro|micro/i.test(text));
  
  if (creativityMatches >= 2 || hasUnexpectedCombo) creativityScore = 9;
  else if (creativityMatches === 1) creativityScore = 7;
  else if (hasUnexpectedCombo) creativityScore = 8;
  else creativityScore = 5;

  // 5. Fluency (0-10) — 英文語法與流暢度
  let fluencyScore = 6;
  const commas = (text.match(/,/g) || []).length;
  const periods = (text.match(/\./g) || []).length;
  
  // Well-structured prompt with descriptive clauses
  if (commas >= 3 && !/[?!]{2,}/.test(text)) fluencyScore = 9;
  else if (commas >= 1) fluencyScore = 7;
  
  // Penalize obviously broken English
  if (/\b(the the|a a|is is)\b/i.test(text)) fluencyScore -= 3;
  if (/^\w+,{2,}/.test(text)) fluencyScore -= 2;

  // ========== Final Calculation ==========
  const weights = { clarity: 0.20, specificity: 0.20, technical: 0.20, safety: 0.15, creativity: 0.15, fluency: 0.10 };
  
  let finalScore;
  if (safetyVeto) {
    finalScore = 0;
  } else {
    finalScore = (
      clarityScore * weights.clarity +
      specificityScore * weights.specificity +
      technicalScore * weights.technical +
      safetyScore * weights.safety +
      creativityScore * weights.creativity +
      Math.max(0, fluencyScore) * weights.fluency
    );
  }

  const passed = !safetyVeto && finalScore >= 7.0;

  // Determine primary rejection reason
  let rejectionReason = null;
  if (safetyVeto) rejectionReason = 'SAFETY_VETO: Sensitive content detected';
  else if (finalScore < 7.0) {
    const weaknesses = [];
    if (clarityScore < 6) weaknesses.push(`clarity(${clarityScore})`);
    if (specificityScore < 6) weaknesses.push(`specificity(${specificityScore})`);
    if (technicalScore < 6) weaknesses.push(`technical(${technicalScore})`);
    if (creativityScore < 6) weaknesses.push(`creativity(${creativityScore})`);
    if (fluencyScore < 5) weaknesses.push(`fluency(${fluencyScore})`);
    rejectionReason = `SCORE_TOO_LOW(${finalScore.toFixed(1)}): ${weaknesses.join(', ')}`;
  }

  return {
    content: text,
    theme,
    aspect_ratio,
    llm_enhanced,
    seed_content,
    theme_id,
    tags,
    review: {
      final_score: Math.round(finalScore * 100) / 100,
      passed,
      safety_veto: safetyVeto,
      dimensions: {
        clarity: clarityScore,
        specificity: specificityScore,
        technical: technicalScore,
        safety: safetyScore,
        creativity: creativityScore,
        fluency: Math.max(0, fluencyScore),
      },
      weights_applied: weights,
      rejection_reason: rejectionReason,
      reviewed_at: new Date().toISOString(),
      reviewer_version: 'senior-prompt-engineer-v1',
    },
  };
}

// CLI modes
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--batch') {
    // Batch mode: read pending prompts from file
    const inputFile = args[1];
    if (!inputFile) {
      console.error('Usage: node senior-reviewer.js --batch <file.json>');
      process.exit(1);
    }

    const pending = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const results = pending.map(p => evaluatePrompt(p));
    
    const approved = results.filter(r => r.review.passed);
    const rejected = results.filter(r => !r.review.passed);

    console.log(`\n📋 Senior Review Complete`);
    console.log(`   Total reviewed: ${results.length}`);
    console.log(`   ✅ Approved: ${approved.length}`);
    console.log(`   ❌ Rejected: ${rejected.length}`);
    console.log(`   Pass rate: ${((approved.length / results.length) * 100).toFixed(1)}%`);
    console.log(`   Average score: ${(approved.reduce((s, r) => s + r.review.final_score, 0) / (approved.length || 1)).toFixed(2)}`);

    // Output
    const outputDir = path.dirname(inputFile);
    fs.writeFileSync(path.join(outputDir, 'approved.json'), JSON.stringify(approved, null, 2));
    fs.writeFileSync(path.join(outputDir, 'rejected.json'), JSON.stringify(rejected, null, 2));
    console.log(`\n✅ Results saved to ${outputDir}/`);

  } else if (args[0] === '--single') {
    // Single prompt review
    const promptText = args.slice(1).join(' ');
    const result = evaluatePrompt({ content: promptText });
    console.log(JSON.stringify(result, null, 2));

  } else {
    // Pipe mode: read from stdin
    let input = '';
    process.stdin.on('data', d => input += d);
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input.trim());
        const prompts = Array.isArray(data) ? data : [data];
        const results = prompts.map(p => evaluatePrompt(p));
        
        const approved = results.filter(r => r.review.passed);
        const rejected = results.filter(r => !r.review.passed);
        
        if (results.length === 1) {
          const r = results[0];
          console.log(`\n${r.review.passed ? '✅ APPROVED' : '❌ REJECTED'} — Score: ${r.review.final_score}/10`);
          if (!r.review.passed) console.log(`   Reason: ${r.review.rejection_reason}`);
          console.log(`\nDimensions:`);
          Object.entries(r.review.dimensions).forEach(([dim, score]) => {
            const bar = '█'.repeat(Math.round(score)) + '░'.repeat(10 - Math.round(score));
            console.log(`  ${dim.padEnd(14)} ${bar} ${score}`);
          });
        } else {
          console.log(`\n📋 Reviewed ${results.length} prompts: ${approved.length} ✅ approved, ${rejected.length} ❌ rejected`);
        }
      } catch (e) {
        console.error('Invalid JSON input:', e.message);
        process.exit(1);
      }
    });
  }
}

module.exports = { evaluatePrompt, SENSITIVE_PATTERNS };

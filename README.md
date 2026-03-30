# MiniMax Image 30 Days Job

> An OpenClaw agent skill that generates 50 diverse AI image prompts daily from 30 curated themes, with LLM-enhanced quality and built-in Senior Prompt Engineer review.

---

## What It Does

```
Stage 1: Program generates seed prompts from 30 themes (lighting/composition/style variants)
    ↓
Stage 2: LLM Enhancement (MiniMax-M2.7, Senior Prompt Engineer prompt)
    ↓
Stage 3: Rule-based Senior Review (Clarity, Specificity, Technical, Safety, Creativity, Fluency)
    ↓
Stage 4: approved.json (cumulative, deduplicated)
```

- **30 curated themes** — cinematic streets, fantasy landscapes, cyberpunk, product photography, and more
- **Daily scheduler** — 50 random prompts/day, customizable count
- **LLM Enhancement** — uses MiniMax-M2.7 to elevate seed prompts with creative and semantic improvements
- **Senior Review** — rule-based six-dimension scoring, safety veto, pass threshold ≥ 7.0
- **Approved library** — cumulative `approved.json` grows daily

---

## Quick Install

```bash
# 1. Clone into your OpenClaw skills directory
git clone https://github.com/alanfeng99/minimax-image-30-days-job.git \
  ~/.openclaw/skills/minimax-image-gen

# 2. Install dependencies
cd ~/.openclaw/skills/minimax-image-gen/scripts && npm install

# 3. Set your MiniMax API Key
export MINIMAX_API_KEY="your_Token_Plan_Key"

# 4. Run the scheduler
node scheduler.js
```

Get your **Token Plan API Key** at: [platform.minimax.io/user-center/basic-information/interface-key](https://platform.minimax.io/user-center/basic-information/interface-key)

---

## Usage Modes

```bash
node scheduler.js              # Full flow: LLM + Review (needs API key)
node scheduler.js --no-llm     # Rule-based only (no API key needed)
node scheduler.js --dry-run    # Test mode, no files written
node scheduler.js --count 30   # Custom prompt count

# LLM standalone tool
node llm-enhancer.js "your seed prompt here"
```

---

## Project Structure

```
├── README.md
├── SKILL.md                         ← Main skill documentation
├── theme-generator/SKILL.md         ← 30-theme generator guide
├── prompt-scheduler/SKILL.md        ← Daily scheduler + review guide
├── scripts/
│   ├── api.js                     ← MiniMax Image-01 API wrapper
│   ├── llm-enhancer.js            ← LLM prompt enhancer (MiniMax-M2.7)
│   ├── theme-generator.js         ← Generates 30 themes
│   ├── senior-reviewer.js         ← Rule-based Senior Review
│   ├── scheduler.js               ← Daily orchestrator
│   └── com.ai.pro16.*.plist      ← macOS launchd schedule
└── references/
    ├── themes.json                 ← 30 themes
    ├── screenshots/               ← Setup screenshots
    └── prompts/
        ├── approved.json           ← Cumulative approved prompts
        ├── rejected.json           ← Rejected with reasons
        └── daily/                  ← Daily run reports
```

---

## Senior Prompt Engineer Review Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Clarity | 20% | Clear and unambiguous? |
| Specificity | 20% | Specific subjects/settings/details? |
| Technical | 20% | Lighting/composition/style present? |
| Safety | 15% | **Veto** — sensitive content = instant rejection |
| Creativity | 15% | Novel or unexpected combinations? |
| Fluency | 10% | English grammar and fluency |

**Pass threshold**: Average score ≥ 7.0, Safety ≠ 0

---

## Automated Scheduling

### macOS
```bash
cp scripts/com.ai.pro16.minimax-prompt-scheduler.plist ~/Library/LaunchAgents/
# Edit the plist and replace YOUR_TOKEN_PLAN_API_KEY_HERE
launchctl load ~/Library/LaunchAgents/com.ai.pro16.minimax-prompt-scheduler.plist
```

### Windows
Use Task Scheduler to run `cmd.exe /c node scheduler.js` daily at 6:00 AM.

### Linux
```bash
crontab -e
# Add:
0 6 * * * cd ~/.openclaw/skills/minimax-image-gen/scripts && MINIMAX_API_KEY="your_key" node scheduler.js
```

---

## MiniMax APIs Used

| API | Endpoint | Purpose |
|-----|----------|---------|
| Text | `POST https://api.minimax.io/v1/text/chatcompletion_v2` | LLM prompt enhancement |
| Image | `POST https://api.minimax.io/v1/image_generation` | Actual image generation |
| Auth | Bearer Token (same key for both) | Token Plan Key |

---

## License

MIT

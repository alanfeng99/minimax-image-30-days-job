# MiniMax Image 30 Days Job

> An OpenClaw agent skill that generates 50 diverse AI image prompts daily from 30 curated themes, reviewed by a built-in Senior Prompt Engineer before approval.

---

## What It Does

1. **30 curated themes** — from cinematic street photography to cyberpunk, fantasy landscapes, product photography, and more
2. **Daily scheduler** — generates 50 random prompts per day (customizable count)
3. **Senior Prompt Engineer Review** — every prompt is scored across 6 dimensions (Clarity, Specificity, Technical, Safety, Creativity, Fluency) and must score ≥ 7.0 to pass
4. **Approved prompt library** — cumulative `approved.json` grows daily with reviewed prompts ready for MiniMax Image-01 generation

---

## Quick Install

```bash
# 1. Clone into your OpenClaw skills directory
git clone https://github.com/alanfeng99/minimax-image-30-days-job.git ~/.openclaw/skills/minimax-image-gen

# 2. Install dependencies
cd ~/.openclaw/skills/minimax-image-gen/scripts
npm install

# 3. Set your MiniMax API Key
export MINIMAX_API_KEY="your_Token_Plan_Key"

# 4. Run the scheduler
node scheduler.js

# Or run the theme generator first
node theme-generator.js
```

Get your **Token Plan API Key** at: [platform.minimax.io/user-center/basic-information/interface-key](https://platform.minimax.io/user-center/basic-information/interface-key)

---

## Project Structure

```
minimax-image-gen/
├── SKILL.md                        ← Main skill documentation
├── theme-generator/SKILL.md        ← 30-theme generator guide
├── prompt-scheduler/SKILL.md       ← Daily scheduler + review guide
├── scripts/
│   ├── api.js                     ← MiniMax Image-01 API wrapper
│   ├── theme-generator.js          ← Generates 30 themes
│   ├── senior-reviewer.js          ← Senior Prompt Engineer reviewer
│   ├── scheduler.js               ← Daily prompt scheduler
│   └── *.plist                    ← macOS launchd schedule
└── references/
    ├── themes.json                ← 30 themes (auto-generated)
    ├── screenshots/               ← Setup screenshots
    └── prompts/
        ├── approved.json          ← Cumulative approved prompts
        ├── rejected.json          ← Rejected prompts with reasons
        └── daily/                 ← Daily run reports
```

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

## Senior Prompt Engineer Review Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Clarity | 20% | Is the prompt clear and unambiguous? |
| Specificity | 20% | Are subjects, settings, and details specific? |
| Technical | 20% | Lighting/composition/style descriptors present? |
| Safety | 15% | **Veto** — sensitive content = instant rejection |
| Creativity | 15% | Novel or unexpected combinations? |
| Fluency | 10% | English grammar and fluency |

**Pass threshold**: Average score ≥ 7.0, Safety ≠ 0

---

## MiniMax Image-01 API

- **Endpoint**: `POST https://api.minimax.io/v1/image_generation`
- **Auth**: `Bearer <Token Plan API Key>`
- **Price**: ¥0.025 / image (≈ $0.0034 USD)
- **Models**: `image-01`
- **Max prompt**: 1500 characters
- **Max per request**: 9 images

See `minimax-image-gen/scripts/api.js` for the Node.js wrapper.

---

## License

MIT — free to use, modify, and distribute.

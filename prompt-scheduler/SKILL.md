# Prompt Scheduler — 每日 Prompt 生成與 Senior Review 排程

## 概述

每日從 30 個主題庫中隨機抽取，生成 50 個高質量 prompt：
- **Stage 1**：程式生成 seed prompts
- **Stage 2**：LLM（MiniMax-M2.7）增強創意和語意
- **Stage 3**：Senior Prompt Engineer Review 把關

---

## 必要設定

### 1. 取得 MiniMax API Key（Token Plan）

1. 前往 [platform.minimax.io/user-center/basic-information/interface-key](https://platform.minimax.io/user-center/basic-information/interface-key)
2. 切換到 **Token Plan Key** 分頁（如圖所示）
3. 建立並複製 API Key

> 📍 **截圖指引**：
> ![Token Plan Key 位置截圖](../references/screenshots/api-key-location.jpg)

---

### 2. 設定環境變數

```bash
export MINIMAX_API_KEY="你的Token Plan API Key"
```

---

### 3. 安裝依賴

```bash
cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts
npm install
```

---

### 4. 跨平台自動排程

#### macOS
```bash
cp scripts/com.ai.pro16.minimax-prompt-scheduler.plist ~/Library/LaunchAgents/
nano ~/Library/LaunchAgents/com.ai.pro16.minimax-prompt-scheduler.plist
# 替換 YOUR_TOKEN_PLAN_API_KEY_HERE 為真實 API Key
launchctl load ~/Library/LaunchAgents/com.ai.pro16.minimax-prompt-scheduler.plist
```

#### Windows（工作排程器）
1. 開啟「工作排程器」→ 「建立基本工作」
2. 名稱：`MiniMax Daily Prompt Scheduler`
3. 觸發程序：每日早上 6:00
4. 動作：「啟動程式」
   - 程式：`cmd.exe`
   - 引數：`/c cd /d "%USERPROFILE%\.openclaw\workspace\skills\minimax-image-gen\scripts" && node scheduler.js`
5. 條件：勾選「不論是否登入皆執行」，並在環境變數中加入 `MINIMAX_API_KEY`

#### Linux（crontab）
```bash
crontab -e
# 加入：
0 6 * * * cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts && MINIMAX_API_KEY="your_key" /usr/bin/node scheduler.js >> /tmp/minimax-scheduler.log 2>&1
```

---

## 流程架構

```
┌─────────────────────────────────────────────────────┐
│  每日觸發 (排程/OpenClaw HEARTBEAT)                  │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1: Seed Prompt 生成                           │
│     themes.json → 程式隨機變化組合                    │
│     光線/構圖/風格/情緒 四維度隨機疊加               │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│  Stage 2: LLM Enhancement (MiniMax-M2.7)             │
│     Senior Prompt Engineer system prompt             │
│     創意提升 + 語意流暢度 + 技術術語強化              │
│     ⚠️ 無 API Key 時自動跳過，降至純規則模式          │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│  Stage 3: Senior Prompt Engineer Review              │
│     Clarity / Specificity / Technical / Safety      │
│     Creativity / Fluency — 六維度評分                │
│     評分 0-10，門檻 ≥ 7 分，通過者進 approved.json   │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│  寫入 approved.json / rejected.json / daily/*.json   │
└─────────────────────────────────────────────────────┘
```

---

## Senior Prompt Engineer Review 評分標準

每個 prompt 由以下六個維度評分（各 0-10），取平均為最終分數：

| 維度 | 權重 | 說明 |
|------|------|------|
| Clarity | 20% | Prompt 描述是否清晰明確，無歧義 |
| Specificity | 20% | 主體/場景/物件細節是否具體 |
| Technical | 20% | 光線/構圖/風格描述完整性 |
| Safety | 15% | **否決制** — 含敏感詞直接拒絕 |
| Creativity | 15% | 主題/組合是否新穎有創意 |
| Fluency | 10% | 英文語法和流暢度 |

**通過條件**：平均分 ≥ 7.0，且 Safety ≠ 0

---

## 觸發方式

### 完整流程（預設，有 API Key）
```bash
node scheduler.js                    # 今天
node scheduler.js --count 30        # 自訂數量
```

### 純規則模式（跳過 LLM）
```bash
node scheduler.js --no-llm          # 無需 API Key
```

### 測試模式（不寫入）
```bash
node scheduler.js --dry-run         # 看結果，不寫檔案
node scheduler.js --dry-run --count 5 --no-llm
```

---

## 輸出檔案

| 檔案 | 內容 |
|------|------|
| `prompts/daily/YYYY-MM-DD.json` | 當日生成+審查後的全部 prompt（含分數、來源標記） |
| `prompts/approved.json` | 累積通過審查的 prompt（遞增，含 `llm_enhanced` 標記） |
| `prompts/rejected.json` | 累積未通過的 prompt（含維度分數和原因） |
| `prompts/stats.json` | 每日統計（生成數、通過率、平均分） |

---

## LLM Enhancement Prompt（MiniMax-M2.7 System Prompt）

LLM 使用 Senior Prompt Engineer 原則進行增強：

1. **具體化**：將模糊描述替換為感官豐富的細節
2. **技術層次**：加入光線/構圖/鏡頭術語
3. **創意保留**：維持 seed 的核心概念，加入一個意外的創意轉折
4. **長度控制**：80-250 字，逗號分隔描述性子句
5. **杜絕 cliché**：不使用 "stunningly beautiful" 等空洞形容詞

---

## 與 MiniMax API 的銜接

通過審查的 prompt 可直接用於生圖：

```javascript
const { approved } = require('../references/prompts/approved.json');
const { generateImage } = require('../api');

for (const prompt of approved.slice(-10)) {
  const result = await generateImage({
    prompt: prompt.content,
    aspectRatio: prompt.aspect_ratio || '1:1',
    n: 1,
  });
  console.log(result.images[0]);
}
```

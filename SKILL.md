# MiniMax Image-01 API — 完整呼叫指南

## 基本資訊

| 項目 | 內容 |
|------|------|
| **API Base URL** | `https://api.minimax.io` |
| **文字生成** | `POST /v1/text/chatcompletion_v2` |
| **圖片生成** | `POST /v1/image_generation` |
| **圖片模型** | `image-01` |
| **文字模型** | `MiniMax-M2.7` |
| **認證** | Bearer Token（同一組 API Key） |
| **圖片價格** | ¥0.025/張 (≈ $0.0034 USD) |

---

## API 請求格式

### Header

```
Content-Type: application/json
Authorization: Bearer <YOUR_API_KEY>
```

### 圖片生成（Text-to-Image）

| 參數 | 類型 | 必填 | 預設 | 說明 |
|------|------|------|------|------|
| `model` | string | ✅ | — | 固定值：`image-01` |
| `prompt` | string | ✅ | — | 圖片描述，最多 1500 字元 |
| `aspect_ratio` | string | ❌ | `1:1` | 比例：`1:1` `16:9` `4:3` `3:2` `2:3` `3:4` `9:16` `21:9` |
| `width` | integer | ❌ | 1024 | 寬 px，範圍 [512, 2048]，需為 8 的倍數 |
| `height` | integer | ❌ | 1024 | 高 px，範圍 [512, 2048]，需為 8 的倍數 |
| `response_format` | string | ❌ | `url` | `url`（24小時有效）或 `base64` |
| `seed` | integer | ❌ | 隨機 | 固定 seed 可重現相同圖片 |
| `n` | integer | ❌ | 1 | 每次生成數量，範圍 [1, 9] |
| `prompt_optimizer` | boolean | ❌ | `false` | 自動優化 prompt |

### 文字生成（Chat Completion）

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `model` | string | ✅ | `MiniMax-M2.7` |
| `messages` | array | ✅ | 訊息陣列，含 `role` 和 `content` |
| `temperature` | float | ❌ | 創意度，預設 0.7 |
| `max_tokens` | integer | ❌ | 最大回應長度 |

---

## 快速一鍵生圖

```bash
cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts
node api.js "your prompt here" --aspect 16:9 --n 3
```

必要環境變數：`MINIMAX_API_KEY`

---

## 每日 Prompt 生成流程（LLM 增強版）

```
Stage 1: 程式生成 seed prompts  (themes.json → 隨機變化組合)
    ↓
Stage 2: LLM 增強  (MiniMax-M2.7，Senior Prompt Engineer system prompt)
    ↓
Stage 3: Senior Reviewer 把關  (規則型六維度評分，安全審查)
    ↓
Stage 4: approved.json
```

**三個模式：**
- `node scheduler.js` — 完整流程（需 `MINIMAX_API_KEY`）
- `node scheduler.js --no-llm` — 跳過 LLM，純規則生成
- `node scheduler.js --dry-run` — 不寫入檔案，測試用

---

## 安裝設定（其他用戶）

### 1. 取得 MiniMax API Key

1. 前往 [platform.minimax.io/user-center/basic-information/interface-key](https://platform.minimax.io/user-center/basic-information/interface-key)
2. 切換到 **Token Plan Key** 分頁（如圖所示）
3. 建立新的 API Key 並複製

> 📍 **截圖指引**：
> ![Token Plan Key 位置截圖](references/screenshots/api-key-location.jpg)

### 2. 設定環境變數

```bash
export MINIMAX_API_KEY="你的Token Plan API Key"
```

### 3. 安裝依賴

```bash
cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts
npm install
```

### 4. 跨平台自動排程（可選）

#### macOS
使用 launchd：

```bash
cp scripts/com.ai.pro16.minimax-prompt-scheduler.plist ~/Library/LaunchAgents/
nano ~/Library/LaunchAgents/com.ai.pro16.minimax-prompt-scheduler.plist
# 替換 YOUR_TOKEN_PLAN_API_KEY_HERE 為真實 API Key
launchctl load ~/Library/LaunchAgents/com.ai.pro16.minimax-prompt-scheduler.plist
```

#### Windows
使用「工作排程器」：
1. 開啟「工作排程器」→ 「建立基本工作」
2. 名稱：`MiniMax Daily Prompt Scheduler`
3. 觸發程序：每日早上 6:00
4. 動作：「啟動程式」
   - 程式：`cmd.exe`
   - 引數：`/c cd /d "%USERPROFILE%\.openclaw\workspace\skills\minimax-image-gen\scripts" && node scheduler.js`
5. 條件：勾選「不論是否登入皆執行」，並設定 `MINIMAX_API_KEY` 環境變數

#### Linux
使用 crontab：

```bash
crontab -e
# 加入：
0 6 * * * cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts && MINIMAX_API_KEY="your_key" /usr/bin/node scheduler.js >> /tmp/minimax-scheduler.log 2>&1
```

---

## 作為 Skill 使用

這個 Skill 的子技能：

| Skill | 說明 |
|-------|------|
| `theme-generator` | 生成 30 個多樣化生圖主題 |
| `prompt-scheduler` | 每日排程：LLM 增強 + Senior Review |

詳細用法見各 Skill 的 SKILL.md。

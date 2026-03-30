# MiniMax Image-01 API — 完整呼叫指南

## 基本資訊

| 項目 | 內容 |
|------|------|
| **API Base URL** | `https://api.minimax.io` |
| **端點** | `POST /v1/image_generation` |
| **模型** | `image-01` |
| **認證** | Bearer Token (HTTP Bearer Auth) |
| **價格** | ¥0.025/張 (≈ $0.0034 USD) |

---

## API 請求格式

### Header

```
Content-Type: application/json
Authorization: Bearer <YOUR_API_KEY>
```

### Request Body 參數

| 參數 | 類型 | 必填 | 預設 | 說明 |
|------|------|------|------|------|
| `model` | string | ✅ | — | 固定值：`image-01` |
| `prompt` | string | ✅ | — | 圖片描述，最多 1500 字元 |
| `aspect_ratio` | string | ❌ | `1:1` | 比例：`1:1` `16:9` `4:3` `3:2` `2:3` `3:4` `9:16` `21:9` |
| `width` | integer | ❌ | 1024 | 寬 px，範圍 [512, 2048]，需為 8 的倍數 |
| `height` | integer | ❌ | 1024 | 高 px，範圍 [512, 2048]，需為 8 的倍數 |
| `response_format` | string | ❌ | `url` | `url` (24小時有效) 或 `base64` |
| `seed` | integer | ❌ | 隨機 | 固定 seed 可重現相同圖片 |
| `n` | integer | ❌ | 1 | 每次生成數量，範圍 [1, 9] |
| `prompt_optimizer` | boolean | ❌ | `false` | 自動優化 prompt |

### Aspect Ratio 對應尺寸

| Ratio | 預設尺寸 |
|-------|---------|
| `1:1` | 1024×1024 |
| `16:9` | 1280×720 |
| `4:3` | 1152×864 |
| `3:2` | 1248×832 |
| `2:3` | 832×1248 |
| `3:4` | 864×1152 |
| `9:16` | 720×1280 |
| `21:9` | 1344×576 |

---

## Node.js 呼叫範例

```javascript
const axios = require('axios');

async function generateImage({ apiKey, prompt, aspectRatio = '1:1', n = 1, responseFormat = 'url' }) {
  const response = await axios.post(
    'https://api.minimax.io/v1/image_generation',
    {
      model: 'image-01',
      prompt,
      aspect_ratio: aspectRatio,
      n,
      response_format: responseFormat,
      prompt_optimizer: false,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  const { data, metadata, id } = response.data;
  return {
    id,
    images: responseFormat === 'url' ? data.image_urls : data.image_base64,
    successCount: metadata.success_count,
    failedCount: metadata.failed_count,
  };
}

// 使用
const result = await generateImage({
  apiKey: process.env.MINIMAX_API_KEY,
  prompt: 'A man in a white t-shirt, full-body, standing front view, outdoors, with the Venice Beach sign in the background, Los Angeles. Fashion photography in 90s documentary style, film grain, photorealistic.',
  aspectRatio: '16:9',
  n: 3,
});
console.log(result.images);
```

---

## 錯誤碼

| status_code | 意義 |
|-------------|------|
| `0` | 成功 |
| `1002` | 速率限制，稍後重試 |
| `1004` | API Key 錯誤 |
| `1008` | 帳戶餘額不足 |
| `1026` | Prompt 偵測到敏感內容 |
| `2013` | 參數錯誤 |
| `2049` | API Key 無效 |

---

## 快速一鍵生圖 (使用專案內建腳本)

在已安裝依賴的情況下：

```bash
cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts
node api.js "your prompt here" --aspect 16:9 --n 3
```

必要環境變數：`MINIMAX_API_KEY`

---

## 安裝設定（其他用戶）

### 1. 取得 MiniMax API Key

1. 前往 [platform.minimax.io/user-center/basic-information/interface-key](https://platform.minimax.io/user-center/basic-information/interface-key)
2. 切換到 **Token Plan Key** 分頁（如圖所示）
3. 建立新的 API Key 並複製

> 📍 **截圖指引**：按下 `Cmd+Shift+4`（或 `Cmd+Shift+3`）截圖，懶人包如下：
> ![Token Plan Key 位置截圖](../references/screenshots/api-key-location.jpg)

### 2. 設定環境變數

```bash
export MINIMAX_API_KEY="你的Token Plan API Key"
```

### 3. macOS 自動排程（可選）

參考 `prompt-scheduler/SKILL.md` 的 launchd 設定段落。

---

## 作為 Skill 使用

這個 Skill 的子技能：

| Skill | 說明 |
|-------|------|
| `theme-generator` | 生成 30 個多樣化生圖主題 |
| `prompt-scheduler` | 每日排程：從主題庫抽出 50 個隨機 prompt，並經 Senior Prompt Engineer 審查 |

詳細用法見各 Skill 的 SKILL.md。

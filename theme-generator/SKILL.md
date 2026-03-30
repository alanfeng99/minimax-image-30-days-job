# Theme Generator — 生成 30 個多樣化生圖主題

## 用途

一次性生成 30 個高質量、多樣化的生圖主題，作為日後每日 prompt 生成的主題庫。

## 使用方式

```bash
cd ~/.openclaw/workspace/skills/minimax-image-gen/scripts
node theme-generator.js
```

輸出：`references/themes.json`（30 個主題陣列）

---

## 主題設計原則

30 個主題需覆蓋以下維度，確保日後生成的 prompt 多樣性：

| 維度 | 覆蓋說明 |
|------|---------|
| **場景** | 室內/室外/虛構/自然/都市/水下/太空 |
| **人物** | 個人/群體/歷史人物/虛構角色/動物 |
| **風格** | 寫實/插畫/動漫/電影感/水彩/3D渲染/賽博龐克 |
| **情緒** | 歡樂/憂鬱/緊張/神秘/史詩/療癒 |
| **用途** | 社群媒體/產品/頭像/漫畫/海報/資訊圖 |

---

## themes.json 格式

```json
[
  {
    "id": 1,
    "theme": "主題名稱",
    "description": "主題描述，涵蓋哪些內容範疇",
    "example_prompts": [
      "參考性 prompt 範例 1",
      "參考性 prompt 範例 2"
    ],
    "aspect_ratios": ["16:9", "1:1", "9:16"],
    "tags": ["portrait", "cinematic", "fantasy"]
  }
]
```

---

## 更新主題庫

若要重新生成主題，修改 `scripts/theme-generator.js` 中的 `DIVERSITY_REQUIREMENTS` 陣列，或直接編輯 `references/themes.json`。

建議每 1-2 個月更新一次主題庫，保持新穎度。

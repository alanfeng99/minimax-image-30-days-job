#!/usr/bin/env node
/**
 * Theme Generator — 生成 30 個多樣化生圖主題
 * 用法: node theme-generator.js [--regenerate]
 * 輸出: ../references/themes.json
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../references/themes.json');

// 30 個主題模板，涵蓋多元維度
const THEMES = [
  {
    id: 1,
    theme: 'Cinematic Urban Streets',
    description: '電影感都市街景，涵蓋東京、紐約、台北、上海等城市的街頭瞬間，側重光影與氛圍',
    example_prompts: [
      'Rain-soaked neon-lit alley in Tokyo at midnight, cinematic lighting, shallow depth of field, film grain, 35mm',
      'Busy New York City intersection in golden hour, commuters crossing, warm light streaming through buildings',
    ],
    aspect_ratios: ['16:9', '3:2', '2:3'],
    tags: ['urban', 'cinematic', 'street', 'cityscape'],
  },
  {
    id: 2,
    theme: 'Epic Fantasy Landscapes',
    description: '史詩級奇幻風景，魔法森林、遠古山脈、浮空島嶼、末日廢土等場景',
    example_prompts: [
      'Floating islands connected by crystal bridges, bioluminescent waterfalls, epic fantasy landscape, morning mist, dramatic',
      'Ancient forest with giant mushrooms glowing in the dark, fairy tale atmosphere, volumetric light rays',
    ],
    aspect_ratios: ['16:9', '21:9', '3:2'],
    tags: ['fantasy', 'landscape', 'epic', 'nature'],
  },
  {
    id: 3,
    theme: 'Portrait — Realistic Human',
    description: '寫實人物肖像，多角度、多光線、多種族，涵蓋證件照到時尚寫真',
    example_prompts: [
      'Close-up portrait of a woman in her 30s, soft Rembrandt lighting, blurred bokeh background, natural skin texture, photorealistic',
      'Environmental portrait of an elderly craftsman in his workshop, warm tungsten light, detailed hands, story-driven',
    ],
    aspect_ratios: ['2:3', '1:1', '3:4'],
    tags: ['portrait', 'realistic', 'human', 'photography'],
  },
  {
    id: 4,
    theme: 'Cyberpunk & Sci-Fi',
    description: '賽博龐克與科幻場景，高科技低生活的未來都市、機械改造、虛擬實境等',
    example_prompts: [
      'Cyberpunk street market in Neo-Tokyo, holographic advertisements, rainy night, neon reflections on wet pavement, cinematic',
      'Close-up of a futuristic robot face with expressive eyes, chrome reflections, blue LED accents, studio lighting',
    ],
    aspect_ratios: ['16:9', '2:3', '9:16'],
    tags: ['cyberpunk', 'sci-fi', 'future', 'neon'],
  },
  {
    id: 5,
    theme: 'Product Photography',
    description: '商業產品攝影風格，從電子產品到化妝品到珠寶，涵蓋白底與情境圖',
    example_prompts: [
      'Wireless earbuds on marble surface, soft studio lighting, floating shadows, minimalist, clean background, commercial photography',
      'Luxury watch on dark wood surface, dramatic side lighting, reflections on metal and glass, high-end product shot',
    ],
    aspect_ratios: ['1:1', '4:3', '3:2'],
    tags: ['product', 'commercial', 'photography', 'minimal'],
  },
  {
    id: 6,
    theme: 'Anime & Illustration Style',
    description: '動漫與插畫風格，從日系漫風到歐美插畫，涵蓋角色設計和場景',
    example_prompts: [
      'Anime-style girl with silver hair standing in a cherry blossom grove, soft pink lighting, detailed hair, Studio Ghibli inspired',
      'Epic fantasy book cover illustration, knight facing a dragon, dramatic sky, vibrant colors, detailed armor textures',
    ],
    aspect_ratios: ['2:3', '3:4', '1:1'],
    tags: ['anime', 'illustration', 'character', 'art'],
  },
  {
    id: 7,
    theme: 'Wildlife & Nature',
    description: '野生動物與自然生態，微距到全景，展現自然界的多樣性與戲劇性',
    example_prompts: [
      'Lioness hunting in African savanna at golden hour, dramatic silhouette, dust particles in air, National Geographic style',
      'Extreme macro of a tropical frog on a dew-covered leaf, soft natural light, shallow depth, vibrant colors, shallow bokeh',
    ],
    aspect_ratios: ['16:9', '4:3', '3:2'],
    tags: ['wildlife', 'nature', 'animals', 'photography'],
  },
  {
    id: 8,
    theme: 'Architecture & Interiors',
    description: '建築與室內設計，涵蓋大師建築、極簡室內、奢華空間到廢墟美學',
    example_prompts: [
      'Modern minimalist living room with floor-to-ceiling windows overlooking ocean, Scandinavian furniture, soft natural light, interior design photography',
      'Brutalist concrete staircase spiraling upward, dramatic volumetric light from above, geometric shadows, architectural photography',
    ],
    aspect_ratios: ['3:2', '4:3', '16:9'],
    tags: ['architecture', 'interior', 'design', 'minimal'],
  },
  {
    id: 9,
    theme: 'Food Photography',
    description: '美食攝影，從精緻擺盤到街頭小吃，涵蓋各種餐飲視覺風格',
    example_prompts: [
      'Ramen bowl with perfectly layered toppings, steam rising, overhead shot on dark ceramic surface, moody food photography',
      'Artisan sourdough bread loaf, cross-section showing perfect crumb texture, flour-dusted surface, rustic wooden background, warm lighting',
    ],
    aspect_ratios: ['1:1', '4:3', '16:9'],
    tags: ['food', 'photography', 'commercial', 'culinary'],
  },
  {
    id: 10,
    theme: 'Fashion & Editorial',
    description: '時尚與編輯攝影，高端時裝秀、街頭時尚、雜誌封面質感',
    example_prompts: [
      'Editorial fashion shoot, model in avant-garde couture dress, industrial warehouse location, dramatic rim lighting, high fashion magazine cover',
      'Street style portrait, Tokyo fashion district, vibrant colorful outfit, natural candid moment, film photography aesthetic',
    ],
    aspect_ratios: ['2:3', '3:4', '16:9'],
    tags: ['fashion', 'editorial', 'magazine', 'style'],
  },
  {
    id: 11,
    theme: 'Vintage & Retro Aesthetics',
    description: '復古美學，黑白電影、70年代廣告、老照片質感、二戰宣傳畫風',
    example_prompts: [
      '1940s noir detective scene, venetian blinds casting shadow stripes, cigarette smoke, monochrome film grain, dramatic',
      '1970s living room in orange and brown tones, shag carpet, wood paneling, vintage TV set, nostalgic warm color grading',
    ],
    aspect_ratios: ['4:3', '16:9', '1:1'],
    tags: ['vintage', 'retro', 'nostalgic', 'film'],
  },
  {
    id: 12,
    theme: 'Abstract & Surreal',
    description: '抽象與超現實主義，結合不可能的空間、扭曲現實與夢境般的場景',
    example_prompts: [
      'Surreal landscape where a giant clock melts into a sandy desert, Dali-inspired, golden hour lighting, vast empty sky, hyperdetailed',
      'Abstract floating geometric shapes in a void, iridescent materials, soft studio lighting, minimal composition, art installation aesthetic',
    ],
    aspect_ratios: ['1:1', '16:9', '2:3'],
    tags: ['abstract', 'surreal', 'art', 'dreamscape'],
  },
  {
    id: 13,
    theme: 'Social Media Content',
    description: '社群媒體內容圖，Instagram帖文、YouTube縮圖、Twitter header、TikTok封面',
    example_prompts: [
      'Instagram lifestyle flat lay, coffee cup, open book, dried flowers, watch, minimal objects, soft pastel background, top-down composition',
      'YouTube thumbnail, dramatic close-up face with text space on right, cinematic color grading, high contrast, eye-catching',
    ],
    aspect_ratios: ['1:1', '16:9', '9:16'],
    tags: ['social', 'media', 'content', 'digital', 'marketing'],
  },
  {
    id: 14,
    theme: 'Historical Reenactment',
    description: '歷史重現場景，從古埃及到二戰，涵蓋重要歷史時刻的逼真重現',
    example_prompts: [
      'Ancient Roman forum at midday, citizens in authentic togas, detailed architecture, warm Mediterranean sunlight, historical documentary style',
      'Apollo 11 moon landing moment, astronaut on lunar surface, Earth visible in background, photorealistic, cinematic lighting, historical recreation',
    ],
    aspect_ratios: ['16:9', '3:2', '2:3'],
    tags: ['history', 'documentary', 'realistic', 'period'],
  },
  {
    id: 15,
    theme: 'Underwater World',
    description: '海底世界，從珊瑚礁到深海生物，涵蓋水下攝影的所有戲劇性場景',
    example_prompts: [
      'Bioluminescent deep sea creatures in pitch black ocean, ethereal blue glow, documentary style, extreme depth, mysterious atmosphere',
      'Coral reef ecosystem at midday, tropical fish school, sun rays penetrating water surface, vibrant colors, underwater photography',
    ],
    aspect_ratios: ['16:9', '3:2', '4:3'],
    tags: ['underwater', 'ocean', 'marine', 'nature'],
  },
  {
    id: 16,
    theme: 'Space & Cosmic',
    description: '太空與宇宙主題，星雲、行星、太空站、與外星環境的壯闊景觀',
    example_prompts: [
      'Space station orbiting a ringed planet at sunset, Earth in background, astronaut on spacewalk, cinematic lighting, highly detailed',
      'Nebula cloud in deep space, vibrant purples and blues, newborn stars, cosmic dust, Hubble-style astrophotography aesthetic',
    ],
    aspect_ratios: ['16:9', '21:9', '1:1'],
    tags: ['space', 'cosmic', 'sci-fi', 'astronomy'],
  },
  {
    id: 17,
    theme: 'Healing & Wellness',
    description: '療癒與健康主題，冥想、瑜伽、自然疗愈、心理健康視覺化',
    example_prompts: [
      'Person meditating in a sunlit forest clearing, morning mist, volumetric god rays, peaceful serene atmosphere, wellness photography',
      'Aesthetic self-care flat lay, essential oils, dried flowers, journal, herbal tea on marble surface, soft natural light, top-down',
    ],
    aspect_ratios: ['1:1', '16:9', '2:3'],
    tags: ['wellness', 'healing', 'lifestyle', 'mindfulness'],
  },
  {
    id: 18,
    theme: 'Comic & Graphic Novel',
    description: '漫畫與圖像小說風格，從超級英雄到獨立漫畫，涵蓋各種漫畫敘事手法',
    example_prompts: [
      'Dynamic comic book action panel, superhero flying through destroyed cityscape, speed lines, dramatic lighting, bold colors, Marvel/DC style',
      'Slice-of-life manga panel, high school rooftop scene, golden hour, soft shadows, cel-shaded rendering, Studio Ghibli meets anime',
    ],
    aspect_ratios: ['2:3', '16:9', '3:4'],
    tags: ['comic', 'graphic', 'novel', 'action', 'narrative'],
  },
  {
    id: 19,
    theme: 'Pet & Companion Animals',
    description: '寵物與伴侶動物，貓狗到異國寵物，涵蓋各種風格的動物攝影',
    example_prompts: [
      'Golden retriever portrait in tall grass, golden hour backlight, soft bokeh, joyful expression, pet photography, natural setting',
      'Cat sleeping on a stack of colorful books, warm window light, cozy atmosphere, shallow depth, domestic lifestyle photography',
    ],
    aspect_ratios: ['1:1', '4:3', '2:3'],
    tags: ['pets', 'animals', 'dog', 'cat', 'lifestyle'],
  },
  {
    id: 20,
    theme: 'Infographic & Data Visualization',
    description: '資訊圖表與數據視覺化，將複雜數據轉化為美觀的視覺敘事',
    example_prompts: [
      'Futuristic data visualization dashboard, holographic graphs, blue-purple color scheme, dark background, tech aesthetic, clean typography',
      'Hand-drawn style infographic about renewable energy, illustrated icons, earth tones, clean layout, editorial design quality',
    ],
    aspect_ratios: ['16:9', '4:3', '3:2'],
    tags: ['infographic', 'data', 'visualization', 'design'],
  },
  {
    id: 21,
    theme: 'Dark & Moody Horror',
    description: '黑暗與驚悚美學，廢墟、恐怖場景、萬聖節、哥德式建築',
    example_prompts: [
      'Abandoned asylum hallway in moonlight, broken windows, overgrown vegetation, eerie atmosphere, horror movie still, cinematic',
      'Gothic cathedral interior at night, single beam of red light from stained glass, fog on stone floor, ominous mood, dramatic',
    ],
    aspect_ratios: ['2:3', '16:9', '3:4'],
    tags: ['horror', 'dark', 'gothic', 'moody', 'thriller'],
  },
  {
    id: 22,
    theme: 'Sports & Action',
    description: '運動與動作攝影，極限運動到傳統體育，捕捉速度與力量',
    example_prompts: [
      'Surfer riding massive barrel wave at sunset, spray and mist, dynamic composition, extreme sports photography, golden light',
      'Basketball player dunking mid-air, stadium lights, motion blur on ball, dramatic shadows, Sports Illustrated cover quality',
    ],
    aspect_ratios: ['16:9', '3:2', '2:3'],
    tags: ['sports', 'action', 'athletic', 'dynamic'],
  },
  {
    id: 23,
    theme: 'Children & Family',
    description: '孩童與家庭主題，紀實風格到温馨寫真，捕捉真實情感',
    example_prompts: [
      'Candid documentary shot of children playing in autumn leaves, natural light, unposed genuine moment, warm color grading',
      'Newborn baby asleep in parents hands, soft neutral background, intimate close-up, warm skin tones, tender moment',
    ],
    aspect_ratios: ['2:3', '4:3', '1:1'],
    tags: ['children', 'family', 'lifestyle', 'documentary'],
  },
  {
    id: 24,
    theme: 'Automotive & Machinery',
    description: '汽車與機械主題，經典老車到未來概念車，工程美學與速度感',
    example_prompts: [
      'Classic 1969 Mustang in desert setting, golden hour, long shadow, dust particles in air, automotive photography, cinematic',
      'Futuristic electric concept car, minimalist showroom, dramatic overhead lighting, reflective floor, automotive design sketch aesthetic',
    ],
    aspect_ratios: ['16:9', '3:2', '4:3'],
    tags: ['automotive', 'car', 'machinery', 'industrial'],
  },
  {
    id: 25,
    theme: 'Music & Concert',
    description: '音樂與演唱會攝影，捕捉現場音樂的能量與情感，表達音樂視覺化',
    example_prompts: [
      'Rock concert at night, lead singer under spotlight, crowd in silhouette, stage lights creating lens flare, high ISO grain, energy',
      'Jazz musician playing saxophone in smoky bar, warm amber lighting, steam rising from instrument, intimate mood, noir aesthetic',
    ],
    aspect_ratios: ['2:3', '16:9', '3:4'],
    tags: ['music', 'concert', 'musician', 'live', 'documentary'],
  },
  {
    id: 26,
    theme: 'Steampunk & Vintage Tech',
    description: '蒸汽龐克與復古科技，維多利亞時代美學與機械的結合',
    example_prompts: [
      'Steampunk airship interior, brass pipes, Victorian gauges, gears visible, warm amber lighting, detailed mechanical elements',
      'Vintage typewriter on antique wooden desk, scattered letters, quill pen, sepia tones, nostalgic still life photography',
    ],
    aspect_ratios: ['4:3', '1:1', '3:2'],
    tags: ['steampunk', 'vintage', 'retro', 'mechanical'],
  },
  {
    id: 27,
    theme: 'Minimalism & White Space',
    description: '極簡主義與留白美學，探尋「少即是多」的視覺張力',
    example_prompts: [
      'Single geometric object on pristine white surface, perfectly centered, pure white background, studio lighting, minimal shadows',
      'Solitary figure walking on vast empty beach, tiny in frame, expansive white sand, overcast sky, sense of scale and solitude',
    ],
    aspect_ratios: ['1:1', '3:2', '4:3'],
    tags: ['minimal', 'white', 'space', 'clean', 'zen'],
  },
  {
    id: 28,
    theme: 'Seasonal & Holiday',
    description: '季節與節慶主題，春夏秋冬各有獨特美學，聖誕節到中秋節',
    example_prompts: [
      'White Christmas scene, snow-covered cabin, warm light glowing from windows, falling snowflakes, bokeh Christmas lights in foreground',
      'Cherry blossom festival in Kyoto, temple grounds covered in pink petals, traditional lanterns, spring atmosphere, travel photography',
    ],
    aspect_ratios: ['16:9', '3:2', '2:3'],
    tags: ['seasonal', 'holiday', 'celebration', 'travel'],
  },
  {
    id: 29,
    theme: 'Tech & Digital Art',
    description: '科技與數位藝術，AI生成藝術、3D渲染、數據雕塑、虛擬世界',
    example_prompts: [
      'Abstract 3D rendered sculpture, iridescent material, floating in digital void, volumetric lighting, octane render aesthetic',
      'AI neural network visualization, glowing nodes and connections, blue-cyan color scheme, dark background, futuristic tech art',
    ],
    aspect_ratios: ['1:1', '16:9', '4:3'],
    tags: ['tech', 'digital', '3d', 'art', 'ai'],
  },
  {
    id: 30,
    theme: 'Merch & Drop Ship Products',
    description: '電商與商品視覺，Shopify/TikTok Shop/Amazon 產品場景圖，強調轉化率',
    example_prompts: [
      'T-shirt design mockup on invisible mannequin, solid color background, retail photography lighting, clean e-commerce standard',
      'Multi-angle product shot of wireless charger, foam-cuted background, studio lighting setup visible, Amazon listing style',
    ],
    aspect_ratios: ['1:1', '4:3', '3:2'],
    tags: ['ecommerce', 'product', 'merch', 'shopify', 'marketing'],
  },
];

async function generateThemes() {
  // Add metadata
  const themesWithMeta = THEMES.map(t => ({
    ...t,
    generated_at: new Date().toISOString(),
    version: '1.0',
  }));

  // Ensure output directory exists
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(themesWithMeta, null, 2), 'utf8');
  console.log(`✅ Generated ${themesWithMeta.length} themes → ${OUTPUT_FILE}`);
  
  // Summary
  const tagCounts = {};
  themesWithMeta.forEach(t => {
    t.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  console.log('\n📊 Theme Coverage:');
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([tag, count]) => console.log(`  #${tag}: ${count} themes`));
}

generateThemes().catch(console.error);

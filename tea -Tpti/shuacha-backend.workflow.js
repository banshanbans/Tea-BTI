export const meta = {
  name: 'shuacha-backend',
  description: 'Build the shuacha FastAPI backend: recommendation, Tea-BTI, passport/memory, brew-vision + tasting mock',
  phases: [
    { title: 'Foundation' },
    { title: 'Services' },
    { title: 'Integrate' },
  ],
};

const CTX = `
项目背景：《刷茶》——一个让年轻人第一次进入原叶茶世界的移动端 Web App。你正在按技术架构文档实现其后端。

技术规格（唯一真相来源，务必先读）：
- 技术架构：c:/Users/18984/Desktop/新建文件夹 (2)/shuacha_technical_architecture.md （重点看第 4-19 节：数据模型、推荐系统、Tea-BTI、Brew Vision、Taste Mode、API 草案）
- PRD：c:/Users/18984/Desktop/新建文件夹 (2)/shuacha_PRD.md
- 前端原型（提取茶文案与感官数据）：c:/Users/18984/Desktop/新建文件夹 (2)/index.html

后端工程根目录：c:/Users/18984/Desktop/新建文件夹 (2)/apps/api

已就绪环境：Python 3.11.9，已安装 fastapi 0.136、uvicorn 0.41、pydantic 2.13、SQLAlchemy 2.0.50、numpy 2.4.6、httpx、anthropic、openai。
（不要重新 pip install 已装的包；若确需额外包请用 python -m pip install。）

技术栈约定：
- FastAPI + Pydantic v2 + SQLAlchemy 2.0 + SQLite（demo 用 sqlite:///./shuacha.db，通过 SQLAlchemy 抽象可迁移 PostgreSQL）+ numpy 做向量运算。
- 目录结构（遵循技术架构 repo 结构）：
  apps/api/
    main.py            # FastAPI 入口 + 路由注册 + 启动时建表/种子
    db.py              # engine + SessionLocal + Base
    models.py          # SQLAlchemy 模型
    schemas.py         # Pydantic 响应/请求模型
    seed.py            # 种子数据（写库）
    requirements.txt
    data/teas.json     # 5 款茶完整 profile（含 sensory_vector）
    services/__init__.py
    services/tea_profile.py
    services/recommendation.py
    services/teabti.py
    services/memory.py
    services/brew_vision.py
    services/tasting.py
    routes/__init__.py
    routes/feed.py, swipe.py, recommendation.py, drink_feedback.py, taste.py, brew.py, passport.py, teabti.py

核心原则（必须遵守）：
1) demo 核心逻辑本地可跑、可降级：Feed/Swipe/Recommendation/Tea-BTI/Passport 不依赖任何外部模型/网络。
2) Brew Vision 与 Taste Conversation 采用 mock 降级（预设 fallback），但接口设计成可插拔真实 VLM/LLM provider（通过一个 provider 开关/环境变量）。
3) 不给伪精确：不允许模型声称精确水温/克数/茶多酚浓度；用「看起来」「大约」等表述。
4) AI 只翻译表达，不创造事实；客观信息来自种子数据。
5) 所有文案用中文，与前端一致（都匀毛尖/湄潭翠芽/遵义红/普安红/雷山银球茶）。

数据模型（技术架构第 6 节，务必实现）：
- Tea { id, name, region, tea_type, official_aroma[], official_taste[], process[], sensory_vector[9], embedding(可空), blind_copy{headline,description,scene,tags[]}, brewing_guide{vessel,temperature_range,steep_time,notes[]} }
- UserTasteProfile { user_id, freshness,sweetness,body,roast,astringency,floral,fruity,clean,aftertaste (9 维浮点), sample_count, confidence_state("forming"|"early"|"stable") }
- SwipeEvent { user_id, tea_id, action("like"|"skip"|"save"), timestamp }
- DrinkFeedback { user_id, tea_id, result("like"|"neutral"|"dislike"), user_words, normalized_tags[], infusion_number, timestamp }
- TeaPassportEntry { user_id, tea_id, first_drunk_at, favorite_infusion, user_description, normalized_tags[], brewed, tasted, realm_unlocked }

sensory_vector 的 9 维顺序（固定）：
[ freshness鲜爽, sweetness甜润, body醇厚度, roast焙火感, astringency涩感, floral花香, fruity果香, clean干净, aftertaste回甘尾韵 ]，每维 0-10 浮点。

5 款茶数据（务必逐字写入 data/teas.json 与 seed.py，sensory_vector 用以下值）：
1. duyun 都匀毛尖，贵州·黔南，绿茶，emoji 🍃
   official_aroma ["栗香","清香"], official_taste ["鲜爽","回甘"], process ["杀青","揉捻","干燥"]
   sensory_vector [8.5,5.5,3.0,2.0,2.0,5.0,3.0,8.0,7.0]
   blind_copy { headline:"清一点。", description:"像刚冒出来的嫩叶，尾巴还会留一点甜。", scene:"适合刚睡醒的周末上午", tags:["轻盈","清鲜","回甘"] }
   brewing_guide { vessel:"玻璃杯或盖碗", temperature_range:"80–85°C", steep_time:"第一泡 20 秒左右", notes:["高海拔多雾山地茶园"] }
2. meitan 湄潭翠芽，贵州·遵义，绿茶，emoji 🌱
   official_aroma ["甜香"], official_taste ["鲜爽","柔和"], process ["摊青","杀青","理条","干燥"]
   sensory_vector [8.0,7.5,3.5,2.0,2.0,6.0,4.0,7.5,6.0]
   blind_copy { headline:"甜香先到。", description:"有味道，但不厚重。下午想喝点东西的时候刚好。", scene:"适合午后的那一口", tags:["甜香","鲜爽","柔和"] }
   brewing_guide { vessel:"玻璃杯", temperature_range:"85°C", steep_time:"上投法 1–2 分钟", notes:["云雾缭绕的茶区"] }
3. zunyi 遵义红，贵州·遵义，红茶，emoji 🍂
   official_aroma ["甜香"], official_taste ["醇厚","绵长"], process ["萎凋","揉捻","发酵","干燥"]
   sensory_vector [4.0,6.5,8.0,6.0,3.0,4.0,5.0,5.0,8.5]
   blind_copy { headline:"这一杯更有存在感。", description:"稍微厚一点，尾韵会停得久一点。", scene:"适合慢慢坐下来的傍晚", tags:["醇厚","温熟","绵长"] }
   brewing_guide { vessel:"盖碗或壶", temperature_range:"90°C", steep_time:"快进快出", notes:["高山生态茶园"] }
4. puan 普安红，贵州·黔西南，红茶，emoji 🍁
   official_aroma ["甜香"], official_taste ["甜润","温熟"], process ["萎凋","揉捻","发酵","干燥"]
   sensory_vector [3.5,8.0,7.0,6.0,3.0,3.0,6.0,6.5,7.0]
   blind_copy { headline:"暖一点。", description:"像晒过太阳的叶子，喝下去是踏实的甜。", scene:"适合有点凉的日子", tags:["甜润","温熟","干净"] }
   brewing_guide { vessel:"盖碗", temperature_range:"90°C", steep_time:"快进快出", notes:["高海拔茶区"] }
5. leishan 雷山银球茶，贵州·黔东南，绿茶，emoji 🫒
   official_aroma ["清香"], official_taste ["清鲜","干净"], process ["杀青","揉捻","成球","干燥"]
   sensory_vector [8.0,4.5,3.0,2.0,1.5,4.0,2.5,9.0,5.5]
   blind_copy { headline:"很干净的一口。", description:"没有什么多余的东西，像山里的清泉。", scene:"适合想安静下来的时刻", tags:["干净","清鲜","轻盈"] }
   brewing_guide { vessel:"玻璃杯", temperature_range:"85°C", steep_time:"球型茶可稍久", notes:["云雾高山"] }
`;

const FOUNDATION_PROMPT = `${CTX}

你的职责（Phase 1 · Foundation）：建立后端骨架与数据层，作为所有 service 的依赖契约。全部使用绝对路径，先读技术架构文档确认细节。

创建以下文件（在 apps/api/ 下）：
1) requirements.txt —— 列出 fastapi、uvicorn[standard]、pydantic、SQLAlchemy、numpy（版本用 >= 宽松约束）。
2) data/teas.json —— 把上面「5 款茶数据」逐字写成 JSON 数组（含 sensory_vector 9 维、blind_copy、brewing_guide、official_aroma/taste、process、region、tea_type）。
3) db.py —— SQLAlchemy 2.0 风格：Base(DeclarativeBase)、engine=create_engine("sqlite:///./shuacha.db", connect_args={"check_same_thread":False})、SessionLocal=sessionmaker、get_db 依赖。
4) models.py —— 5 个 SQLAlchemy 模型（Tea, UserTasteProfile, SwipeEvent, DrinkFeedback, TeaPassportEntry），JSON 字段用 SQLAlchemy JSON 类型，sensory_vector 用 JSON 存 list[float]。字段与上面数据模型一致。
5) schemas.py —— 对应 Pydantic v2 模型（请求/响应），包含 TeaOut, SwipeIn(action:like|skip|save, tea_id), SwipeOut(taste_profile_delta, next_tea, recommendation_ready), RecommendationOut, DrinkFeedbackIn/Out, TasteNormalizeIn/Out, BrewFrameIn/Out, PassportOut, TeaBtiOut 等。字段对齐技术架构第 19 节 API 草案。
6) seed.py —— 从 data/teas.json 读入并写入 Tea 表（幂等：已存在则跳过）。
7) services/__init__.py、services/tea_profile.py —— tea_profile 服务：get_tea(id)、list_teas()、tea_sensory_vector(id) 返回 9 维 list。
8) main.py —— FastAPI 应用骨架：create_engine 建表（Base.metadata.create_all）+ 启动时 seed；挂载 CORS（允许本地前端）；引入 routes 的 router（先用占位 import 或空 router 列表，Integrate 阶段补全路由）。提供一个 GET /health 返回 {"status":"ok"}。

完成后运行自检：cd apps/api && python -c "import main" 或 python main.py 里能 import 不报错；python -m seed 能建库写数据。
返回结构化报告：你创建的文件清单、models.py 的表名与关键字段、schemas.py 的类名清单、seed 是否成功。
`;

const SERVICE_TPL = (label, filename, detail, readHint) => `${CTX}

你的职责（Phase 2 · Services · ${label}）：实现一个后端 service。Foundation 已建好 models.py/schemas.py/db.py/data/teas.json/seed.py/services/tea_profile.py。

先读（绝对路径）：
- apps/api/models.py、schemas.py、db.py、data/teas.json、services/tea_profile.py
${readHint}

实现文件 apps/api/services/${filename}.py（${filename}.py 提供纯函数/类方法，不直接定义 FastAPI 路由，路由由 Integrate 阶段接）：

${detail}

要求：
- 用 numpy 做向量运算（余弦相似度等）。
- 不依赖任何外部模型/网络；需要「AI 翻译」的地方用规则 + 预设 fallback，并留一个清晰的 provider 扩展点（如函数签名里预留 model 参数或环境变量开关）。
- 中文文案与前端一致。
- 类型清晰，函数有 docstring。
完成后返回文字：你实现的函数签名清单 + 关键算法说明。
`;

const RECOMMENDATION_PROMPT = SERVICE_TPL(
  'recommendation',
  'recommendation',
  `
实现推荐服务（对应技术架构第 8 节）：
1) cold_start_feed(seen_tea_ids) -> list[tea_id]：多样性优先，按 sensory_vector 差异大选取，前 5 张覆盖不同 taste region（可用 pairwise 距离贪心选最不相近的）。
2) update_taste_profile(user_id, action, tea_id) -> profile_delta：按权重更新 UserTasteProfile 的 9 维向量。权重：skip -0.5, like +1, save +1.5, drink_like +3, drink_dislike -3（真喝反馈权重大）。注意：Taste Vector = Σ(like tea 向量×权重) - Σ(skip 向量×|权重|) + Σ(真喝反馈×更大权重)；sample_count 累加；confidence_state 按 0-5 forming / 6-15 early / 16+ stable 更新。
3) recommend(user_id, exclude_ids, top_k=1) -> list[tea_id]：score = 0.55*sensory_similarity + 0.30*embedding_similarity(无 embedding 时退化为 sensory_similarity) + 0.15*exploration_bonus；exploration_bonus = 对用户未见过的茶加一个固定小值（冷启动期提高，可设为 0.25，样本多后降低）。用 numpy 余弦相似度。
4) 辅助：get_taste_profile(user_id)（不存在则返回零向量 + forming）。
`,
  '参考技术架构第 8 节推荐系统与第 2 节 Taste Vector 权重。'
);

const TEABTI_PROMPT = SERVICE_TPL(
  'teabti',
  'teabti',
  `
实现 Tea-BTI 服务（对应技术架构第 14 节）：
1) project_axes(profile) -> { light_full, fresh_warm, sweet_punchy, clean_long } 四个 0-100 值。投影规则（用 9 维向量组合，可简化）：
   - light_full（轻盈↔饱满）：越低越轻盈。= clamp(0,100, 100 - (body*10 + roast*2)) 之类，自己给出合理映射并注释。
   - fresh_warm（清鲜↔温熟）：越低越清鲜。= clamp(0,100, 100 - freshness*10)。
   - sweet_punchy（甜润↔劲爽）：越低越甜润。= clamp(0,100, 100 - sweetness*10)。
   - clean_long（干净↔绵长）：越低越干净。= clamp(0,100, 100 - clean*10)。
   总之：轻盈/清鲜/甜润/干净 在低端，饱满/温熟/劲爽/绵长 在高端。数值需落在 0-100。
2) archetype(axes) -> str：规则匹配返回 6-8 个预设类型名。至少包含：SPRING_MIST「春雾回甘型」（light<35 且 fresh<35 且 clean_long 偏绵长）、以及「甜润暖熟型」「清鲜爽朗型」「醇厚绵长型」等，每个给出 if 规则。当前 demo 数据应返回「春雾回甘型」。
3) confidence_state(sample_count)：0-5 forming / 6-15 early / 16+ stable。
4) build_teabti(user_id) -> { archetype, axes, confidence_state, evidence }：evidence 取最近若干 liked/跳过 茶作为文字证据。
`,
  '参考技术架构第 14 节与 PRD 第 14 节 Tea-BTI 四轴。'
);

const MEMORY_PROMPT = SERVICE_TPL(
  'memory',
  'memory',
  `
实现 Memory / Passport 服务（对应技术架构第 15 节）：
1) add_passport_entry(user_id, tea_id, **kwargs) -> TeaPassportEntry：不存在则创建（first_drunk_at 现在时间），存在则更新（brewed/tasted/realm_unlocked 布尔、favorite_infusion、user_description、normalized_tags）。
2) get_passport(user_id) -> list[TeaPassportEntry]（含 tea 详情联查）。
3) mark_brewed(user_id, tea_id) / mark_tasted(user_id, tea_id) / mark_realm_unlocked(user_id, tea_id) 便捷方法。
4) record_drink_feedback(user_id, tea_id, result, user_words=None, normalized_tags=None, infusion_number=None) -> DrinkFeedback：写库并返回。
5) get_history(user_id) -> list[DrinkFeedback]（供 AI 茶伴回答「上次怎么形容」用）。
时间戳用 datetime.now()（这里是 Python 后端，可用）。
`,
  '参考技术架构第 15 节与 PRD 第 13 节 Tea Passport。'
);

const BREW_PROMPT = SERVICE_TPL(
  'brew-vision',
  'brew_vision',
  `
实现 Brew Vision 服务（对应技术架构第 11 节，demo 用 mock 降级）：
1) BREW_STATES = ["EMPTY","TEA_VISIBLE","POURING","STEEPING","DECANTING","FINISHED"]。
2) analyze_frame(frame_input, step_hint=None) -> dict：返回 { state, confidence, observations[], uncertain[], message }。
   - demo 降级：不真正调用 VLM。若 step_hint 传入（前端给「投茶/注水/等待/出汤/完成」映射到对应 state），则按 hint 返回对应 state + 中文陪伴话术（复刻前端话术风格，如「差不多可以出汤了」「这一泡建议短一些，能让鲜爽感更明显」）。
   - 若未传 hint，按内部轮转或返回 STEEPING + 默认话术。
   - uncertain 里固定含 ["exact water temperature","exact tea amount"]（体现不给伪精确）。
3) 保留 provider 扩展点：函数签名预留 model/backend 参数，注释说明接真实 VLM 时替换 analyze_frame 内部实现。
4) brew_guidance(tea_id) -> brewing_guide（从 tea_profile 取）。
`,
  '参考技术架构第 11 节 AI Brew Companion 与 PRD 第 10 节 Brew Mode。'
);

const TASTING_PROMPT = SERVICE_TPL(
  'tasting',
  'tasting',
  `
实现 Tasting Conversation 服务（对应技术架构第 13 节，demo 用 mock 降级）：
1) normalize(user_words) -> { user_words, normalized[], explanation }：
   demo 降级：用关键词→茶描述词映射（规则），例如「青草/嫩」→ fresh/嫩香，「甜」→ aftertaste_sweetness/回甘，「厚」→ body/醇厚，「涩」→ astringency，「香」→ aroma。normalized 返回英文维度 key 列表（与 sensory_vector 维度一致：freshness,sweetness,body,roast,astringency,floral,fruity,clean,aftertaste）。
   explanation 用中文：「你描述的前半段比较接近嫩香/清鲜感，后面那点持续的甜感可以理解成回甘。」（按命中词组合）。
2) 保留 provider 扩展点：签名预留 llm 参数，注释说明接真实 LLM 时用「自然语言→茶专业语言」翻译。
3) 原则：AI 不说「你喝错了」，而是「你刚刚说的感觉，在茶里通常会这样描述」。
`,
  '参考技术架构第 13 节与 PRD 第 11 节 Taste Mode。'
);

const INTEGRATE_PROMPT = `${CTX}

你的职责（Phase 3 · Integrate）：把 services 接成可运行的 FastAPI 后端，并启动验证。

先读（绝对路径）：
- apps/api/main.py、models.py、schemas.py、db.py
- apps/api/services/*.py（tea_profile/recommendation/teabti/memory/brew_vision/tasting 各函数签名）

然后：
1) 在 apps/api/routes/ 下创建路由（每个文件一个 APIRouter，从 schemas 读入、调 service）：
   - feed.py: GET /api/feed?user_id=... -> 返回 cold_start 或个性化 feed 的茶列表
   - swipe.py: POST /api/swipe {user_id, tea_id, action} -> 调 recommendation.update_taste_profile，返回 { taste_profile_delta, next_tea, recommendation_ready }
   - recommendation.py: GET /api/recommendation?user_id=... -> recommend top
   - drink_feedback.py: POST /api/drink-feedback {user_id, tea_id, result, user_words, infusion_number} -> record + 更新 taste profile（真喝反馈高权重）
   - taste.py: POST /api/taste/normalize {user_words} -> tasting.normalize
   - brew.py: POST /api/brew/frame {frame, step_hint} -> brew_vision.analyze_frame
   - passport.py: GET /api/passport?user_id=... 与 POST /api/passport {user_id, tea_id, ...}
   - teabti.py: GET /api/teabti?user_id=... -> teabti.build_teabti
   routes/__init__.py 汇总 router 列表。
2) 完善 main.py：include_router 全部 routes；启动事件里 Base.metadata.create_all + seed；CORS 允许 http://localhost:3000 与 *。
3) 运行验证（用 subprocess 或直接命令行）：
   cd apps/api && 启动 uvicorn main:app --port 8000（后台或短时启动），用 python -c 或 curl 依次请求：
   GET /health、GET /api/feed?user_id=test、POST /api/swipe(like 都匀毛尖)、GET /api/recommendation?user_id=test、POST /api/taste/normalize(「有点像青草，但没那么冲，喝完还有一点甜」)、POST /api/brew/frame(step_hint=等待)、GET /api/passport?user_id=test、GET /api/teabti?user_id=test
   记录每个端点返回是否 200 与关键字段。若有报错（import 错误、schema 不符、SQLAlchemy 问题），逐条修复后重试，直到全部 200。
   （若 uvicorn 因端口占用失败，改用 8001；若无法长时间起服务，至少保证 python -c "from main import app" 成功 + 用 fastapi TestClient 做一轮请求验证。）

完成后返回结构化报告：
- 是否全部端点可用（200）
- 每个端点的示例返回摘要
- 修复过的错误清单
- 启动命令（供前端联调用）
`;

phase('Foundation');
const foundation = await agent(FOUNDATION_PROMPT, { label: 'foundation', schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, models: { type: 'string' }, schemas: { type: 'string' }, seedOk: { type: 'boolean' } }, required: ['files'] } });
log('Foundation done: ' + (foundation ? (foundation.files || []).length + ' files' : 'null'));

phase('Services');
const services = await parallel([
  () => agent(RECOMMENDATION_PROMPT, { label: 'svc-recommendation' }),
  () => agent(TEABTI_PROMPT, { label: 'svc-teabti' }),
  () => agent(MEMORY_PROMPT, { label: 'svc-memory' }),
  () => agent(BREW_PROMPT, { label: 'svc-brew-vision' }),
  () => agent(TASTING_PROMPT, { label: 'svc-tasting' }),
]);
log('Services done: ' + services.filter(Boolean).length + '/5');

phase('Integrate');
const integrate = await agent(INTEGRATE_PROMPT, { label: 'integrate-verify', schema: { type: 'object', properties: { allEndpointsOk: { type: 'boolean' }, endpoints: { type: 'string' }, errors: { type: 'array', items: { type: 'string' } }, runCommand: { type: 'string' } }, required: ['allEndpointsOk'] } });

return {
  foundation,
  services: services.filter(Boolean).length,
  integrate,
};

Model: gemini-4-argon
Effort: medium
Date: 2026-11-14

---

**English prompt:** Act as a senior neuroimaging and electrophysiology researcher experienced in scientific data infrastructure and product design. Critically review the following "Brain Datasets Information Hub" proposal draft without pleasantries: (1) answer all 7 questions in Section 9 point by point; (2) identify the 3 weakest points in the proposal and provide concrete fixes; (3) point out omitted competitors, datasets, or metadata standards (flag any uncertainties); and (4) state the single most important thing to ensure Phase 1 succeeds. Respond in Chinese within 1,500 characters, outputting only the review text without creating or modifying any files.

---

### 一、第 9 节 7 个问题逐条回答

1. **定位与差异化**：**成立且痛点极准**。科研人员（尤其博士生和青年 PI）最痛的不是找不到数据集名字，而是卡在 DUA 盖章、伦理前置、中国人类遗传资源（HGR）审批、云分析强制绑定和排队周期。把“申请通关指南”做成结构化一等公民，比泛泛的目录有不可替代的价值。
2. **数据模型字段**：
   - **缺失（关键）**：① **预处理衍生品（Derivatives）清单**（是否有 FreeSurfer/fMRIPrep/MNE 结果，这直接决定计算成本和下载体量）；② **数据出境与主权限制**（GDPR、中国科技部人遗办审批、是否允许跨境访问或仅限本地机构）；③ **计算环境绑定**（能否下载到本地，还是必须用 UKB RAP 等付费云端沙箱）；④ **授权有效期与续期条件**。
   - **多余/应降级**：“扫描/采集参数摘要”在多站点/长纵向队列（如 ADNI、ABCD）内部差异极大，第一阶段强行结构化会失真，建议改为“典型协议链接 + 模态标签”。
   - **必填项**：`id`、名称、模态、样本量、访问级别、是否可下载到本地、申请步骤、资格（是否需机构公章/PI 身份/伦理批件）、费用档位、`last_verified`、`sources[]`。
3. **种子数据集选择**：覆盖面总体合理，但**缺少高频标杆与睡眠/临床电生理代表**。把 30 个做好远胜铺摊子，建议微调（具体补漏见第三部分）。
4. **技术选型**：**Astro + YAML + GitHub Pages 非常适合第一阶段**。但有两点隐患：① Pagefind 是纯全文检索，不支持“样本量 > 500 且无需机构签字且含 3T fMRI”的多维数值/布尔组合过滤——前端必须直接加载编译好的精简 `datasets.json`（30~300 条仅几十到几百 KB）做客户端 faceted 过滤；② GitHub Pages 在国内访问不稳定，务必同步部署 Cloudflare Pages 或 Vercel。
5. **第一阶段最大风险与范围**：最大风险是**“只摘抄了官网表面说明，没写出真正卡脖子的隐性门槛”**（例如某库虽写免费开放，但要求所在高校在白名单内，或签约法务流程极严）。范围**切勿再扩，甚至应砍掉第一阶段末的 AI 助手和中英双语全量翻译**（先专注中文痛点 + 英文专有名词，把 30 个数据集的“通关攻略”写透）。
6. **第二阶段社区共建**：别自己写账号和后台审核系统！科研人员最反感为填一条耗时去注册新网站。直接用 **GitHub Discussions / Issue Form 表单 → GitHub Action 自动转 PR**，或嵌入免登录的极简问卷（附机构邮箱验证防刷）。激励机制靠学术署名（贡献者鸣谢榜、数据集卡片显示 Verified by 某学者主页）和“查别人耗时前先匿名填一次自己的申请经历”。
7. **研究问题咨询助手**：架构设计（前置 JSON 过滤 + 塞入上下文 + 严禁库外推荐 + Serverless 代理）技术上合理，但**坚决反对放在第一阶段**。仅有 30 个数据集时，多维筛选器（Faceted Search）3 秒就能筛出结果，AI 助手纯属伪需求且分散精力；应放到数据集 > 150 个的**第二阶段中后期**。此外，第三阶段的“LLM 自动抽取官方页面”应**提早到第一阶段作为你个人的本地录入脚本**，帮你快速生成 30 个 YAML 初稿。

---

### 二、方案中最薄弱的 3 个地方及具体改法

1. **薄弱点 1：把“官方网页抓取”当成申请流程维护的主要手段**
   - **原因**：各大受控库（NDA、ADNI、UKB）真正的卡点藏在登录后的申请系统、PDF 附件协议和邮件往返里，且都有强反爬，定时爬虫既抓不到核心变化，又极易报错。
   - **改法**：放弃复杂爬虫，改为：① CI 定期对公开 URL 做轻量化文本 Hash 比对（变了就发 Issue 提醒人工看）；② 重点建设每条数据集下的**“国内高校/科研院所申请踩坑笔记”**（如“国内某 985 盖章找科研院还是设备处”、“人遗办备案实操经验”），这才是竞品抄不走的护城河。
2. **薄弱点 2：搜索与对比忽略了神经数据的“子集/版本/衍生品”层级**
   - **原因**：数据集不是扁平的单条记录。例如 HCP 有 S1200、Development、Aging、7T 子集；很多用户只想下载几 GB 的连接矩阵或 fMRIPrep 预处理结果，而非几十 TB 原始 DICOM/NIfTI。
   - **改法**：YAML 数据模型中增加 `releases/subsets[]` 和 `available_derivatives[]`（如 `["FreeSurfer", "fMRIPrep", "Connectivity Matrix"]`），并在访问级别上区分“原始数据”与“汇总/衍生数据”的获取难度。
3. **薄弱点 3：路线图资源错配（过早考虑建库/账号/AI，低估种子内容深度）**
   - **原因**：从静态 YAML 迁 PostgreSQL、做账号系统会吞噬大量工程时间，导致数据集内容停留在“高级版书签”。
   - **改法**：砍掉第二阶段的数据库与账号开发，全周期保持 **Git/YAML 作为唯一数据源（Single Source of Truth）**；用静态 JSON 驱动前端多维筛选与对比表。

---

### 三、遗漏的重要竞品、数据集与元数据标准

- **遗漏竞品**：
  1. **Dementia Platforms UK (DPUK) / AD Workbench (ADDI)**：阿尔茨海默病与队列数据的跨库发现与统一申请入口，直接涉及受控数据申请流。
  2. **NITRC-IR / BrainLife.io / Courtois NeuroMod**：兼具数据分发与在线计算的平台。
  3. **Scicrunch (RRID Portal) / FAIRsharing.org**：科研资源与标准注册库。
  4. **OpenBHB**（脑龄预测多站点聚合，自带复杂的衍生数据许可约束）。
- **遗漏关键数据集**：
  1. **纵向/认知标杆**：**PREVENT-AD**、**AIBL**、**PING**、**IMAGEN**（青少年纵向多中心，受控申请典型代表）。
  2. **自然刺激/高场/基础标杆**：**Forrest Gump**、**THINGS (EEG/MEG/fMRI)**（当前视觉与表征学习最火数据集）、**Midnight Scan Club (MSC)**（精密个体扫描标杆）。
  3. **电生理/睡眠**：**NSRR（美国国家睡眠研究资源库，含 SHHS 等）**、**TDBRAIN**、**SLEEP-EDF**。
  4. **中国数据集**：**Direct / REST-meta-SCZ**（严超赣团队系列）、**HCPD/HCPA 对应的国内公开队列**、**Chinese Color Nest Project (CCNP 已列，建议加上北京师范大学 BABRI 老年脑健康队列——注：公开程度需核实)**。
- **遗漏元数据标准**：
  1. **DUO (Data Use Ontology，GA4GH 标准)**：国际生物医学受控数据最核心的“数据使用限制”标准词表（如 GRU 一般研究使用、HMB 健康医疗生物医学限制、NPU 非营利限制），**强烈建议直接引入替代自定义的限制字段**。
  2. **NIDM (Neuroimaging Data Model)** 与 **HED (Hierarchical Event Descriptors)**：任务范式与事件标记标准（HED 在 EEG/BIDS 中尤为重要）。

---

### 四、如果只能做一件事让第一阶段成功

**死磕 15~20 个最难申请的高价值受控/中国数据集（UKB、ABCD、ADNI、HCP 受控表型、CHCP、CHIMGEN、REST-meta-MDD 等），写出全网最详尽、精确到“国内高校哪个部门签字、每一步填表截图/避坑指南、真实排队周数、能不能下到本地硬盘”的中文实操通关手册，并做出一个支持按“模态 + 样本量 + 能否本地下载 + 是否需机构签字”秒级过滤的对比表格。** 只要这一张表和 20 篇攻略能帮博士生省下两周查资料和走弯路的时间，第一阶段就会在课题组微信群里自发传播。

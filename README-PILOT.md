# 预实验专用版本（Pilot Test Version）运行说明

> 独立于生产主站，通过 `pilot.html` 多页面入口加载，**生产主站 `index.html` 完全不受影响**。
> 全部预实验代码位于 `src/pilot/` 目录。

---

## 一、如何运行

### 方式 A：本地开发（Vite dev server）

```bash
npm install        # 首次安装依赖
npm run dev        # 启动开发服务器 http://localhost:3000
```

浏览器访问预实验页面：

```
http://localhost:3000/pilot.html
```

生产主站仍在：

```
http://localhost:3000/
```

### 方式 B：生产构建

```bash
npm run build      # 产物 dist/ 同时包含 index.html 与 pilot.html
npm run preview    # 预览 http://localhost:3000
```

### 方式 C：部署（Vercel / Netlify）

直接推送到现有仓库即可。`vercel.json` / `netlify.toml` 已新增 `/pilot.html` 路由例外，
保证 SPA 兜底重写不会吞掉预实验页面。部署后访问：

```
https://你的域名/pilot.html
```

---

## 二、如何配置云端接收接口 URL

数据上传端点通过环境变量 `VITE_PILOT_DATA_ENDPOINT` 配置（Vite 前端环境变量）。

### 本地开发

在 `杯子/` 目录新建 `.env.local`：

```bash
VITE_PILOT_DATA_ENDPOINT=https://你的接收端点地址
```

`.env.local` 已被 `.gitignore` 排除，不会上传仓库。

### Vercel 部署

Settings → Environment Variables 添加：

```
Key:   VITE_PILOT_DATA_ENDPOINT
Value: https://你的接收端点地址
```

### Netlify 部署

Site settings → Environment variables 添加同名变量。

### 端点格式要求

系统会向该地址发送 `POST` 请求，`Content-Type: application/json`，
Body 为完整 Payload（见下），你的接收端需能接收 JSON POST。

支持以下常见端点：
- **飞书 Webhook**（`https://open.feishu.cn/open-apis/bot/v2/hook/你的TOKEN`）— 自动兼容，见下
- **Formspree**（`https://formspree.io/f/你的表单ID`）
- **自定义后端接口**（任一可接收 JSON POST 的 URL）

> **未配置端点时**：系统跳过上传，自动触发"防丢下载"（后台静默下载 CSV + JSON 备份文件），
> 数据仍 100% 可回收，不会报错。

### 飞书 Webhook（自动兼容）

当 `VITE_PILOT_DATA_ENDPOINT` 指向 `open.feishu.cn` 时，代码自动把 Payload
封装成飞书消息格式（`{msg_type, content}`），内容为 **精简摘要 + 完整 CSV**，
过长自动分条发送，无需任何代码改动。

飞书机器人侧若开启「自定义关键词」安全校验，**每条消息正文必须包含该关键词**：

| 项目 | 值 |
|------|-----|
| 默认关键词 | `汇报`（消息正文以 `【汇报】` 开头） |
| 覆盖关键词 | 环境变量 `VITE_PILOT_FEISHU_KEYWORD`（须与飞书机器人设置一致） |

> 建议飞书侧选择「自定义关键词」而非「加签/IP白名单」：关键词最省事，
> 且系统已默认带上；「加签」需额外签名逻辑，「IP 白名单」因被试 IP 不固定不适用。

---

## 三、预实验版功能清单

---

## 三、预实验版功能清单

| 功能 | 实现位置 |
|------|---------|
| A/B/C 固定试卷拆分（dsh/hr/zxy 各 6A+10B） | `src/pilot/pilotPaper.js` |
| 三保险分流：URL `?form=X` 硬指定 → 时间戳轮询 | `src/pilot/pilotStore.jsx` `assignFormType()` |
| 20 点精力 + 材料包/规范解锁 + Jaccard 评分 + RES + 行为日志 | 复用生产评分引擎 `src/utils/scoringEngine.js` |
| 模块 A 呈现顺序随机化 | `src/pilot/pilotPaper.js` |
| 精力扣除二次确认弹窗（防误触） | `src/pilot/components/PilotConfirmModal.jsx` |
| 极简指导语 + 模块 B 过渡页 | `src/pilot/pages/` |
| 切屏监控（page_blur）+ 大段粘贴监控（bulk_paste） | `src/pilot/pilotStore.jsx` |
| 云端静默上传（3 次重试 + 防丢下载） | `src/pilot/pilotUpload.js` |
| 极简感恩完成页（屏蔽分数/维度/画像） | `src/pilot/pages/PilotCompletionPage.jsx` |
| 对齐字段导出（Form_Type / Blur/Paste 计数 / 全量日志） | `src/pilot/pilotExport.js` |

### 分发链接示例（控制样本量）

主试可把以下三个链接分发给不同批次被试：

```
https://你的域名/pilot.html?form=A
https://你的域名/pilot.html?form=B
https://你的域名/pilot.html?form=C
```

无参数访问时系统按时间戳轮询（A→B→C 交替）自动分流，样本量趋近 1:1:1。

---

## 四、上传 Payload 字段（对齐结构）

```
subjectId, name, role, startTime, endTime, timeUsedSec,
formType (A/B/C), formLabel (Form_A/Form_B/Form_C),
pageBlurCount, bulkPasteCount,
scores: { scoreA, scoreB, resScore, totalScore, energyRemaining, dimensions },
moduleA: { questionsInfo, responses },
moduleB: { questionsInfo, responses },
behavioralLogs（全量行为日志）, behavioralLogsJson,
csvText（含全部对齐字段的 CSV 文本）
```

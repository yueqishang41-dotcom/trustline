/**
 * 云端静默自动上传 + 防丢备份。
 *
 * 端点配置：环境变量 VITE_PILOT_DATA_ENDPOINT
 *   - 本地：新建 .env.local 写入  VITE_PILOT_DATA_ENDPOINT=你的端点URL
 *   - Vercel / Netlify：在平台 Environment Variables 里配置同名变量
 * 未配置端点时：跳过上传，仅生成备份文件（自动下载），数据仍 100% 可回收。
 *
 * ── 飞书 Webhook 兼容 ─────────────────────────────────────────────
 * 当 VITE_PILOT_DATA_ENDPOINT 指向 open.feishu.cn（自定义机器人 Webhook）时，
 * 自动切换为飞书消息格式 {msg_type, content}（飞书不接受任意 JSON）。
 * 若在飞书机器人里开启了「自定义关键词」安全校验，每条消息正文必须包含该关键词：
 *   默认关键词为「汇报」，可用环境变量 VITE_PILOT_FEISHU_KEYWORD 覆盖（与飞书设置保持一致）。
 * 消息内容 = 精简摘要 + 完整 CSV（过长自动切分成多条，每条都带关键词）。
 * 全部发送失败时仍会触发「防丢下载」兜底。
 */
import { buildCSV, buildPayload } from './pilotExport';

const ENDPOINT = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PILOT_DATA_ENDPOINT) || '';
const FEISHU_KEYWORD = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PILOT_FEISHU_KEYWORD) || '汇报';
// Netlify 收集器可选鉴权 token（需与服务器端 PILOT_COLLECT_TOKEN 一致）
const COLLECT_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PILOT_COLLECT_TOKEN) || '';

const MAX_ATTEMPTS = 3;

export function getEndpoint() {
  return ENDPOINT;
}

/**
 * 生成 CSV 文本（与导出一致）。
 */
export function toCSV(results) {
  return buildCSV(results);
}

/** 判断是否为飞书自定义机器人 Webhook */
function isFeishuEndpoint(url) {
  try {
    const u = new URL(url);
    return /(^|\.)feishu\.cn$/i.test(u.hostname) || /\/bot\/v2\/hook\//i.test(u.pathname);
  } catch (e) {
    return false;
  }
}

/** 组装飞书文本消息正文：关键词 + 精简摘要 + 完整 CSV */
function buildFeishuMessage(payload) {
  const dims = payload.scores?.dimensions || {};
  const lines = [
    `【${FEISHU_KEYWORD}】`,
    `被试ID: ${payload.subjectId || ''}`,
    `姓名: ${payload.name || ''}`,
    `角色: ${payload.role || ''}`,
    `卷型: ${payload.formLabel || ('Form_' + (payload.formType || 'A'))}`,
    `开始时间: ${payload.startTime || ''}`,
    `结束时间: ${payload.endTime || ''}`,
    `总耗时(秒): ${payload.timeUsedSec ?? ''}`,
    `剩余精力: ${payload.scores?.energyRemaining ?? ''}`,
    `切屏次数: ${payload.pageBlurCount ?? 0}`,
    `大段粘贴次数: ${payload.bulkPasteCount ?? 0}`,
    `A卷原始分: ${payload.scores?.scoreA ?? ''}`,
    `B卷原始分: ${payload.scores?.scoreB ?? ''}`,
    `RES分数: ${payload.scores?.resScore ?? ''}`,
    `最终总分: ${payload.scores?.totalScore ?? ''}`,
    `校准依赖维度: ${dims.calibratedReliance ?? ''}`,
    `核验监督维度: ${dims.verificationSupervision ?? ''}`,
    `合规边界维度: ${dims.complianceBoundary ?? ''}`,
    '',
    '===== CSV 完整数据（含行为日志） =====',
    payload.csvText || '',
  ];
  return lines.join('\n');
}

/** 按最大长度切分；续段每条都补上关键词，满足飞书「自定义关键词」逐条校验 */
function chunkFeishuText(text, maxLen = 28000) {
  const chunks = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks.map((c, i) => (i === 0 ? c : `【${FEISHU_KEYWORD}】(续)\n${c}`));
}

/** 发送一条飞书文本消息，失败重试 MAX_ATTEMPTS 次 */
async function postFeishuText(chunk) {
  const body = JSON.stringify({ msg_type: 'text', content: { text: chunk } });
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) return null;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(1200 * attempt);
    }
  }
  return lastErr;
}

/** 飞书路径：摘要 + CSV 全文，分批发送 */
async function uploadFeishu(payload) {
  const text = buildFeishuMessage(payload);
  const chunks = chunkFeishuText(text);
  let attempts = 0;
  for (const chunk of chunks) {
    const err = await postFeishuText(chunk);
    attempts += MAX_ATTEMPTS;
    if (err) return { ok: false, attempts, backup: false, reason: err.message };
  }
  return { ok: true, attempts, backup: false };
}

/**
 * 静默上传：失败自动重试（最多 3 次），仍失败则触发防丢下载。
 * 返回 Promise<{ok:boolean, attempts:number, backup:boolean}>
 */
export async function uploadResults(results) {
  if (!ENDPOINT) {
    // 无端点配置：直接进入防丢备份（后台静默下载）
    triggerBackupDownload(results);
    return { ok: false, attempts: 0, backup: true, reason: 'NO_ENDPOINT' };
  }

  const payload = buildPayload(results);

  // 飞书 Webhook：走飞书消息格式
  if (isFeishuEndpoint(ENDPOINT)) {
    const r = await uploadFeishu(payload);
    if (!r.ok) triggerBackupDownload(results);
    return r;
  }

  // 通用 JSON 端点（含 Netlify 收集器）：保持原有行为，可选携带收集器 token
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (COLLECT_TOKEN) headers['x-collect-token'] = COLLECT_TOKEN;
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true, attempts: attempt, backup: false };
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(1200 * attempt); // 递增退避：1.2s / 2.4s / (放弃后备份)
    }
  }
  // 全部失败 → 触发防丢下载备份
  triggerBackupDownload(results);
  return { ok: false, attempts: MAX_ATTEMPTS, backup: true, reason: lastErr && lastErr.message };
}

/**
 * 防丢备份：后台静默下载 CSV + JSON 两个文件。
 */
function triggerBackupDownload(results) {
  try {
    const csv = buildCSV(results);
    const json = JSON.stringify(buildPayload(results), null, 2);
    download(csv, `Pilot_Backup_${results.subjectId || 'export'}_${results.formLabel || 'Form'}.csv`, 'text/csv;charset=utf-8');
    download(json, `Pilot_Backup_${results.subjectId || 'export'}_${results.formLabel || 'Form'}.json`, 'application/json');
  } catch (e) {
    // 静默，不影响主流程
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function download(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

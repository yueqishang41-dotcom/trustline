/**
 * 预实验数据导出（Netlify Function）。
 *
 * 把 pilot-collect 收集的全部数据导出：
 *   - 默认 /  ?format=csv  → 宽表 CSV（每人一行，含核心对齐字段 + 逐题得分/作答 + 全量行为日志）
 *   -      ?format=json   → 完整 JSON 数组（最高保真，供 R/Python/SPSS 深入分析）
 *
 * 访问示例：
 *   https://你的站点.netlify.app/.netlify/functions/pilot-export          （CSV）
 *   https://你的站点.netlify.app/.netlify/functions/pilot-export?format=json
 * 若设置了环境变量 PILOT_EXPORT_TOKEN，访问需加 ?token=你的TOKEN
 */
import { getStore } from '@netlify/blobs';

const STORE = 'pilot-data';

export async function handler(event) {
  try {
    // 鉴权：PILOT_EXPORT_TOKEN 设置后必须携带正确 token 才能下载
    const exportToken = process.env.PILOT_EXPORT_TOKEN;
    const qp = event.queryStringParameters || {};
    const given = (qp.token || '').trim() || (event.headers['x-collect-token'] || '').trim();
    if (exportToken && given !== exportToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }

    // 读取全部存储数据
    const store = getStore(STORE);
    const payloads = [];
    let cursor;
    do {
      const page = await store.list({ cursor });
      for (const blob of page.blobs || []) {
        try {
          const raw = await store.get(blob.key, { type: 'text' });
          payloads.push(JSON.parse(raw));
        } catch (e) { /* 跳过损坏项 */ }
      }
      cursor = page.cursor;
    } while (cursor);

    // 按开始时间排序
    payloads.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    const fmt = (qp.format || 'csv').toLowerCase();
    if (fmt === 'json') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="pilot-data.json"',
        },
        body: JSON.stringify(payloads, null, 2),
      };
    }

    const csv = buildWideCSV(payloads);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': 'attachment; filename="pilot-data.csv"',
      },
      body: csv,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err && err.message || err) }) };
  }
}

/* ---------------- 宽表 CSV 构建 ---------------- */

/** 自然排序：先按来源（dsh/hr/zxy）再按模块再按题号数字 */
const PREFIX_ORDER = { dsh: 0, hr: 1, zxy: 2 };
function idSortKey(id) {
  const m = String(id).match(/^(.*)-([A-Z])(\d+)$/);
  if (!m) return String(id);
  return `${PREFIX_ORDER[m[1]] ?? 9}-${m[2]}-${String(Number(m[3])).padStart(2, '0')}`;
}

function esc(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildWideCSV(payloads) {
  const coreHeaders = [
    'Subject_ID', 'Name', 'Role', 'Start_Time', 'End_Time', 'Time_Used_Sec', 'Form_Type',
    'Page_Blur_Count', 'Bulk_Paste_Count',
    'Score_A_Raw', 'Score_B_Raw', 'RES_Score', 'Total_Score', 'Energy_Remaining',
    'Dim_Calibrated_Reliance', 'Dim_Verification_Supervision', 'Dim_Compliance_Boundary',
    'Behavioral_Logs_JSON',
  ];

  // 收集全部出现的逐题 ID（并集，含 A/B 两模块）
  const aIds = new Set();
  const bIds = new Set();
  for (const p of payloads) {
    for (const qs of (p.scores?.aQuestionScores || [])) if (qs.id) aIds.add(qs.id);
    for (const qs of (p.scores?.bQuestionScores || [])) if (qs.id) bIds.add(qs.id);
  }
  const aIdList = [...aIds].sort((x, y) => idSortKey(x).localeCompare(idSortKey(y)));
  const bIdList = [...bIds].sort((x, y) => idSortKey(x).localeCompare(idSortKey(y)));

  const aHeaders = [];
  for (const id of aIdList) {
    for (const h of ['total', 'correctness', 'evidence', 'compliance', 'resource']) aHeaders.push(`${id}__${h}`);
    aHeaders.push(`${id}__final_len`, `${id}__edit`);
  }
  const bHeaders = [];
  for (const id of bIdList) bHeaders.push(`${id}__score`, `${id}__choice`, `${id}__dimension`);

  const header = [...coreHeaders, ...aHeaders, ...bHeaders];
  const rows = [];

  for (const p of payloads) {
    const s = p.scores || {};
    const d = s.dimensions || {};
    const aScoreMap = {};
    for (const qs of (s.aQuestionScores || [])) aScoreMap[qs.id] = qs;
    const bScoreMap = {};
    for (const qs of (s.bQuestionScores || [])) bScoreMap[qs.id] = qs;
    const aRespMap = p.moduleA?.responses || {};
    const bRespMap = p.moduleB?.responses || {};

    const row = [
      p.subjectId ?? '', p.name ?? '', p.role ?? '',
      p.startTime ?? '', p.endTime ?? '', p.timeUsedSec ?? '',
      p.formLabel ?? ('Form_' + (p.formType || 'A')),
      p.pageBlurCount ?? 0, p.bulkPasteCount ?? 0,
      s.scoreA ?? '', s.scoreB ?? '', s.resScore ?? '', s.totalScore ?? '',
      s.energyRemaining ?? '',
      d.calibratedReliance ?? '', d.verificationSupervision ?? '', d.complianceBoundary ?? '',
      JSON.stringify(p.behavioralLogs || []),
    ];

    for (const id of aIdList) {
      const qs = aScoreMap[id];
      if (qs) {
        row.push(qs.total ?? '', qs.correctness ?? '', qs.evidenceBoundary ?? '', qs.compliance ?? '', qs.resourceEfficiency ?? '');
      } else {
        row.push('', '', '', '', '');
      }
      const resp = aRespMap[id];
      const finalText = (resp && resp.editedText) || '';
      row.push(finalText.length, resp?.actionsUsed?.editPerformed ? 1 : 0);
    }

    for (const id of bIdList) {
      const qs = bScoreMap[id];
      const resp = bRespMap[id];
      row.push(qs ? (qs.score ?? '') : '');
      row.push(resp ? (resp.selectedText ?? resp.selectedIndex ?? '') : '');
      row.push(qs ? (qs.dimension || '') : '');
    }

    rows.push(row);
  }

  return '﻿' + header.map(esc).join(',') + '\n' + rows.map((r) => r.map(esc).join(',')).join('\n');
}

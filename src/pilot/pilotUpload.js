/**
 * 云端静默自动上传 + 防丢备份。
 *
 * 端点配置：环境变量 VITE_PILOT_DATA_ENDPOINT
 *   - 本地：新建 .env.local 写入  VITE_PILOT_DATA_ENDPOINT=你的端点URL
 *   - Vercel / Netlify：在平台 Environment Variables 里配置同名变量
 * 未配置端点时：跳过上传，仅生成备份文件（自动下载），数据仍 100% 可回收。
 */
import { buildCSV, buildPayload } from './pilotExport';

const ENDPOINT = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PILOT_DATA_ENDPOINT) || '';

export function getEndpoint() {
  return ENDPOINT;
}

/**
 * 生成 CSV 文本（与导出一致）。
 */
export function toCSV(results) {
  return buildCSV(results);
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

  const MAX_ATTEMPTS = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

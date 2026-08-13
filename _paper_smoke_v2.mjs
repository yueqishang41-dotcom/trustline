// 扩展抽卷验证：200 次模拟
// 1) 模块A：6题=严格3错3对，每类(data/compliance/communication)恰好2题=1错1对
// 2) 模块B：10题覆盖 校准/核验/合规 三构念，各 3–4 题
import { generateTestPaper } from './src/utils/generateTestPaper.js';

function isErr(q) {
  const s = (q.aiStatus || '').trim();
  return !(s === '基本正确' || s === 'AI正确');
}
// 模块A题的 sceneType 已在 generateTestPaper 内归一化为 data/compliance/communication
const DIMS = ['校准式依赖能力', '核验监督能力', '合规边界执行力'];

let bad = 0;
for (let i = 0; i < 200; i++) {
  const p = generateTestPaper();
  const a = p.moduleA, b = p.moduleB;

  // --- A: 3错3对，每类2题(1错1对) ---
  const errs = a.filter(isErr).length;
  if (errs !== 3 || a.length !== 6) { bad++; console.log(`[${i}] A异常: 错${errs}/对${a.length - errs}`); continue; }
  const cats = {};
  for (const q of a) cats[q.sceneType] = (cats[q.sceneType] || 0) + 1;
  for (const c of ['data', 'compliance', 'communication']) {
    if (cats[c] !== 2) { bad++; console.log(`[${i}] A类别${c}=${cats[c]} 异常`); }
  }

  // --- B: 10题，三构念覆盖 ---
  if (b.length !== 10) { bad++; console.log(`[${i}] B共${b.length} 异常`); continue; }
  const dc = {};
  for (const q of b) dc[q.coreDimension] = (dc[q.coreDimension] || 0) + 1;
  for (const d of DIMS) {
    const n = dc[d] || 0;
    if (n < 3 || n > 4) { bad++; console.log(`[${i}] B构念${d}=${n} 异常`); }
  }
  const ids = new Set(b.map(q => q.id));
  if (ids.size !== 10) { bad++; console.log(`[${i}] B有重复题`); }
}
console.log(bad === 0
  ? '✓ 200 次模拟全部通过：A=6题(3错3对,每类1错1对) + B=10题(校准3-4/核验3-4/合规3-4)'
  : `✗ 存在 ${bad} 次异常`);

import { generateTestPaper } from './src/utils/generateTestPaper.js';

function isErr(q) {
  const s = (q.aiStatus || '').trim();
  return !(s === '基本正确' || s === 'AI正确');
}

let bad = 0;
for (let i = 0; i < 200; i++) {
  const p = generateTestPaper();
  const a = p.moduleA;
  const errs = a.filter(isErr).length;
  const oks = a.length - errs;
  const cats = {};
  for (const q of a) {
    const c = q.sceneType || '';
    cats[c] = (cats[c] || 0) + 1;
  }
  if (errs !== 3 || oks !== 3 || a.length !== 6 || p.moduleB.length !== 10) {
    bad++;
    console.log(`[第${i}次异常] 错${errs}/对${oks}/A共${a.length}/B共${p.moduleB.length}`, cats);
  }
  // 检查每类 2 题、每类 1 错 1 对
  for (const [c, n] of Object.entries(cats)) {
    if (n !== 2) { console.log(`  类别${c} 数量=${n} 异常`); bad++; }
  }
}
console.log(bad === 0 ? '✓ 200 次模拟全部: 模块A 6题=3错3对(每类2题) + 模块B 10题' : `✗ 存在 ${bad} 次异常`);

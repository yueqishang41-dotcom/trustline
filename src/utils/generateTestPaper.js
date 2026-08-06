import itemBank from '../data/itemBank.json' with { type: 'json' };

function norm(t) {
  if (!t) return 'unknown';
  if (/数据/.test(t)) return 'data';
  if (/制度|合规/.test(t)) return 'compliance';
  if (/沟通|对外/.test(t)) return 'communication';
  return 'unknown';
}

function aiHasError(q) {
  const s = (q.aiStatus || '').trim();
  if (s === '基本正确' || s === 'AI正确') return false;
  if (s !== '' && s !== '基本正确' && s !== 'AI正确') return true;
  const d = q.aiDraft || '';
  if (d.startsWith('[AI正确]')) return false;
  if (d.startsWith('[AI错误]')) return true;
  return false;
}

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function generateTestPaper() {
  // IDs are already unique in the JSON (e.g. "dsh-A1", "hr-A1")
  const allA = (itemBank.moduleA.questions || []).map(q => ({
    ...q,
    sceneType: norm(q.sceneType),
  }));
  const allB = (itemBank.moduleB.questions || []).map(q => ({
    ...q,
    options: (q.options || []).filter(o => o.text && o.text.trim() !== ''),
  }));

  // --- Module A: strictly stratified selection ---
  // HARD RULES:
  //   每类 (data / compliance / communication) 严格抽 2 题
  //   全局错误题 3 道、正确题 3 道
  const CATS = ['data', 'compliance', 'communication'];
  const byCat = { data: [], compliance: [], communication: [] };
  for (const q of allA) {
    if (byCat[q.sceneType]) byCat[q.sceneType].push(q);
  }

  // Each category draws exactly 2 questions. dist[i] = #error questions drawn from category i.
  // Possible error distributions summing to 3 across 3 categories, each 0..2:
  const DISTRIBUTIONS = [
    [2, 1, 0], [2, 0, 1],
    [1, 2, 0], [1, 1, 1], [1, 0, 2],
    [0, 2, 1], [0, 1, 2],
  ];

  let selectedA = null;

  // Try random feasible distribution until one works
  const distPool = shuffle(DISTRIBUTIONS);
  for (const dist of distPool) {
    const attempt = [];
    let feasible = true;
    for (let i = 0; i < CATS.length; i++) {
      const cat = CATS[i];
      const pool = byCat[cat] || [];
      const errPool = pool.filter(q => aiHasError(q));
      const okPool = pool.filter(q => !aiHasError(q));
      const needErr = dist[i];
      const needOk = 2 - needErr;
      if (errPool.length < needErr || okPool.length < needOk) {
        feasible = false;
        break;
      }
      attempt.push(...shuffle(errPool).slice(0, needErr));
      attempt.push(...shuffle(okPool).slice(0, needOk));
    }
    if (feasible) {
      selectedA = attempt;
      break;
    }
  }

  // Safety fallback: if no distribution feasible, take 2 from each category anyway
  if (!selectedA) {
    selectedA = [];
    for (const cat of CATS) {
      selectedA.push(...shuffle(byCat[cat] || []).slice(0, 2));
    }
  }

  // --- Module B: random 10 ---
  const selectedB = shuffle(allB).slice(0, 10);

  return {
    moduleA: shuffle(selectedA),
    moduleB: selectedB,
  };
}

export default generateTestPaper;

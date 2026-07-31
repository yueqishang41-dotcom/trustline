import itemBank from '../data/itemBank.json';

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

  // --- Module A: stratified selection ---
  // Goal: 6 questions, 2 per category (data / compliance / communication),
  //        roughly balanced between AI-error and AI-correct
  const byCat = { data: [], compliance: [], communication: [] };
  for (const q of allA) {
    if (byCat[q.sceneType]) byCat[q.sceneType].push(q);
  }

  const CAT_ORDER = ['data', 'compliance', 'communication'];
  const selectedA = [];
  const NEED_TOTAL = 6;
  const NEED_PER_CAT = 2;

  for (const cat of CAT_ORDER) {
    const pool = shuffle(byCat[cat] || []);
    if (pool.length === 0) continue;

    const errPool = pool.filter(q => aiHasError(q));
    const okPool = pool.filter(q => !aiHasError(q));

    // Determine how many error vs correct questions to take from this category
    const takenErr = selectedA.filter(q => aiHasError(q)).length;
    const takenOk = selectedA.filter(q => !aiHasError(q)).length;
    const remainingErrNeeded = Math.min(errPool.length, Math.max(0, 3 - takenErr));
    const remainingOkNeeded = Math.min(okPool.length, Math.max(0, 3 - takenOk));
    const remainingSlots = NEED_TOTAL - selectedA.length;

    // Distribute the slots for this category
    let takeErr = Math.min(remainingErrNeeded, remainingSlots);
    let takeOk = Math.min(remainingOkNeeded, remainingSlots - takeErr);
    // Fill remaining if slots still open
    if (takeErr + takeOk < remainingSlots) {
      const extraErr = Math.min(errPool.length - takeErr, remainingSlots - takeErr - takeOk);
      takeErr += extraErr;
      if (takeErr + takeOk < remainingSlots) {
        takeOk = Math.min(okPool.length - takeOk, remainingSlots - takeErr - takeOk);
      }
    }

    selectedA.push(...shuffle(errPool).slice(0, takeErr));
    selectedA.push(...shuffle(okPool).slice(0, takeOk));
  }

  // --- Module B: random 10 ---
  const selectedB = shuffle(allB).slice(0, 10);

  return {
    moduleA: shuffle(selectedA),
    moduleB: selectedB,
  };
}

export default generateTestPaper;

import itemBank from '../data/itemBank.json';

const rubric = itemBank.scoringRubric;
const params = rubric.resAlgorithm?.parameters || {};
const PASS_LINE = params.S_pass ?? 36;
const GAMMA = params.gamma ?? 0.1;
const E0 = params.E_0 ?? 20;
const MAX_A = 60;
const MAX_B = 20;

/**
 * Compute text similarity (0-1) between two strings.
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const aClean = a.trim();
  const bClean = b.trim();
  if (aClean === bClean) return 1;
  if (aClean.length < 5 || bClean.length < 5) return aClean === bClean ? 1 : 0;
  const setA = new Set(aClean);
  const setB = new Set(bClean);
  const intersection = new Set([...setA].filter(c => setB.has(c)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Score a Module A question with sub-dimension breakdown.
 * Returns { total, correctness, evidenceBoundary, compliance, resourceEfficiency }
 */
export function scoreModuleAQuestion(question, response) {
  if (!response) return { total: 0, correctness: 0, evidenceBoundary: 0, compliance: 0, resourceEfficiency: 0 };

  const { editedText, actionsUsed = {} } = response;
  const originalDraft = question.aiDraft || '';
  const correctOutput = question.correctOutput || '';

  const draftClean = originalDraft.replace(/^\[AI[^\]]*\]\s*/, '').trim();
  const editedClean = (editedText || '').trim();

  const hasSignificantEdit = editedClean.length > 0 &&
    editedClean !== draftClean &&
    textSimilarity(draftClean, editedClean) < 0.95;

  // 1. Correctness & Accuracy (0-3)
  let correctness = 0;
  if (hasSignificantEdit && correctOutput) {
    const sim = textSimilarity(editedClean, correctOutput.trim());
    if (sim > 0.8) correctness = 3;
    else if (sim > 0.6) correctness = 2;
    else if (sim > 0.3) correctness = 1;
    else correctness = 1;
  } else if (hasSignificantEdit) {
    correctness = 2;
  } else {
    correctness = 1;
  }

  // 2. Evidence Boundary (0-3)
  const viewedEvidence = actionsUsed.viewEvidence || false;
  const usedTemplate = actionsUsed.viewTemplate || false;
  const usedRegenerate = actionsUsed.regenerate || false;

  let evidenceBoundary = 0;
  if (viewedEvidence) evidenceBoundary += 1.5;
  if (usedTemplate) evidenceBoundary += 1;
  if (usedRegenerate && !viewedEvidence) evidenceBoundary += 0.5;

  // 3. Compliance Boundary (0-2)
  let compliance = 0;
  if (hasSignificantEdit) compliance += 1;
  if (viewedEvidence || usedTemplate) compliance += 0.5;

  // 4. Resource Efficiency (0-2)
  const totalActions = Object.values(actionsUsed).filter(Boolean).length;
  let resourceEfficiency = 0;
  if (totalActions <= 1) resourceEfficiency = 1.5;
  else if (totalActions === 2) resourceEfficiency = 1;
  else resourceEfficiency = 0.5;

  // Clamp sub-dimensions
  correctness = Math.min(correctness, 3);
  evidenceBoundary = Math.min(evidenceBoundary, 3);
  compliance = Math.min(compliance, 2);
  resourceEfficiency = Math.min(resourceEfficiency, 2);

  const total = Math.min(Math.round((correctness + evidenceBoundary + compliance + resourceEfficiency) * 10) / 10, 10);

  // Build AI scoring rationale for auditability
  const rationale = [];
  if (hasSignificantEdit) {
    rationale.push(`检测到对AI初稿的有效修改（相似度 ${(textSimilarity(draftClean, editedClean) * 100).toFixed(0)}%）`);
  } else {
    rationale.push('未对AI初稿进行实质修改，直接采纳AI输出');
  }
  rationale.push(`交付正确性评分 ${correctness}/3（${correctOutput ? '存在参考答案，按相似度判定' : '无参考答案，按编辑行为奖励'}）`);
  if (viewedEvidence) rationale.push('查阅了原始材料（证据边界 +1.5）');
  if (usedTemplate) rationale.push('查看了工作规范（证据边界 +1）');
  if (usedRegenerate && !viewedEvidence) rationale.push('仅使用重新生成，未查阅证据（证据边界 +0.5）');
  if (hasSignificantEdit) rationale.push('进行了有效修正（合规边界 +1）');
  rationale.push(`共执行 ${totalActions} 项辅助操作（资源效率 ${resourceEfficiency}/2）`);

  return { total, correctness, evidenceBoundary, compliance, resourceEfficiency, rationale };
}

/**
 * Calculate Module A total score (0-60) with per-question breakdown.
 * Returns { total, questions: [{ id, total, correctness, evidenceBoundary, compliance, resourceEfficiency }] }
 */
export function calculateModuleAScore(questions, responses) {
  let total = 0;
  const questionScores = [];
  for (const q of questions) {
    const scored = scoreModuleAQuestion(q, responses[q.id]);
    questionScores.push({ id: q.id, ...scored });
    total += scored.total;
  }
  return { total: Math.min(total, MAX_A), questionScores };
}

/**
 * Calculate Module B total score (0-20) with per-question breakdown.
 * Returns { total, questionScores: [{ id, score, dimension }] }
 */
export function calculateModuleBScore(questions, responses) {
  let total = 0;
  const questionScores = [];
  for (const q of questions) {
    const resp = responses[q.id];
    const score = (resp && resp.selectedScore !== undefined) ? resp.selectedScore : 0;
    total += score;
    questionScores.push({
      id: q.id,
      score,
      dimension: q.coreDimension || '',
    });
  }
  return { total: Math.min(Math.max(total, 0), MAX_B), questionScores };
}

/**
 * Calculate three construct dimension scores from BOTH Module A and Module B.
 *
 * Mapping of Module A rubric sub-scores to the three constructs:
 *   - 校准式依赖 (Calibrated Reliance)      ← correctness + resourceEfficiency
 *   - 核验监督 (Verification Supervision)   ← evidenceBoundary
 *   - 合规边界 (Compliance Boundary)        ← compliance
 *
 * Module B contributes via each question's coreDimension tag.
 *
 * Returns { total, fromA, fromB } per dimension.
 */
export function calculateDimensionScores(aQuestionScores, bQuestionScores) {
  const dims = {
    calibratedReliance: { total: 0, fromA: 0, fromB: 0 },
    verificationSupervision: { total: 0, fromA: 0, fromB: 0 },
    complianceBoundary: { total: 0, fromA: 0, fromB: 0 },
  };
  const counts = { calibratedReliance: 0, verificationSupervision: 0, complianceBoundary: 0 };

  // --- Module A contribution ---
  for (const qs of aQuestionScores || []) {
    dims.calibratedReliance.fromA += (qs.correctness ?? 0) + (qs.resourceEfficiency ?? 0);
    dims.verificationSupervision.fromA += qs.evidenceBoundary ?? 0;
    dims.complianceBoundary.fromA += qs.compliance ?? 0;
  }

  // --- Module B contribution ---
  for (const qs of bQuestionScores || []) {
    const dim = qs.dimension || '';
    let key = null;
    if (dim.includes('校准式依赖')) key = 'calibratedReliance';
    else if (dim.includes('核验监督')) key = 'verificationSupervision';
    else if (dim.includes('合规边界')) key = 'complianceBoundary';

    if (key) {
      dims[key].fromB += qs.score;
      counts[key]++;
    }
  }

  // Sum + round
  for (const key of Object.keys(dims)) {
    dims[key].fromA = Math.round(dims[key].fromA * 10) / 10;
    dims[key].fromB = Math.round(dims[key].fromB * 10) / 10;
    dims[key].total = Math.round((dims[key].fromA + dims[key].fromB) * 10) / 10;
  }

  return {
    calibratedReliance: dims.calibratedReliance,
    verificationSupervision: dims.verificationSupervision,
    complianceBoundary: dims.complianceBoundary,
    calibratedRelianceCount: counts.calibratedReliance,
    verificationSupervisionCount: counts.verificationSupervision,
    complianceBoundaryCount: counts.complianceBoundary,
  };
}

/**
 * Compute RES score.
 */
export function computeRES(rawScoreA, energyRemaining) {
  if (rawScoreA >= PASS_LINE) {
    const bonus = 1 + GAMMA * (energyRemaining / E0);
    return Math.round(rawScoreA * bonus * 100) / 100;
  }
  return rawScoreA;
}

/**
 * Compute total score (0-100).
 */
export function computeTotalScore(resScore, scoreB) {
  const partA = (resScore / MAX_A) * 80;
  const partB = (scoreB / MAX_B) * 20;
  return Math.round((partA + partB) * 100) / 100;
}

/**
 * Determine user profile.
 */
export function determineProfile(scoreA, scoreB, energyRemaining) {
  if (scoreA < PASS_LINE * 0.7 && energyRemaining <= 5) {
    return '盲信风险型 — 对AI输出缺乏有效核验，在AI错误时未能识别修正，容易造成事实性错误与合规风险。';
  }
  if (energyRemaining <= 5 && scoreA >= PASS_LINE * 0.7 && scoreA < PASS_LINE * 1.1) {
    return '过疑低效型 — 虽然完成了修正，但消耗了过多精力点数，资源分配策略有待优化。';
  }
  if (scoreA >= PASS_LINE && energyRemaining >= 10) {
    return '校准良好型 — 在高效核验AI输出与合理分配精力资源之间取得了优秀平衡，具备良好的元认知监控与合规执行力。';
  }
  if (scoreA >= PASS_LINE) {
    return '中等校准型 — 具备一定核验能力，但在资源分配效率或风险敏感度方面仍有提升空间。';
  }
  return '需提升型 — 在AI监督校准与合规执行方面需加强训练，建议关注数据核验、合规边界与精力分配策略。';
}

/**
 * Run full scoring pipeline — returns everything needed for export.
 */
export function runFullScoring(moduleAQuestions, moduleAResponses, moduleBQuestions, moduleBResponses, energyRemaining) {
  const { total: scoreARaw, questionScores: aQuestionScores } = calculateModuleAScore(moduleAQuestions, moduleAResponses);
  const { total: scoreBRaw, questionScores: bQuestionScores } = calculateModuleBScore(moduleBQuestions, moduleBResponses);
  const resScore = computeRES(scoreARaw, energyRemaining);
  const totalScore = computeTotalScore(resScore, scoreBRaw);
  const profile = determineProfile(scoreARaw, scoreBRaw, energyRemaining);
  const dimensions = calculateDimensionScores(aQuestionScores, bQuestionScores);

  // Build drawn question ID strings
  const drawnAIds = moduleAQuestions.map(q => q.id).join(';');
  const drawnBIds = moduleBQuestions.map(q => q.id).join(';');

  // Build per-question score arrays for CSV export
  const aScores = {};
  aQuestionScores.forEach(qs => { aScores[qs.id] = qs.total; });
  const bScores = {};
  bQuestionScores.forEach(qs => { bScores[qs.id] = qs.score; });

  return {
    scoreA: Math.round(scoreARaw * 100) / 100,
    scoreB: Math.round(scoreBRaw * 100) / 100,
    resScore: Math.round(resScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    profile,
    dimensions,
    drawnAIds,
    drawnBIds,
    aScores,          // { 'dsh-A1': 8.5, 'hr-A3': 6.0, ... }
    bScores,          // { 'dsh-B1': 2, 'hr-B3': 1, ... }
    aQuestionScores,  // detailed breakdown with sub-dimensions
    bQuestionScores,  // per-question with dimension tags
  };
}

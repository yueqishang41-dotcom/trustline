/**
 * Export test results as SPSS-compatible CSV (UTF-8 BOM).
 * Includes per-question scores, dimension scores, and drawn item IDs.
 */
export function exportSPSS(results) {
  const BOM = '﻿';

  // Build per-question score columns from the ordered arrays
  const aScores = results.aQuestionScores || [];
  const bScores = results.bQuestionScores || [];
  const dims = results.dimensions || {};

  const aScoreCols = [];
  for (let i = 0; i < 6; i++) {
    aScoreCols.push(aScores[i]?.total ?? '');
  }
  const bScoreCols = [];
  for (let i = 0; i < 10; i++) {
    bScoreCols.push(bScores[i]?.score ?? '');
  }

  const header = [
    'Subject_ID',
    'Name',
    'Role',
    'Start_Time',
    'Time_Used_Sec',
    'Energy_Remaining',
    'Drawn_ModuleA_IDs',
    'Drawn_ModuleB_IDs',
    'A1_Score', 'A2_Score', 'A3_Score', 'A4_Score', 'A5_Score', 'A6_Score',
    'B1_Score', 'B2_Score', 'B3_Score', 'B4_Score', 'B5_Score',
    'B6_Score', 'B7_Score', 'B8_Score', 'B9_Score', 'B10_Score',
    'Dim_Calibrated_Reliance',
    'Dim_Verification_Supervision',
    'Dim_Compliance_Boundary',
    'Score_A_Raw',
    'Score_B_Raw',
    'RES_Score',
    'Total_Score',
    'User_Profile',
    'Behavioral_Logs_Summary',
  ];

  const logSummary = (results.behavioralLogs || [])
    .slice(0, 50)
    .map(l => `${l.action}:${(l.detail || '').substring(0, 30)}`)
    .join('; ');

  const row = [
    results.subjectId,
    results.name,
    results.role,
    results.startTime,
    results.timeUsedSec,
    results.energyRemaining,
    results.drawnAIds || '',
    results.drawnBIds || '',
    ...aScoreCols,
    ...bScoreCols,
    // Support both new {total,fromA,fromB} object format and legacy number format
    (dims.calibratedReliance?.total ?? dims.calibratedReliance ?? ''),
    (dims.verificationSupervision?.total ?? dims.verificationSupervision ?? ''),
    (dims.complianceBoundary?.total ?? dims.complianceBoundary ?? ''),
    results.scoreA,
    results.scoreB,
    results.resScore,
    results.totalScore,
    `"${results.profile || ''}"`,
    `"${logSummary}"`,
  ];

  const csv = BOM + header.join(',') + '\n' + row.join(',');

  downloadFile(csv, `AI_Supervision_Test_${results.subjectId || 'export'}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export full behavioral logs and per-question details as JSON.
 */
export function exportJSON(results) {
  const dims = results.dimensions || {};

  // Build enriched module A response array with metadata
  const moduleADetail = (results.aQuestionScores || []).map(qs => {
    const qMeta = (results.moduleAQuestionsInfo || []).find(q => q.id === qs.id);
    const resp = (results.moduleAResponses || {})[qs.id] || {};
    const draftLen = (qMeta?.aiDraft || '').length;
    const editedLen = (resp.editedText || '').length;
    return {
      questionId: qs.id,
      category: qMeta ? (qMeta.sceneType || '') : '',
      aiStatus: qMeta ? (qMeta.aiStatus || '') : '',
      aiDraftOriginal: qMeta ? (qMeta.aiDraft || '') : '',
      editedTextFinal: resp.editedText || '',
      textLengthChange: editedLen - draftLen,           // 字数变化量 (终稿 - 原稿)
      actionsUsed: resp.actionsUsed || {},
      scoreDetail: {
        aiInitialScore: qs.total ?? 0,                   // AI 初评分
        humanAuditedScore: qs.total ?? 0,                // 人工复核分（默认=初评分，待复核）
        humanAudited: false,                             // 是否已人工复核
        correctness: qs.correctness ?? 0,
        evidenceBoundary: qs.evidenceBoundary ?? 0,
        compliance: qs.compliance ?? 0,
        resourceEfficiency: qs.resourceEfficiency ?? 0,
        totalItemScore: qs.total ?? 0,
      },
    };
  });

  // Build enriched module B response array with metadata
  const moduleBDetail = (results.bQuestionScores || []).map(qs => {
    const qMeta = (results.moduleBQuestionsInfo || []).find(q => q.id === qs.id);
    const resp = (results.moduleBResponses || {})[qs.id] || {};
    const options = qMeta ? (qMeta.options || []) : [];
    const selectedOption = options.find(o => o.score === qs.score);
    return {
      questionId: qs.id,
      coreDimension: qs.dimension || '',
      sceneType: qMeta ? (qMeta.sceneType || '') : '',
      selectedScore: qs.score ?? 0,
      selectedText: resp.selectedText || (selectedOption ? selectedOption.text : ''),
      timeUsedSec: resp.timeUsed ?? null,
    };
  });

  const json = JSON.stringify(
    {
      exportTime: new Date().toISOString(),
      testInfo: {
        subjectId: results.subjectId,
        name: results.name,
        role: results.role,
        startTime: results.startTime,
        endTime: results.endTime,
        timeUsedSec: results.timeUsedSec,
        energyRemaining: results.energyRemaining,
        drawnModuleAIds: results.drawnAIds || '',
        drawnModuleBIds: results.drawnBIds || '',
      },
      scores: {
        scoreA_raw: results.scoreA,
        scoreB_raw: results.scoreB,
        resScore: results.resScore,
        totalScore: results.totalScore,
        profile: results.profile,
        energyRemaining: results.energyRemaining,
        dimensions: {
          calibratedReliance: dims.calibratedReliance?.total ?? dims.calibratedReliance ?? 0,
          verificationSupervision: dims.verificationSupervision?.total ?? dims.verificationSupervision ?? 0,
          complianceBoundary: dims.complianceBoundary?.total ?? dims.complianceBoundary ?? 0,
          dimensionBreakdown: {
            calibratedReliance: {
              total: dims.calibratedReliance?.total ?? 0,
              fromModuleA: dims.calibratedReliance?.fromA ?? 0,
              fromModuleB: dims.calibratedReliance?.fromB ?? 0,
            },
            verificationSupervision: {
              total: dims.verificationSupervision?.total ?? 0,
              fromModuleA: dims.verificationSupervision?.fromA ?? 0,
              fromModuleB: dims.verificationSupervision?.fromB ?? 0,
            },
            complianceBoundary: {
              total: dims.complianceBoundary?.total ?? 0,
              fromModuleA: dims.complianceBoundary?.fromA ?? 0,
              fromModuleB: dims.complianceBoundary?.fromB ?? 0,
            },
          },
        },
      },
      moduleADetail,
      moduleBDetail,
      behavioralLogs: (results.behavioralLogs || []).map(l => ({
        timestamp: l.timestamp,
        action: l.action,
        detail: l.detail,
        energyCost: l.energyCost,
      })),
    },
    null,
    2
  );

  downloadFile(json, `AI_Supervision_Logs_${results.subjectId || 'export'}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

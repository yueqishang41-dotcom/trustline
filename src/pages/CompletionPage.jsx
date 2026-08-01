import React, { useEffect, useRef } from 'react';
import { Clock, Zap, RefreshCw, CheckCircle, Download } from 'lucide-react';
import { useTestState, useTestActions } from '../store/testStore';
import { exportSPSS, exportJSON, exportReport } from '../utils/exportData';

export default function CompletionPage() {
  const state = useTestState();
  const { reset } = useTestActions();
  const { results, behavioralLogs } = state;
  const autoSaved = useRef(false);

  // Auto-save on completion — trigger once
  useEffect(() => {
    if (!results || autoSaved.current) return;
    autoSaved.current = true;

    // Save to localStorage (backup)
    try {
      localStorage.setItem('aisupervision_final', JSON.stringify(results));
    } catch (e) {}

    // Auto-download result files: CSV + JSON + HTML report
    const timer = setTimeout(() => {
      exportSPSS(results);
      setTimeout(() => exportJSON(results), 400);
      setTimeout(() => exportReport(results), 800);
    }, 500);

    return () => clearTimeout(timer);
  }, [results]);

  if (!results) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center text-slate-400">
          <p className="text-base">数据加载中...</p>
          <button onClick={reset} className="mt-2 text-sm text-blue-500 hover:text-blue-700 underline">返回首页</button>
        </div>
      </div>
    );
  }

  // Dimensions (supports {total,fromA,fromB} object and legacy number)
  const dims = results.dimensions || {};
  const dimTotal = (d) => d?.total ?? d ?? 0;
  const dimFromA = (d) => d?.fromA ?? 0;
  const dimFromB = (d) => d?.fromB ?? 0;

  const calibrated = dims.calibratedReliance;
  const verification = dims.verificationSupervision;
  const compliance = dims.complianceBoundary;

  const dimBar = (label, obj, color) => {
    const total = dimTotal(obj);
    const fromA = dimFromA(obj);
    const fromB = dimFromB(obj);
    const pct = Math.min(100, Math.round((total / 30) * 100));
    return (
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-slate-500 w-[6.5rem] shrink-0">{label}</span>
        <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-sm font-bold text-slate-800 w-16 text-right">{total}<span className="text-[10px] font-normal text-slate-400 block">A:{fromA}·B:{fromB}</span></span>
      </div>
    );
  };

  const catLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="w-full max-w-3xl mx-auto animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-3">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">任务完成</h1>
          <p className="text-base text-slate-500">感谢您的参与，以下为您的测验报告</p>
        </div>

        {/* ====== 海报式报告卡 ====== */}
        <div className="panel overflow-hidden mb-6">
          {/* Hero */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 text-white px-8 py-7">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide">🧠 AI 监督校准测验成绩单</h2>
                <p className="text-xs opacity-75 mt-1">Trustline · 第二届全国大学生心理与认知智能测评挑战赛</p>
              </div>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-white/20 border border-white/40">{results.profile || '待评估'}</span>
            </div>
            <div className="flex gap-8 mt-5 flex-wrap">
              {[['被试编号', results.subjectId], ['姓名', results.name], ['岗位/专业', results.role]].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] opacity-70">{k}</div>
                  <div className="text-lg font-bold mt-0.5">{v || '-'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-7">
            {/* Total score */}
            <div className="flex items-center gap-8 bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-2xl p-6 mb-6">
              <div className="text-center shrink-0">
                <div className="text-5xl font-black text-blue-900 leading-none">{results.totalScore ?? '-'}</div>
                <div className="text-xs text-slate-500 mt-1.5">综合得分 / 100</div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {[['模块 A（60分制）', results.scoreA], ['模块 B（20分制）', results.scoreB],
                  ['总用时', results.timeUsedSec ? `${Math.floor(results.timeUsedSec/60)}分${results.timeUsedSec%60}秒` : '-'],
                  ['剩余精力', `${results.energyRemaining ?? '-'} / 20 点`]].map(([k, v]) => (
                  <div key={k} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-slate-400">{k}</div>
                    <div className="text-base font-bold text-slate-700 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            <div className="mb-6">
              <h3 className="text-[15px] font-bold text-blue-900 mb-3 pb-2 border-b-2 border-slate-100 flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-blue-600 inline-block" />三大核心维度得分</h3>
              <div className="space-y-3">
                {dimBar('校准式依赖能力', calibrated, '#2563eb')}
                {dimBar('核验监督能力', verification, '#7c3aed')}
                {dimBar('合规边界执行力', compliance, '#059669')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">维度得分 = 模块A对应Rubric维度 + 模块B对应维度题目得分（A:模块A · B:模块B）</p>
            </div>

            {/* Module A summary */}
            <div className="mb-6">
              <h3 className="text-[15px] font-bold text-blue-900 mb-3 pb-2 border-b-2 border-slate-100 flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-blue-600 inline-block" />模块 A · 文书审阅修正情况</h3>
              <div className="flex flex-wrap gap-2">
                {(results.aQuestionScores || []).map(qs => {
                  const qMeta = (results.moduleAQuestionsInfo || []).find(q => q.id === qs.id);
                  const resp = (results.moduleAResponses || {})[qs.id] || {};
                  const edited = resp.editedText && resp.editedText.trim() !== (qMeta?.aiDraft || '').trim();
                  return (
                    <div key={qs.id} className={`px-3 py-2 rounded-xl border text-center min-w-[4.5rem] ${edited ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[11px] text-slate-400">{qs.id}</div>
                      <div className="text-base font-bold text-slate-800">{qs.total}<span className="text-[10px] font-normal text-slate-400">/10</span></div>
                      <div className={`text-[10px] font-medium ${edited ? 'text-emerald-600' : 'text-slate-400'}`}>{edited ? '已修正' : '未修改'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Module B summary */}
            <div className="mb-6">
              <h3 className="text-[15px] font-bold text-blue-900 mb-3 pb-2 border-b-2 border-slate-100 flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-blue-600 inline-block" />模块 B · 微决策得分</h3>
              <div className="flex flex-wrap gap-2">
                {(results.bQuestionScores || []).map((qs, i) => (
                  <div key={qs.id} className={`px-3 py-2 rounded-xl border text-center min-w-[4.5rem] ${qs.score === 2 ? 'bg-emerald-50 border-emerald-200' : qs.score === 1 ? 'bg-blue-50 border-blue-200' : qs.score === 0 ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-[11px] text-slate-400">{qs.id}</div>
                    <div className="text-base font-bold text-slate-800">{qs.score}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Behavior overview */}
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
              <Download className="w-4 h-4" />
              <span>已自动导出 3 个文件：成绩单报告（HTML）· CSV · JSON</span>
            </div>
            <div className="text-sm text-slate-400 space-y-1 pt-3 border-t border-slate-100 mt-4">
              <p>开始：{results.startTime ? new Date(results.startTime).toLocaleString('zh-CN') : '-'}</p>
              <p>完成：{results.endTime ? new Date(results.endTime).toLocaleString('zh-CN') : '-'}</p>
              <p>行为记录：{behavioralLogs?.length || 0} 条</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-5">
          <button onClick={reset} className="btn-secondary text-sm py-2.5 px-5">
            <RefreshCw className="w-4 h-4" /> 返回首页
          </button>
        </div>
      </div>
    </div>
  );
}

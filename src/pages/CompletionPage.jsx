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

    // Auto-download result files: CSV + JSON + HTML report (staff-facing)
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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">任务完成</h1>
          <p className="text-base text-slate-500">感谢您的参与，所有作答数据已自动保存。</p>
        </div>

        {/* Info card */}
        <div className="panel p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[['编号', results.subjectId || '-'], ['姓名', results.name || '-'], ['岗位/专业', results.role || '-']].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">{l}</p>
                <p className="text-[15px] font-semibold text-slate-800 truncate">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-400">总用时</p>
                <p className="text-[15px] font-semibold text-slate-800">
                  {results.timeUsedSec ? `${Math.floor(results.timeUsedSec / 60)} 分 ${results.timeUsedSec % 60} 秒` : '-'}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400">剩余精力</p>
                <p className="text-[15px] font-semibold text-slate-800">{results.energyRemaining || 0} / 20</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
            <Download className="w-4 h-4" />
            <span>已自动导出成绩单报告（HTML）· CSV · JSON 三个文件</span>
          </div>
          <div className="text-sm text-slate-400 space-y-1 pt-3 border-t border-slate-100">
            <p>开始：{results.startTime ? new Date(results.startTime).toLocaleString('zh-CN') : '-'}</p>
            <p>完成：{results.endTime ? new Date(results.endTime).toLocaleString('zh-CN') : '-'}</p>
            <p>行为记录：{behavioralLogs?.length || 0} 条</p>
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

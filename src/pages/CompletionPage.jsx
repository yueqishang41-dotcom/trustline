import React, { useEffect, useRef, useState } from 'react';
import { Clock, Zap, CheckCircle, UploadCloud, RefreshCw, AlertCircle } from 'lucide-react';
import { useTestState, useTestActions } from '../store/testStore';
import { uploadResults, flushPendingUploads } from '../utils/upload';

export default function CompletionPage() {
  const state = useTestState();
  const { reset } = useTestActions();
  const { results, behavioralLogs } = state;
  const uploadedOnce = useRef(false);
  const [uploadState, setUploadState] = useState('idle'); // idle | submitting | submitted | pending
  const [uploadErr, setUploadErr] = useState('');

  // 提交结果 + 补传历史暂存（只触发一次）
  useEffect(() => {
    if (!results || uploadedOnce.current) return;
    uploadedOnce.current = true;

    // 1) 本地备份（防上传彻底失败时的兜底）
    try {
      localStorage.setItem('aisupervision_final', JSON.stringify(results));
    } catch (e) {}

    // 2) 补传此前失败暂存的数据（静默）
    flushPendingUploads().catch(() => {});

    // 3) 静默上传本次结果（自动重试 3 次，失败自动暂存，下次打开补传）
    setUploadState('submitting');
    uploadResults(results)
      .then((r) => {
        setUploadState(r.ok ? 'submitted' : 'pending');
        if (!r.ok) setUploadErr(r.reason || '');
      })
      .catch((e) => {
        setUploadState('pending');
        setUploadErr((e && e.message) || '');
      });
  }, [results]);

  // 手动重试按钮
  const retryUpload = () => {
    if (!results) return;
    setUploadState('submitting');
    uploadResults(results)
      .then((r) => {
        setUploadState(r.ok ? 'submitted' : 'pending');
        if (!r.ok) setUploadErr(r.reason || '');
      })
      .catch((e) => {
        setUploadState('pending');
        setUploadErr((e && e.message) || '');
      });
  };

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

  const uploadBadge = {
    submitted: {
      icon: <CheckCircle className="w-4 h-4" />,
      text: '数据已成功提交',
      cls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    pending: {
      icon: <AlertCircle className="w-4 h-4" />,
      text: '网络异常，数据已本地暂存，将自动重试',
      cls: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    submitting: {
      icon: <UploadCloud className="w-4 h-4 animate-pulse" />,
      text: '正在提交数据...',
      cls: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    idle: {
      icon: <UploadCloud className="w-4 h-4" />,
      text: '正在准备提交数据...',
      cls: 'bg-slate-50 text-slate-500 border-slate-200',
    },
  }[uploadState];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">任务完成</h1>
          <p className="text-base text-slate-500">感谢您的参与，所有作答数据已自动提交保存。</p>
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

          {/* 上传状态 */}
          <div className={`flex flex-col items-center gap-1 text-sm rounded-xl px-4 py-3 border ${uploadBadge.cls}`}>
            <div className="flex items-center gap-2">
              {uploadBadge.icon}
              <span>{uploadBadge.text}</span>
              {uploadState === 'pending' && (
                <button onClick={retryUpload} className="ml-1 underline font-medium text-amber-700 hover:text-amber-900">立即重试</button>
              )}
            </div>
            {uploadState === 'pending' && uploadErr && (
              <p className="text-xs opacity-80 max-w-full break-all">失败原因：{uploadErr}</p>
            )}
          </div>

          <div className="text-sm text-slate-400 space-y-1 pt-3 border-t border-slate-100">
            <p>开始：{results.startTime ? new Date(results.startTime).toLocaleString('zh-CN') : '-'}</p>
            <p>完成：{results.endTime ? new Date(results.endTime).toLocaleString('zh-CN') : '-'}</p>
            <p>行为记录：{behavioralLogs?.length || 0} 条（含切屏、粘贴、微调等全部操作）</p>
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

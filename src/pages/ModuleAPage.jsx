import React, { useState, useEffect, useRef } from 'react';
import { FileText, Clock, RotateCw, Send, Eye, Lock, CheckCircle, Info, Search, BookOpen, RefreshCw } from 'lucide-react';
import { useTestState, useTestActions } from '../store/testStore';
import EnergyBar from '../components/EnergyBar';

function clean(s) {
  if (!s) return '';
  return s.replace(/^\[AI[^\]]*\]\s*/g, '').trim();
}

function parsePrompt(p) {
  if (!p) return null;
  const items = [];
  const rules = [
    { re: /\[角色\]([^|]+)/, label: '角色' },
    { re: /\[字数\]([^|]+)/, label: '字数' },
    { re: /\[生成内容\]([^|]+)/, label: '内容' },
    { re: /\[要求\]([^|]+)/, label: '要求' },
  ];
  for (const { re, label } of rules) {
    const m = p.match(re);
    if (m) items.push({ label, value: m[1].trim() });
  }
  return items.length ? items : null;
}

/**
 * Get per-question guidelines from the item bank data.
 * Each question has its own specific rules/standards to follow.
 */
function getQuestionGuidelines(q) {
  const guidelines = q.guidelines || '';
  const sceneLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };
  const sceneLabel = sceneLabels[q.sceneType] || q.sceneType || '通用';

  if (guidelines) {
    return { title: `工作指引 · ${sceneLabel}`, content: guidelines };
  }
  return null;
}

export default function ModuleAPage() {
  const state = useTestState();
  const a = useTestActions();
  const { moduleAQuestions, moduleACurrentIndex, moduleAResponses, energyPoints, evidenceUnlocked, startTime } = state;

  const [text, setText] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [cd, setCd] = useState(1500);

  const q = moduleAQuestions && moduleAQuestions[moduleACurrentIndex];

  // Track per-question payment status (consume energy once per question)
  const paidForRef = useRef({}); // { [questionId]: { template: bool, evidence: bool } }

  useEffect(() => {
    if (!q) return;
    const orig = clean(q.aiDraft || '');
    setText(moduleAResponses[q.id]?.editedText || orig);
    setShowPrompt(false);
    setPromptInput('');
    setShowTemplate(false);
    // Init payment tracking for this question if not exists
    if (!paidForRef.current[q.id]) {
      paidForRef.current[q.id] = { template: false, evidence: false };
    }
  }, [moduleACurrentIndex, q?.id]);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => setCd(Math.max(0, 1500 - Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // Show loading if no question
  if (!q || !moduleAQuestions || !moduleAQuestions.length) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-lg text-slate-500">正在加载题目...</p>
      </div>
    );
  }

  const orig = clean(q.aiDraft || '');
  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const pp = parsePrompt(q.aiSystemPrompt);
  // Auto-generate AI prompt display from background info
  const autoPrompt = pp || (() => {
    const items = [];
    const bg = q.background || '';
    const mRole = bg.match(/^(?:你是|你是一名?|你作为)([^。，]+)/);
    if (mRole) items.push({ label: '角色', value: mRole[1].trim() });
    const mReq = bg.match(/要求[：:]([^。]*(?:。|$))/);
    if (mReq) items.push({ label: '要求', value: mReq[1].trim() });
    const sceneType = q.sceneType || '';
    const sceneLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };
    const sceneLabel = sceneLabels[sceneType] || sceneType;
    if (sceneLabel) items.push({ label: '场景', value: sceneLabel });
    return items.length ? items : null;
  })();

  const sceneBadge = (() => {
    const t = q.sceneType || '';
    if (t === 'data') return { label: '数据分析', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (t === 'compliance') return { label: '制度合规', cls: 'bg-violet-50 text-violet-700 border-violet-200' };
    if (t === 'communication') return { label: '对外沟通', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: t || '通用', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  })();

  const template = getQuestionGuidelines(q);

  // --- Payment logic: energy consumed ONCE per question ---
  const onEvidence = () => {
    if (!evidenceUnlocked && !paidForRef.current[q.id]?.evidence && energyPoints >= 3) {
      // First time: pay and unlock
      a.consumeEnergy(3, 'view_evidence');
      a.setEvidenceUnlocked(true);
      paidForRef.current[q.id].evidence = true;
    } else if (!evidenceUnlocked && paidForRef.current[q.id]?.evidence && energyPoints >= 0) {
      // Already paid, just re-open
      a.setEvidenceUnlocked(true);
    } else if (evidenceUnlocked) {
      a.setEvidenceUnlocked(false);
    }
  };

  const onShowTemplate = () => {
    if (!showTemplate) {
      // Opening template
      if (!paidForRef.current[q.id]?.template && energyPoints >= 2) {
        // First time: pay
        a.consumeEnergy(2, 'view_template');
        paidForRef.current[q.id].template = true;
        setShowTemplate(true);
      } else if (paidForRef.current[q.id]?.template) {
        // Already paid, open free
        setShowTemplate(true);
      }
    } else {
      // Closing template
      setShowTemplate(false);
    }
  };

  const onRegen = () => {
    if (energyPoints >= 1 && !showPrompt) {
      a.consumeEnergy(1, 'regenerate_prompt');
      setShowPrompt(true);
    }
  };

  const onSubmit = () => {
    a.updateModuleAResponse(q.id, {
      editedText: text,
      actionsUsed: {
        viewEvidence: paidForRef.current[q.id]?.evidence || false,
        viewTemplate: paidForRef.current[q.id]?.template || false,
        regenerate: showPrompt,
        editPerformed: text !== orig,
      },
      finalText: text,
    });
    a.goToNextModuleA();
  };

  const applyPrompt = async () => {
    if (!promptInput.trim()) return;

    // Try to call DeepSeek API proxy
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `这是我当前的工作文档：\n"""\n${orig}\n"""\n\n请根据以下要求修改：${promptInput}\n直接输出修改后的完整文档。` },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setText(data.content);
        setShowPrompt(false);
        setPromptInput('');
        return;
      }

      // API returned an error status — surface it for debugging
      let errMsg = `API 请求失败（状态码 ${res.status}）`;
      try {
        const errData = await res.json();
        if (errData?.error) errMsg = `AI 服务出错：${errData.error}`;
      } catch (_) {}
      window.alert(errMsg);
      return;
    } catch (e) {
      window.alert(`AI 服务连接失败：${e.message || '网络错误'}`);
      return;
    }

    // (No silent fallback anymore — surface errors instead)
    setShowPrompt(false);
    setPromptInput('');
  };

  const templatePaid = paidForRef.current[q.id]?.template || false;
  const evidencePaid = paidForRef.current[q.id]?.evidence || false;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5" style={{ height: '3.25rem' }}>
        <div className="h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className={`font-mono text-base font-bold tabular-nums ${cd < 300 ? 'text-red-500' : 'text-slate-700'}`}>{fmt(cd)}</span>
            </div>
            <EnergyBar points={energyPoints} />
            <button onClick={() => { if (window.confirm('确认重置测试？所有当前进度将丢失。')) a.reset(); }}
              className="opacity-20 hover:opacity-60 transition-opacity" title="重置测试（工作人员专用）">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500">模块 A</span>
            <div className="flex gap-1">
              {moduleAQuestions.map((_, i) => (
                <div key={i} className={`w-6 h-1.5 rounded-full ${i === moduleACurrentIndex ? 'bg-blue-500' : i < moduleACurrentIndex ? 'bg-blue-300' : 'bg-slate-200'}`} />
              ))}
            </div>
            <span className="text-sm text-slate-400 font-mono font-medium">{moduleACurrentIndex + 1}/{moduleAQuestions.length}</span>
            <span className={`tag text-sm ${sceneBadge.cls}`}>{sceneBadge.label}</span>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="flex-1 min-h-0 p-4 gap-4 grid grid-cols-12" style={{ height: 'calc(100vh - 3.25rem)' }}>
        {/* Left */}
        <div className="col-span-3 panel flex flex-col overflow-hidden">
          <div className="panel-hd"><Info className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold text-slate-700">任务背景</span></div>
          <div className="panel-bd flex-1 overflow-y-auto space-y-4">
            <p className="text-[15px] text-slate-600 leading-relaxed">{q.background || ''}</p>
            {autoPrompt && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-medium text-slate-500">交付给 AI 助理的指令</div>
                <div className="p-4 space-y-2">
                  {autoPrompt.map(({ label, value }) => (
                    <div key={label} className="flex gap-3 text-sm">
                      <span className="text-slate-400 font-medium shrink-0 w-10">{label}</span>
                      <span className="text-slate-600">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle */}
        <div className="col-span-5 panel flex flex-col overflow-hidden">
          <div className="panel-hd flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-700">AI 初稿 — 请审核编辑</span>
            </div>
            {text !== orig
              ? <span className="tag bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">已修改</span>
              : <span className="tag bg-slate-100 text-slate-400 border-slate-200 text-xs">未修改</span>}
          </div>
          <div className="flex-1 flex flex-col p-5 gap-3 min-h-0">
            <div className="flex-1 relative">
              <textarea value={text} onChange={e => setText(e.target.value)}
                className="w-full h-full min-h-[200px] p-4 text-[15px] border border-slate-200 rounded-lg resize-y leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            {showPrompt && (
              <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-2.5 border border-amber-200">
                <input
                  type="text" value={promptInput} onChange={e => setPromptInput(e.target.value)}
                  placeholder="输入新约束条件，如：语气改为正式..."
                  className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                  onKeyDown={e => { if (e.key === 'Enter') applyPrompt(); }}
                />
                <button onClick={applyPrompt}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">应用</button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <ActionBtn icon={<BookOpen className="w-5 h-5" />} label="既往回复模板" desc="标准格式参考" cost={2}
                active={showTemplate} disabled={!templatePaid && energyPoints < 2} onClick={onShowTemplate} color="blue" />
              <ActionBtn icon={<FileText className="w-5 h-5" />} label="查阅原始材料" desc="全文：完整证据包" cost={3}
                active={evidenceUnlocked} disabled={!evidencePaid && energyPoints < 3} onClick={onEvidence} color="violet" />
              <ActionBtn icon={<RotateCw className="w-5 h-5" />} label="微调 Prompt" desc="输入新约束重生成" cost={1}
                active={showPrompt} disabled={!showPrompt && energyPoints < 1} onClick={onRegen} color="amber" />
              <div className="flex-1" />
              <ActionBtn icon={<Send className="w-5 h-5" />} label="提交本题" desc="进入下一题" cost={0}
                active={false} disabled={false} onClick={onSubmit} color="emerald" />
            </div>
          </div>
        </div>

        {/* Right: Evidence */}
        <div className="col-span-4 panel flex flex-col overflow-hidden">
          <div className="panel-hd flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-violet-500" /><span className="text-sm font-semibold text-slate-700">参考信息</span></div>
            {!evidencePaid && !templatePaid && <span className="tag bg-slate-100 text-slate-400 border-slate-200 text-xs">已锁定</span>}
            {showTemplate && !evidenceUnlocked && <span className="tag bg-blue-50 text-blue-600 border-blue-200 text-xs">模板可见</span>}
            {evidenceUnlocked && <span className="tag bg-violet-50 text-violet-600 border-violet-200 text-xs">全文可见</span>}
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            {evidenceUnlocked ? (
              /* Full evidence unlocked */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 rounded-lg px-4 py-2.5 border border-violet-200">
                  <CheckCircle className="w-4 h-4" /> 原始材料（全文）
                  <button onClick={onEvidence} className="ml-auto text-violet-500 hover:text-violet-700 underline font-medium">收起</button>
                </div>
                <pre className="text-[15px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-200">
                  {q.evidencePackage || '（暂无详细材料）'}
                </pre>
              </div>
            ) : showTemplate ? (
              /* Template shown */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-200">
                  <CheckCircle className="w-4 h-4" /> 既往回复模板
                  <button onClick={onShowTemplate} className="ml-auto text-blue-500 hover:text-blue-700 underline font-medium">收起</button>
                </div>
                {template ? (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-sm font-medium text-blue-800">
                      {template.title}
                    </div>
                    <pre className="text-[14px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed p-4 bg-white">
                      {template.content}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">（该题型暂无参考模板）</p>
                )}
                {!evidencePaid && (
                  <button onClick={onEvidence} disabled={energyPoints < 3}
                    className="w-full px-4 py-2.5 text-sm rounded-lg font-medium flex items-center justify-center gap-2 bg-violet-50 text-violet-700 border-2 border-violet-200 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Eye className="w-4 h-4" /> 查阅原始材料（再付 1 点）
                  </button>
                )}
              </div>
            ) : (
              /* Fully locked */
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center"><Lock className="w-7 h-7 text-slate-300" /></div>
                <div>
                  <p className="text-base font-medium text-slate-600">参考信息已锁定</p>
                  <p className="text-sm text-slate-400 mt-1">消耗精力查阅参考模板或原始材料</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                  <button onClick={onShowTemplate} disabled={!templatePaid && energyPoints < 2}
                    className={`w-full px-4 py-2.5 text-sm rounded-lg font-medium flex items-center justify-center gap-2 ${
                      energyPoints >= 2 || templatePaid ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}>
                    <BookOpen className="w-4 h-4" /> 查看既往回复模板（2点）
                  </button>
                  <button onClick={onEvidence} disabled={!evidencePaid && energyPoints < 3}
                    className={`w-full px-4 py-2.5 text-sm rounded-lg font-medium flex items-center justify-center gap-2 ${
                      energyPoints >= 3 || evidencePaid ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}>
                    <FileText className="w-4 h-4" /> 查阅原始材料（3点）
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, desc, cost, active, disabled, onClick, color }) {
  const styles = {
    violet: { a: 'bg-violet-600 border-violet-700 text-white shadow-lg shadow-violet-200', n: 'bg-white border-violet-400 text-violet-700 hover:bg-violet-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    blue: { a: 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-200', n: 'bg-white border-blue-400 text-blue-700 hover:bg-blue-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    amber: { a: 'bg-amber-600 border-amber-700 text-white shadow-lg shadow-amber-200', n: 'bg-white border-amber-400 text-amber-700 hover:bg-amber-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    emerald: { a: 'bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-200', n: 'bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-50 hover:shadow-md', d: '' },
  };
  const s = disabled ? styles[color].d : active ? styles[color].a : styles[color].n;
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative flex flex-col items-center justify-center px-4 py-4 rounded-xl border-2 text-sm font-bold transition-all w-[9rem] h-[4.5rem] ${s}`}>
      <div className="flex items-center gap-1.5 mb-0.5">{icon}<span className="text-[15px]">{label}</span></div>
      <span className="text-[11px] opacity-80">{desc}</span>
      {cost > 0 && (
        <span className={`absolute -top-3 -right-3 text-xs font-bold px-2 py-0.5 rounded-full border-2 bg-white shadow-sm ${disabled ? 'text-slate-300 border-slate-200' : 'text-slate-700 border-slate-300'}`}>{cost}</span>
      )}
    </button>
  );
}

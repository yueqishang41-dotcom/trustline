import { scoreModuleAQuestion, calculateModuleAScore } from './src/utils/scoringEngine.js';

const bank = (await import('./src/data/itemBank.json', { with: { type: 'json' } })).default;
const qa = Object.fromEntries(bank.moduleA.questions.map(q => [q.id, q]));

// 用例1: 保留初稿错误(残留 mustFix) —— 应被正确性封顶
const q1 = qa['dsh-A1'];
const r1 = { editedText: 'Q2季度整体转化率呈现平稳态势:4月3.5%、5月3.2%、6月2.9%,各月波动不大,6月已现企稳回升迹象。',
             actionsUsed: { viewEvidence: true, editPerformed: true } };
const s1 = scoreModuleAQuestion(q1, r1);

// 用例2: 否定式修正 —— "并未企稳回升" 不应被误伤
const r2 = { editedText: 'Q2季度整体转化率呈现逐月下滑趋势:4月3.5%、5月3.2%、6月降至2.8%(为季度最低点),并未企稳回升。',
             actionsUsed: { viewEvidence: true, editPerformed: true } };
const s2 = scoreModuleAQuestion(q1, r2);

// 用例3: 完全正确(关键事实全中)
const r3 = { editedText: q1.correctOutput,
             actionsUsed: { viewEvidence: true, viewTemplate: true, editPerformed: true } };
const s3 = scoreModuleAQuestion(q1, r3);

// 用例4: 未编辑(直接采纳初稿)
const r4 = { editedText: q1.aiDraft, actionsUsed: { viewEvidence: false, editPerformed: false } };
const s4 = scoreModuleAQuestion(q1, r4);

// 用例5: dsh-A4 保留完整手机号 -> compliance 违规
const q4 = qa['dsh-A4'];
const r5 = { editedText: '尊敬的王晓明先生(手机号:13800138000),您的订单9527退款500元已原路退回。',
             actionsUsed: { viewEvidence: true, editPerformed: true } };
const s5 = scoreModuleAQuestion(q4, r5);

// 用例6: hr-A5 保留无依据断言 -> mustFix 封顶
const q5 = qa['hr-A5'];
const r6 = { editedText: '该供应商资质文件齐全,且近三年无重大违约记录,属于"需补充材料后准入"序列。',
             actionsUsed: { viewEvidence: true, editPerformed: true } };
const s6 = scoreModuleAQuestion(q5, r6);

// 用例7: zxy-A4 保留泄露细节 -> compliance 违规
const q6 = qa['zxy-A4'];
const r7 = { editedText: '销售部员工张三(工号:10086)泄露了300名客户的联系信息,给予书面警告处分。',
             actionsUsed: { viewEvidence: true, editPerformed: true } };
const s7 = scoreModuleAQuestion(q6, r7);

const show = (label, s) => console.log(label.padEnd(16), 'total='+s.total.toFixed(1),
  'corr='+s.correctness, 'eb='+s.evidenceBoundary, 'comp='+s.compliance, 'res='+s.resourceEfficiency);
show('残留错误(应1分封顶)', s1);
show('否定式修正(不误伤)', s2);
show('完全正确(应≈满分)', s3);
show('未编辑采纳初稿', s4);
show('保留手机号(合规0)', s5);
show('保留无依据断言(封顶)', s6);
show('保留泄露细节(合规0)', s7);

// 断言
const assert = (c, msg) => { if (!c) { console.error('✗ 断言失败:', msg); process.exit(1); } else console.log('✓', msg); };
assert(s1.correctness === 1, 'dsh-A1 残留"企稳回升"正确性封顶=1');
assert(s2.correctness >= 2, 'dsh-A1 否定式修正不误伤,correctness>=2');
assert(s3.total >= 7, "dsh-A1 完全正确总分>=7(资源效率随动作数递减,7.5为预期上限)");
assert(s5.compliance === 0 && s5.correctness === 1, 'dsh-A4 保留手机号合规=0且正确性封顶');
assert(s6.correctness === 1, 'hr-A5 保留无依据断言正确性封顶');
assert(s7.compliance === 0, 'zxy-A4 保留泄露细节合规=0');
console.log('\n全部冒烟测试通过 ✅ 引擎可正常运行');

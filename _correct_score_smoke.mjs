import bank from './src/data/itemBank.json' with { type: 'json' };
import { scoreModuleAQuestion } from './src/utils/scoringEngine.js';

const q = bank.moduleA.questions.find(x => x.id === 'dsh-A7');
console.log('题:', q.id, '| aiStatus:', q.aiStatus, '| keyFacts:', q.keyFacts);

// 1) 直接采纳(正确情境, 高效) — 无任何辅助动作
const adopt = scoreModuleAQuestion(q, { editedText: q.aiDraft, actionsUsed: {} });
console.log('直接采纳: total=', adopt.total, '正确性=', adopt.correctness, '证据=', adopt.evidenceBoundary, '合规=', adopt.compliance, '资源=', adopt.resourceEfficiency);

// 2) 合理优化(加"以结算页面为准"限定) — 查1次证据
const optimize = scoreModuleAQuestion(q, {
  editedText: '亲爱的顾客：618 大促期间（6 月 1 日至 6 月 20 日），全场商品参与满 300 减 50 活动，可叠加店铺优惠券（具体优惠以结算页面为准）。预售商品发货时间为 7 个工作日内，如有疑问欢迎联系在线客服。感谢您的理解与支持！',
  actionsUsed: { viewEvidence: true }
});
console.log('合理优化: total=', optimize.total, '正确性=', optimize.correctness, '证据=', optimize.evidenceBoundary, '合规=', optimize.compliance, '资源=', optimize.resourceEfficiency);

// 3) 过度修改(把正确数字改错) — 应被扣正确性
const overedit = scoreModuleAQuestion(q, {
  editedText: '亲爱的顾客：618 大促期间（6 月 1 日至 6 月 10 日），全场商品参与满 500 减 100 活动。',
  actionsUsed: { viewEvidence: true, viewTemplate: true, regenerate: true }
});
console.log('过度修改: total=', overedit.total, '正确性=', overedit.correctness, '证据=', overedit.evidenceBoundary, '合规=', overedit.compliance, '资源=', overedit.resourceEfficiency);

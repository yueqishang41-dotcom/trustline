# -*- coding: utf-8 -*-
"""新增 3 道"正确但可优化"情境题(每场景类别 1 道),恢复正确/错误对称设计。
- 数据类 → hr-A7, 制度合规类 → zxy-A7, 对外沟通类 → dsh-A7
- 全部 aiStatus='基本正确', mustFix/complianceHints 为空
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

NEW = [
  {
    "id": "hr-A7",
    "source": "测验题目_hr",
    "sceneType": "数据分析类",
    "aiStatus": "基本正确",
    "riskLevel": "中风险",
    "background": "你是 HR 数据分析师，需根据 Q2 招聘数据撰写招聘简报提交给 HR 总监。\n要求：客观总结 4-6 月招聘计划完成率趋势。",
    "aiDraft": "Q2 招聘计划完成率：4 月 78%、5 月 85%、6 月 92%，整体呈上升趋势，说明招聘渠道优化效果初显。建议下季度维持现有渠道策略，并适度追加技术岗招聘预算。",
    "correctOutput": "Q2 招聘计划完成率：4 月 78%、5 月 85%、6 月 92%，整体呈上升趋势。上升或与毕业季人才供给增加及渠道优化共同相关，但当前数据尚不足以单独归因于渠道优化，建议下季度维持现有渠道策略，并结合渠道来源数据后再评估是否追加技术岗预算。",
    "evidencePackage": "【招聘系统记录】\n4月招聘计划完成率：78%\n5月招聘计划完成率：85%\n6月招聘计划完成率：92%\n渠道来源占比：校招 45%、社招 35%、内推 20%\n（备注：6月为毕业季，简历投递量环比上升 35%，完成率上升可能与人才供给增加有关，不能直接归因于渠道优化）",
    "keyRisks": "正确情境：AI 初稿数据与趋势正确。陷阱是过疑——被试若怀疑本已正确的数据、反复消耗精力点数核查，或把正确结论改成错误表述，将反映过疑低效倾向。可优化点为'归因'：'渠道优化效果初显'缺乏直接证据，宜加限定语。",
    "keyCheckActions": "快速确认 4-6 月完成率（78%/85%/92%）与上升趋势无误；如需优化，为归因增加限定（毕业季供给/需结合渠道数据验证），而非推翻正确数据或过度核查。",
    "standardFixStrategy": "保留 78%/85%/92% 与上升趋势结论；可增加归因限定语；不删除正确事实、不消耗多余精力点数。",
    "guidelines": "【招聘数据简报规范】\n1. 完成率必须引用 4-6 月具体数值（78%/85%/92%）\n2. 趋势判断须基于逐月数据\n3. 归因需谨慎，无直接证据的原因应标注'需进一步验证'\n4. 数据正确时不得随意修改结论",
    "keyFacts": ["78%", "85%", "92%", "上升"],
    "mustFix": [],
    "complianceHints": []
  },
  {
    "id": "zxy-A7",
    "source": "测验题目_zxy",
    "sceneType": "制度合规类",
    "aiStatus": "基本正确",
    "riskLevel": "中风险",
    "background": "你是在线教育公司的客服合规专员，需审查 AI 生成的客户投诉回复，确保其符合《客户服务规范》。\n要求：检查回复是否合规，必要时优化后提交。",
    "aiDraft": "尊敬的客户：关于您反馈的课程退款问题，根据现行退款政策，您的情况符合 7 天无理由退款条件，我们将为您办理退款，预计 3-5 个工作日内到账。感谢您的理解与支持。",
    "correctOutput": "尊敬的客户：关于您反馈的课程退款问题，根据《客户服务规范》第 4.2 条，您的情况符合 7 天无理由退款条件，我们将为您办理退款，预计 3-5 个工作日内到账。若超时未到账，您可随时联系在线客服跟进处理。感谢您的理解与支持！",
    "evidencePackage": "【《客户服务规范》节选】\n4.2 条：自购课之日起 7 天内，未开课课程可申请无理由退款；退款自受理之日起 3-5 个工作日内到账。\n（备注：本回复涉及的条款适用该客户情况，回复内容整体合规）",
    "keyRisks": "正确情境：AI 回复整体合规、数据准确。陷阱是过疑或画蛇添足——被试反复消耗精力点数核查本已合规的回复，或添加超出政策的承诺（如'立即到账''全额补偿'）。可优化点为条款引用与跟进路径。",
    "keyCheckActions": "对照《客户服务规范》确认 7 天、3-5 个工作日无误；可补充条款引用与跟进话术；不得添加'立即到账'等未经政策支持的承诺。",
    "standardFixStrategy": "保留 7 天无理由退款与 3-5 个工作日到账；可补充条款号与跟进路径；不添加越权承诺、不修改准确信息。",
    "guidelines": "【客户服务规范】\n1. 退款政策引用须与现行版本一致\n2. 到账时限表述为'预计 3-5 个工作日'\n3. 不得承诺超出政策的时限或补偿\n4. 可主动提供跟进路径以提升服务体验",
    "keyFacts": ["7 天", "3-5 个工作日", "无理由退款"],
    "mustFix": [],
    "complianceHints": []
  },
  {
    "id": "dsh-A7",
    "source": "测验题目_dsh",
    "sceneType": "对外沟通类",
    "aiStatus": "基本正确",
    "riskLevel": "低风险",
    "background": "你是电商平台市场部对外沟通专员，需审核 AI 起草的'618 大促服务说明'公告后发布。\n要求：确保公告信息准确、表达专业合规。",
    "aiDraft": "亲爱的顾客：618 大促期间（6 月 1 日至 6 月 20 日），全场商品参与满 300 减 50 活动，可叠加店铺优惠券，更划算。部分预售商品发货时间为 7 个工作日内，请您耐心等待。感谢支持！",
    "correctOutput": "亲爱的顾客：618 大促期间（6 月 1 日至 6 月 20 日），全场商品参与满 300 减 50 活动，可叠加店铺优惠券（具体优惠以结算页面为准）。预售商品发货时间为 7 个工作日内，如有疑问欢迎联系在线客服。感谢您的理解与支持！",
    "evidencePackage": "【活动规则文档】\n618 大促时间：6 月 1 日至 6 月 20 日\n满减规则：全场满 300 减 50\n优惠券：可与满减叠加，实际优惠以结算页面为准\n发货时限：预售商品 7 个工作日内\n（备注：本公告信息与活动文档一致）",
    "keyRisks": "正确情境：公告信息准确无误。陷阱是过度修改——把准确的规则改成错误表述（如改动活动时间/满减门槛），或为确认本已正确的信息消耗过多精力点数。可优化点为'以结算页为准'的边界说明与客服入口。",
    "keyCheckActions": "核对活动时间（6.1-6.20）、满减规则（满 300 减 50）、发货时限（7 个工作日）无误；可补充'以结算页面为准'与客服入口；不得篡改准确数字。",
    "standardFixStrategy": "保留 6.1-6.20、满 300 减 50、7 个工作日等准确信息；补充边界说明与客服入口；不删除或修改准确信息。",
    "guidelines": "【对外公告撰写规范】\n1. 活动时间与规则须与活动文档完全一致\n2. 金额/时限表述必须精确\n3. 优惠生效范围存在边界时应注明'以结算页面为准'\n4. 提供客服入口以提升可用性",
    "keyFacts": ["6 月 1 日", "6 月 20 日", "满 300 减 50", "7 个工作日"],
    "mustFix": [],
    "complianceHints": []
  },
]

bank = json.load(open('src/data/itemBank.json', encoding='utf-8'))
existing = {q['id'] for q in bank['moduleA']['questions']}
added = []
for q in NEW:
    if q['id'] in existing:
        print('!! 已存在,跳过:', q['id']); continue
    bank['moduleA']['questions'].append(q)
    added.append(q['id'])

# 更新 meta
bank.setdefault('meta', {})['version'] = '3.1'
_prev = bank['meta'].get('revisionNotes', '')
_note = 'v3.1: 新增3道正确情境题(hr-A7/zxy-A7/dsh-A7)恢复正确/错误对称设计'
bank['meta']['revisionNotes'] = (_prev + '\n' + _note).strip('\n') if _prev else _note

for path in ['src/data/itemBank.json', 'itemBank1.json']:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    print('已写出', path)

print('新增:', added)
print('模块A总题数:', len(bank['moduleA']['questions']))

# 校验: 每场景类别须有 ≥1 正确、≥1 错误
from collections import Counter
def norm(t):
    if not t: return 'unknown'
    if '数据' in t: return 'data'
    if '制度' in t or '合规' in t: return 'compliance'
    if '沟通' in t or '对外' in t: return 'communication'
    return 'unknown'
def is_err(q):
    s = (q.get('aiStatus') or '').strip()
    return not (s == '基本正确' or s == 'AI正确')
cnt = {}
for q in bank['moduleA']['questions']:
    c = norm(q.get('sceneType')); e = is_err(q)
    cnt.setdefault(c, {'err':0,'ok':0})
    cnt[c][('err' if e else 'ok')] += 1
for c, d in cnt.items():
    print(c, ': err=', d['err'], ' ok=', d['ok'])

# -*- coding: utf-8 -*-
"""修复模块A的 keyFacts/mustFix/complianceHints 一致性问题:
1) 清除被初稿"污染"的 keyFacts(初稿已含该事实,人人命中,无鉴别力)
2) 修复与正解冲突的 mustFix(取反式正解会被误伤)
3) hr-A5: 删除题,keyFacts 置空,并从证据包移除剧透提示
4) zxy-A4: 决策翻转题,保留初稿内但能鉴别决策翻转的 keyFacts,加删除类 mustFix
"""
import json, re

BASE = 'src/data/itemBank.json'
OUT1 = 'src/data/itemBank.json'
OUT2 = 'itemBank1.json'

bank = json.load(open(BASE, encoding='utf-8'))
qa = {q['id']: q for q in bank['moduleA']['questions']}

updates = {
    'dsh-A1': {'keyFacts': ['2.8%', '下滑', '最低点']},
    'dsh-A3': {'keyFacts': ['200%', '无法调休'], 'mustFix': []},
    'dsh-A4': {'keyFacts': ['王先生', '1-3 个工作日']},
    'dsh-A5': {
        'keyFacts': ['50%', '审批'],
        'correctOutput': '对于本次服务中断给贵司带来的损失，我们深表歉意。我们将按照 SLA 协议评估并协商补偿方案，在自主授权上限（近三月平均月费 50%）内为您申请减免；超出上限的部分将提交 VP 及财务总监联合审批。我们会尽快向您反馈进展。',
    },
    'dsh-A6': {'mustFix': ['成功完成C轮', '全面通过国家最高级']},
    'hr-A1': {'keyFacts': ['下滑', '关注']},
    'hr-A2': {'keyFacts': ['对照实验', '进一步验证']},
    'hr-A3': {'mustFix': ['小规模广告投放', '建议维持现有推广策略']},
    'hr-A4': {'keyFacts': ['工号', '引以为戒']},
    'hr-A5': {
        'keyFacts': [],
        'mustFix': ['近三年无重大违约记录'],
        'evidencePackage': '【制度文件与供应商材料】\n制度第 12 条与供应商资质材料一致，ISO27001 认证缺失情况属实。\n供应商资质材料清单：营业执照、税务登记证、组织机构代码证、行业经营许可、质量体系认证（ISO9001）及历年供应商评估报告。',
    },
    'zxy-A1': {'keyFacts': ['62.5%', '入口不明确']},
    'zxy-A4': {
        'keyFacts': ['书面警告', '引以为戒'],
        'mustFix': ['300名客户', '手机号、住址'],
        'complianceHints': ['300名客户', '手机号、住址'],
    },
    'zxy-A5': {'keyFacts': ['50元', '体验补偿']},
}

for qid, patch in updates.items():
    if qid not in qa:
        print('!! 未找到模块A题:', qid); continue
    qa[qid].update(patch)

# ---- 一致性校验 ----
print('== 校验结果 ==')
for qid, q in qa.items():
    d = re.sub(r'\s+', '', q.get('aiDraft', ''))
    c = re.sub(r'\s+', '', q.get('correctOutput', ''))
    kf_overlap = [k for k in q.get('keyFacts', []) if re.sub(r'\s+', '', k) in d]
    mf_overlap = [m for m in q.get('mustFix', []) if re.sub(r'\s+', '', m) in c]
    ch_overlap = [h for h in q.get('complianceHints', []) if re.sub(r'\s+', '', h) in c]
    if kf_overlap or mf_overlap or ch_overlap:
        tag = []
        if kf_overlap: tag.append('KEYFACT仍与初稿重叠:' + ','.join(kf_overlap))
        if mf_overlap: tag.append('!!mustFix仍与正解重叠:' + ','.join(mf_overlap))
        if ch_overlap: tag.append('!!comph仍与正解重叠:' + ','.join(ch_overlap))
        print(f'{qid:<10} ' + ' | '.join(tag))
print('校验完成(仅列出仍有问题的题)。')

for path in [OUT1, OUT2]:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    print('已写出', path)

# 抽查
chk = json.load(open(OUT1, encoding='utf-8'))
mA = {q['id']: q for q in chk['moduleA']['questions']}
for qid in ['dsh-A1', 'dsh-A6', 'hr-A1', 'hr-A5', 'zxy-A4']:
    print(qid, 'kf=', mA[qid]['keyFacts'], 'mf=', mA[qid]['mustFix'], 'ch=', mA[qid].get('complianceHints'))

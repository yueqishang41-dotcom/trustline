# -*- coding: utf-8 -*-
"""应用预试修订:合并模块A/B修订内容,删除未试点题目,更新元信息。"""
import json, copy, sys

BASE = 'src/data/itemBank.json'
OUT1 = 'src/data/itemBank.json'
OUT2 = 'itemBank1.json'

revA = json.load(open('_revision_moduleA.json', encoding='utf-8'))['moduleA']
revB = json.load(open('_revision_moduleB.json', encoding='utf-8'))['moduleB']

bank = json.load(open(BASE, encoding='utf-8'))

# ---- 模块A 修订 ----
qa = {q['id']: q for q in bank['moduleA']['questions']}
for qid, patch in revA.items():
    if qid not in qa:
        print('!! 未找到模块A题:', qid); sys.exit(1)
    qa[qid].update(patch)

# ---- 模块B 修订 ----
qb = {q['id']: q for q in bank['moduleB']['questions']}
for qid, patch in revB.items():
    if qid not in qb:
        print('!! 未找到模块B题:', qid); sys.exit(1)
    qb[qid].update(patch)

# ---- 删除未试点题 ----
REMOVE_A = ['hr-A7', 'hr-A8']
REMOVE_B = ['hr-B11', 'hr-B12', 'zxy-B11', 'zxy-B12']
beforeA = len(bank['moduleA']['questions']); beforeB = len(bank['moduleB']['questions'])
bank['moduleA']['questions'] = [q for q in bank['moduleA']['questions'] if q['id'] not in REMOVE_A]
bank['moduleB']['questions'] = [q for q in bank['moduleB']['questions'] if q['id'] not in REMOVE_B]
print(f'模块A: {beforeA} -> {len(bank["moduleA"]["questions"])} (删除 {REMOVE_A})')
print(f'模块B: {beforeB} -> {len(bank["moduleB"]["questions"])} (删除 {REMOVE_B})')

# ---- 更新 statistics ----
def cnt(src, prefix):
    return sum(1 for q in bank[src]['questions'] if q['id'].split('-')[0].lower() == prefix.lower() or q['source'] == prefix)

stat = bank['statistics']
stat['totalQuestions'] = len(bank['moduleA']['questions']) + len(bank['moduleB']['questions'])
stat['moduleA']['total'] = len(bank['moduleA']['questions'])
stat['moduleB']['total'] = len(bank['moduleB']['questions'])
stat['moduleA']['bySource'] = {
    '测验题目_dsh': cnt('moduleA', 'dsh'),
    '题库-hr': cnt('moduleA', 'hr'),
    '题库-zxy(1)': cnt('moduleA', 'zxy'),
}
stat['moduleB']['bySource'] = {
    '测验题目_dsh': cnt('moduleB', 'dsh'),
    '题库-hr': cnt('moduleB', 'hr'),
    '题库-zxy(1)': cnt('moduleB', 'zxy'),
}
print('statistics:', json.dumps(stat, ensure_ascii=False))

# ---- 更新 meta ----
bank['meta']['version'] = '3.0'
bank['meta']['revisionNotes'] = (
    '2026-08 预实验修订版:依据《成果2_预实验项目分析汇总表_B卷模块A+C卷》与《预实验项目分析汇总表_A卷+B卷模块B》'
    '对 43 道受检题目进行修订(模块A 18道 + 模块B 25道),目标难度 P 0.50-0.75、区分度 D≥0.30;'
    '删除未参与预试的 6 道题(hr-A7/A8、hr-B11/B12、zxy-B11/B12);'
    '模块A 新增 keyFacts/mustFix/complianceHints 字段支撑评分引擎细化。'
)

for path in [OUT1, OUT2]:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)
    print('已写出', path, '| 题目数:', stat['totalQuestions'])

# ---- 校验:关键修订是否生效 ----
chk = json.load(open(OUT1, encoding='utf-8'))
mB = {q['id']: q for q in chk['moduleB']['questions']}
print('\n-- 抽查 --')
print('dsh-B2 best:', mB['dsh-B2']['options'][0]['text'][:40])
print('hr-B5 sceneType:', mB['hr-B5']['sceneType'])
print('zxy-B10 best:', mB['zxy-B10']['options'][0]['text'][:40])
mA = {q['id']: q for q in chk['moduleA']['questions']}
print('dsh-A1 keyFacts:', mA['dsh-A1']['keyFacts'])
print('dsh-A1 mustFix:', mA['dsh-A1']['mustFix'])
print('dsh-A4 complianceHints:', mA['dsh-A4']['complianceHints'])
print('hr-A5 aiStatus:', mA['hr-A5']['aiStatus'])
print('移除确认 hr-A7:', 'hr-A7' not in mA, '| zxy-B12:', 'zxy-B12' not in mB)

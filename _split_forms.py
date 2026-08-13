# -*- coding: utf-8 -*-
"""分卷方案: 模块A 18→3卷×6(场景2/卷), 模块B 30→3卷×10
模块B: 按(场景×维度)单元固定计数向量保证维度/场景硬均衡, 再用随机搜索均衡难度ΣP
"""
import json, sys, random
sys.stdout.reconfigure(encoding='utf-8')
b = json.load(open('src/data/itemBank.json', encoding='utf-8'))
B = b['moduleB']['questions']; A = b['moduleA']['questions']

P_A = {'dsh-A1':0.51,'dsh-A2':0.49,'dsh-A3':0.52,'dsh-A4':0.45,'dsh-A5':0.49,'dsh-A6':0.44,
       'hr-A1':0.44,'hr-A2':0.45,'hr-A3':0.47,'hr-A4':0.37,'hr-A5':0.50,'hr-A6':0.50,
       'zxy-A1':0.47,'zxy-A2':0.41,'zxy-A3':0.44,'zxy-A4':0.58,'zxy-A5':0.47,'zxy-A6':0.43}
P_B = {'dsh-B1':0.63,'dsh-B2':0.84,'dsh-B3':0.86,'dsh-B4':0.04,'dsh-B5':1.00,'dsh-B6':0.82,'dsh-B7':0.93,'dsh-B8':1.00,'dsh-B9':0.82,'dsh-B10':0.45,
       'hr-B1':0.87,'hr-B2':0.94,'hr-B3':0.90,'hr-B4':0.65,'hr-B5':0.87,'hr-B6':0.83,'hr-B7':0.96,'hr-B8':0.96,'hr-B9':0.92,'hr-B10':1.00,
       'zxy-B1':0.75,'zxy-B2':0.81,'zxy-B3':0.73,'zxy-B4':0.90,'zxy-B5':0.73,'zxy-B6':0.69,'zxy-B7':0.69,'zxy-B8':0.90,'zxy-B9':0.96,'zxy-B10':0.90}
DIM = {'校准式依赖能力':'校准','核验监督能力':'核验','合规边界执行力':'合规'}
bd = {q['id']: DIM[q['coreDimension']] for q in B}
def scene(qid): return qid.split('-')[0]

# ---- 模块A: 场景=2/卷, 难度贪心 ----
groups = {g:[x for x in ((q['id'], P_A[q['id']]) for q in A) if scene(x[0])==g] for g in 'dsh hr zxy'.split()}
formsA = [[],[],[]]; sumsA=[0.0]*3
for g in 'dsh hr zxy'.split():
    for qid, diff in sorted(groups[g], key=lambda x:-x[1]):
        f = min(range(3), key=lambda k: sumsA[k])
        formsA[f].append(qid); sumsA[f]+=diff
for i,f in enumerate(formsA,1):
    f = sorted(f)
    print(f'A卷{i}: {f}  ΣP={sumsA[i-1]:.2f} 场景={ {g:sum(1 for x in f if scene(x)==g) for g in 'dsh hr zxy'.split()} }')

# ---- 模块B: 单元计数向量(硬均衡维度+场景) ----
# (场景,维度) → (F1,F2,F3) 每卷分配数
CNT = {
 ('dsh','校准'):(1,2,1), ('dsh','核验'):(1,1,1), ('dsh','合规'):(1,1,1),
 ('hr','核验'):(1,1,2),  ('hr','校准'):(1,2,1), ('hr','合规'):(1,0,1),
 ('zxy','核验'):(2,1,1), ('zxy','合规'):(1,2,1), ('zxy','校准'):(1,0,1),
}
cells = {}
for q in B:
    key = (scene(q['id']), bd[q['id']])
    cells.setdefault(key, []).append((q['id'], P_B[q['id']]))

def assign_random():
    forms = [[],[],[]]
    for key, items in cells.items():
        (a,b_,c) = CNT[key]
        pool = items[:]; random.shuffle(pool)
        fa = [x[0] for x in pool[:a]]; fb = [x[0] for x in pool[a:a+b_]]; fc = [x[0] for x in pool[a+b_:a+b_+c]]
        forms[0]+=fa; forms[1]+=fb; forms[2]+=fc
    return forms

TARGET = sum(P_B.values())/3
best = None; best_score = 1e9
random.seed(42)
for _ in range(60000):
    forms = assign_random()
    sums = [sum(P_B[q] for q in f) for f in forms]
    score = sum((s-TARGET)**2 for s in sums)
    if score < best_score:
        best_score, best = score, [sorted(f) for f in forms]
for i,f in enumerate(best,1):
    dims = {d: sum(1 for x in f if bd[x]==d) for d in '校准 核验 合规'.split()}
    scns = {g: sum(1 for x in f if scene(x)==g) for g in 'dsh hr zxy'.split()}
    s = sum(P_B[q] for q in f)
    print(f'B卷{i}: {f}')
    print(f'    ΣP={s:.2f} 维度={dims} 场景={scns} 共{len(f)}题')
print(f'理想ΣP={TARGET:.2f} | 三卷ΣP方差={best_score/3:.4f}')
# 校验全部题被覆盖且不重复
import collections
all_ids = [q for f in best for q in f]
print('覆盖校验:', len(all_ids)==30, len(set(all_ids))==30)

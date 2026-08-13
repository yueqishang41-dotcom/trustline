# -*- coding: utf-8 -*-
"""用预试数据(pilot-data-fixed.json)对比旧/新模块A评分规则的难度与区分度。"""
import json
from collections import defaultdict

bank = json.load(open('src/data/itemBank.json', encoding='utf-8'))
data = json.load(open('pilot-data-fixed.json', encoding='utf-8'))

def bigram_sim(a, b):
    a, b = a.strip(), b.strip()
    if not a or not b: return 0.0
    if a == b: return 1.0
    if len(a) < 5 or len(b) < 5: return 1.0 if a == b else 0.0
    ga = set(a[i:i+2] for i in range(len(a)-1))
    gb = set(b[i:i+2] for i in range(len(b)-1))
    if not ga or not gb: return 0.0
    return len(ga & gb) / len(ga | gb)

def text_sim(a, b):
    a, b = a.strip(), b.strip()
    if not a or not b: return 0.0
    if a == b: return 1.0
    if len(a) < 5 or len(b) < 5: return 1.0 if a == b else 0.0
    sa, sb = set(a), set(b)
    if not sa or not sb: return 0.0
    return len(sa & sb) / len(sa | sb)

def score_old(q, resp):
    if not resp: return 0.0
    edited = (resp.get('editedText') or '').strip()
    draft = (q.get('aiDraft') or '').strip()
    edited_clean = edited
    draft_clean = draft
    has_edit = edited_clean and edited_clean != draft_clean and text_sim(draft_clean, edited_clean) < 0.95
    submitted = edited_clean or draft_clean
    sim = bigram_sim(submitted, (q.get('correctOutput') or '').strip())
    correctness = 3 if sim > 0.8 else (2 if sim > 0.6 else 1)
    au = resp.get('actionsUsed') or {}
    viewed = au.get('viewEvidence') or False
    templ = au.get('viewTemplate') or False
    regen = au.get('regenerate') or False
    eb = (1.5 if viewed else 0) + (1 if templ else 0) + (0.5 if (regen and not viewed) else 0)
    comp = (1 if has_edit else 0) + (0.5 if (viewed or templ) else 0)
    acts = sum(1 for k in ('viewEvidence','viewTemplate','regenerate','editPerformed') if au.get(k))
    res = 1.5 if acts <= 1 else (1 if acts == 2 else 0.5)
    return min(round((min(correctness,3)+min(eb,3)+min(comp,2)+min(res,2))*10)/10, 10)

def score_new(q, resp):
    if not resp: return 0.0
    edited = (resp.get('editedText') or '').strip()
    draft = (q.get('aiDraft') or '').strip()
    edited_clean, draft_clean = edited, draft
    has_edit = edited_clean and edited_clean != draft_clean and text_sim(draft_clean, edited_clean) < 0.95
    submitted = edited_clean or draft_clean
    denorm = lambda s: s.replace(whitespace, '')
    whitespace = ' \t\r\n　'
    sn = denorm(submitted)
    kfs = [denorm(k) for k in (q.get('keyFacts') or []) if denorm(k)]
    mustf = [denorm(m) for m in (q.get('mustFix') or []) if denorm(m)]
    comph = [denorm(h) for h in (q.get('complianceHints') or []) if denorm(h)]
    fact_hit = sum(1 for k in kfs if k in sn)
    fact_ratio = fact_hit/len(kfs) if kfs else 0.0
    bigram = bigram_sim(submitted, (q.get('correctOutput') or '').strip())
    fs = 3 if fact_ratio>=0.85 else 2.5 if fact_ratio>=0.6 else 2 if fact_ratio>=0.4 else 1.5 if fact_ratio>=0.2 else 1
    bs = 3 if bigram>0.8 else 2.5 if bigram>0.65 else 2 if bigram>0.5 else 1.5 if bigram>0.35 else 1
    correctness = max(fs, bs)
    retained = any(m in sn for m in mustf)
    if retained: correctness = min(correctness, 1)
    au = resp.get('actionsUsed') or {}
    viewed = au.get('viewEvidence') or False
    templ = au.get('viewTemplate') or False
    regen = au.get('regenerate') or False
    eb = (1.5 if (viewed and fact_ratio>=0.5) else 1 if viewed else 0) + (1 if templ else 0) + (0.5 if (regen and not viewed) else 0)
    viol = bool(comph) and any(h in sn for h in comph)
    comp = 0 if viol else (1 if has_edit else 0) + (0.5 if (viewed or templ) else 0)
    if viol: correctness = min(correctness, 1)
    acts = sum(1 for k in ('viewEvidence','viewTemplate','regenerate','editPerformed') if au.get(k))
    res = 1.5 if acts <= 1 else (1 if acts == 2 else 0.5)
    return min(round((min(correctness,3)+min(eb,3)+min(comp,2)+min(res,2))*10)/10, 10)

# 每题: 收集 (old_score, new_score) by subject
per_form = defaultdict(list)
qa = {q['id']: q for q in bank['moduleA']['questions']}
for subj in data:
    ft = subj.get('formType')
    if ft not in ('A','B','C'): continue
    modA = subj.get('moduleA') or {}
    resp = modA.get('responses') or {}
    old_tot = 0.0; new_tot = 0.0
    scores = {}
    for qid, q in qa.items():
        if q['id'] not in resp: continue
        o = score_old(q, resp.get(qid)); n = score_new(q, resp.get(qid))
        scores[qid] = (o, n)
        old_tot += o; new_tot += n
    # 用旧总分(含模块B,保持与原分析一致的分组)分三组
    old_tot_all = old_tot + (subj.get('scores') or {}).get('scoreB', 0)
    per_form[ft].append({'id': subj.get('subjectId'), 'old_tot': old_tot_all, 'new_totA': new_tot, 'scores': scores})

print(f"{'题号':<10}{'N':>3}  {'旧P':>6}{'新P':>6}  {'旧D':>7}{'新D':>7}  状态")
def third_split(recs):
    recs = sorted(recs, key=lambda r: r['old_tot'])
    n = len(recs); hi = recs[int(n*2/3):]; lo = recs[:int(n/3)]
    return hi, lo

for ft in ('A','B','C'):
    recs = per_form[ft]
    hi, lo = third_split(recs)
    print(f'\n===== {ft}卷 (N={len(recs)}, 高分组{len(hi)}, 低分组{len(lo)}) =====')
    order = [q['id'] for q in qa.values() if any(q['id'] in r['scores'] for r in recs)]
    for qid in order:
        vals_o = [r['scores'][qid][0] for r in recs if qid in r['scores']]
        vals_n = [r['scores'][qid][1] for r in recs if qid in r['scores']]
        if not vals_o: continue
        ho = [r['scores'][qid][0] for r in hi if qid in r['scores']]
        lo_ = [r['scores'][qid][0] for r in lo if qid in r['scores']]
        hn = [r['scores'][qid][1] for r in hi if qid in r['scores']]
        ln = [r['scores'][qid][1] for r in lo if qid in r['scores']]
        po = sum(vals_o)/len(vals_o)/10; pn = sum(vals_n)/len(vals_n)/10
        do_ = (sum(ho)/len(ho)-sum(lo_)/len(lo_))/10 if ho and lo_ else 0
        dn = (sum(hn)/len(hn)-sum(ln)/len(ln))/10 if hn and ln else 0
        status = '✓新D≥0.2' if dn >= 0.2 else '✗仍<0.2'
        print(f"{qid:<10}{len(vals_o):>3}  {po:>6.3f}{pn:>6.3f}  {do_:>7.3f}{dn:>7.3f}  {status}  (旧均值{sum(vals_o)/len(vals_o):.2f}→新{sum(vals_n)/len(vals_n):.2f})")

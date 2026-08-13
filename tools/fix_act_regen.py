#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_act_regen.py — 把旧数据（2026-08-11 修复前）里全为 0 的 {题号}__act_regen 补回正确值。

原理
----
旧版本在提交模块 A 题目时，用「微调输入框此刻是否还开着」记录 act_regen，
导致被试确实扣了精力用 AI 微调、但导出的 act_regen 列全为 0。
不过能量扣费日志（action='regenerate_prompt'，条目里含 questionId）一直完整保留。
本脚本从每行的 Behavioral_Logs_JSON 反查每题是否用过微调，把对应列补成 1。

注意：只有 act_regen 受影响；act_evidence / act_template 旧数据本来就是对的
（那两列记录自 paidForRef，不是瞬时状态）。

用法
----
python tools/fix_act_regen.py pilot-data.csv                  # 生成 pilot-data-fixed.csv
python tools/fix_act_regen.py pilot-data.csv -o fixed.csv     # 指定输出文件名
python tools/fix_act_regen.py pilot-data.json                 # 也可直接修 JSON 导出（重写 actionsUsed.regenerate）
"""
import argparse
import csv
import json
import os
import sys

# Windows 控制台默认 GBK，强制 UTF-8 输出
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 动作标记 → 行为日志 action → CSV 列后缀
# 精力扣费日志是能量账目的权威来源（20 - 已消耗 = energyRemaining 已验证），
# 故以日志为准补回所有动作标记。
ACTION_MAP = [
    ('view_evidence', '__act_evidence'),
    ('view_template', '__act_template'),
    ('regenerate_prompt', '__act_regen'),
]


def flag_map_from_logs(logs):
    """从行为日志提取每个动作的题目 ID 集合：{action: set(questionIds)}"""
    out = {}
    for action, _ in ACTION_MAP:
        out[action] = {lg.get('questionId') for lg in (logs or []) if lg.get('action') == action}
    return out


def fix_csv(path, out_path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        reader = list(csv.DictReader(f))
    if not reader:
        print('空表，无数据。', file=sys.stderr)
        return 1

    fieldnames = list(reader[0].keys())
    # 每类动作列：{后缀: [列名...]}
    action_cols = {}
    for _, suffix in ACTION_MAP:
        action_cols[suffix] = [c for c in fieldnames if c.endswith(suffix)]

    fixed_rows = 0
    total_cells = 0
    for row in reader:
        logs_raw = row.get('Behavioral_Logs_JSON', '')
        try:
            logs = json.loads(logs_raw) if logs_raw else []
        except Exception:
            logs = []
        flags = flag_map_from_logs(logs)
        row_fixed = False
        for action, suffix in ACTION_MAP:
            ids = flags.get(action) or set()
            if not ids:
                continue
            for col in action_cols[suffix]:
                qid = col[:-len(suffix)]  # 去掉后缀得题目 ID
                if qid in ids and row.get(col, '') not in ('1', '2'):
                    row[col] = '1'
                    total_cells += 1
                    row_fixed = True
        if row_fixed:
            fixed_rows += 1

    # 原样写出（补 BOM），保持其余列不动
    with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(reader)

    labels = '、'.join(f'{suffix.strip("_")} {len(action_cols[suffix])}列' for _, suffix in ACTION_MAP)
    print(f'完成：{len(reader)} 名被试，动作列：{labels}。')
    print(f'补回动作标记：共 {total_cells} 个单元格，涉及 {fixed_rows} 行（被试）。')
    print(f'修正后文件：{out_path}')
    print('提示：以精力扣费日志为权威来源（能量账目已验证 20-消耗=剩余）。')
    return 0


def fix_json(path, out_path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    payloads = data if isinstance(data, list) else [data]

    key_map = {'view_evidence': 'viewEvidence', 'view_template': 'viewTemplate', 'regenerate_prompt': 'regenerate'}
    corrected = 0
    for p in payloads:
        flags = flag_map_from_logs(p.get('behavioralLogs'))
        resp_map = p.get('moduleA', {}).get('responses') or {}
        for qid, resp in resp_map.items():
            acts = resp.setdefault('actionsUsed', {})
            changed = False
            for action, key in key_map.items():
                if qid in (flags.get(action) or set()) and not acts.get(key):
                    acts[key] = True
                    changed = True
            if changed:
                corrected += 1

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'完成：修正 {corrected} 道题的 actionsUsed 动作标记 = true。')
    print(f'修正后文件：{out_path}')
    return 0


def main():
    ap = argparse.ArgumentParser(description='补回旧数据中丢失的 act_regen 微调标记')
    ap.add_argument('datafile', help='pilot-data.csv 或 pilot-data.json')
    ap.add_argument('-o', '--output', help='输出文件路径（默认：<原名>-fixed.<ext>）')
    args = ap.parse_args()

    path = args.datafile
    if not os.path.isfile(path):
        print(f'找不到文件：{path}', file=sys.stderr)
        return 1

    base, ext = os.path.splitext(path)
    out = args.output or (base + '-fixed' + ext)

    if ext.lower() == '.json':
        return fix_json(path, out)
    return fix_csv(path, out)


if __name__ == '__main__':
    sys.exit(main())

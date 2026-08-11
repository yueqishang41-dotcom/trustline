#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recover_regen_usage.py — 从预实验导出数据中恢复「微调 Prompt（AI 重调）」的使用记录。

背景
----
旧版代码在提交模块 A 题目时，用瞬时的 showPrompt 状态记录 act_regen，
导致「能量确实扣了 1 点、但导出 CSV 的 {题号}__act_regen 列全为 0」的 bug
（2026-08-11 已修复：改为按每题扣费记录为准）。

本脚本不回填旧 CSV，而是直接从全量行为日志里反查每个被试在哪几道题
真正用 AI 微调（regenerate_prompt 日志条目），用于数据分析：
  - 找到该被试实际用微调的那几道题
  - 校验「微调消耗的能量」与「日志条目数」是否吻合
  - 顺带核对 view_evidence / view_template 的消耗

用法
----
python tools/recover_regen_usage.py pilot-data.json        # 完整 JSON 导出（推荐）
python tools/recover_regen_usage.py pilot-data.csv         # 宽表 CSV（解析 Behavioral_Logs_JSON 列）
python tools/recover_regen_usage.py pilot-data.json --csv  # 把结果也输出成 CSV
"""
import argparse
import csv
import json
import sys

# Windows 控制台默认 GBK，强制 UTF-8 输出，保证中文表格正常显示
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


def load_payloads(path):
    """返回 payload 列表。自动识别 JSON 导出 / CSV 导出。"""
    if path.endswith('.json'):
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]

    # CSV 宽表：从 Behavioral_Logs_JSON 列解析
    payloads = []
    with open(path, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            raw = row.get('Behavioral_Logs_JSON', '')
            logs = json.loads(raw) if raw else []
            payloads.append({
                'subjectId': row.get('Subject_ID', ''),
                'name': row.get('Name', ''),
                'formLabel': row.get('Form_Type', ''),
                'behavioralLogs': logs,
            })
    return payloads


def main():
    ap = argparse.ArgumentParser(description='恢复预实验数据中被试使用 AI 微调的题目')
    ap.add_argument('datafile', help='pilot-data.json 或 pilot-data.csv')
    ap.add_argument('--csv', action='store_true', help='把结果输出为 CSV（默认打印对齐表格）')
    args = ap.parse_args()

    payloads = load_payloads(args.datafile)
    if not payloads:
        print('未读取到任何数据。', file=sys.stderr)
        return 1

    if args.csv:
        w = csv.writer(sys.stdout)
        w.writerow(['Subject_ID', 'Name', 'Form', 'Regen_Used', 'Regen_Count', 'Regen_Questions', 'Evidence_Count', 'Template_Count'])

    for p in payloads:
        logs = p.get('behavioralLogs') or []
        regen = [lg for lg in logs if lg.get('action') == 'regenerate_prompt']
        evidence = [lg for lg in logs if lg.get('action') == 'view_evidence']
        template = [lg for lg in logs if lg.get('action') == 'view_template']

        regen_qs = [lg.get('questionId') or '?' for lg in regen]
        # 记录顺序与题目作答顺序无关，这里按题目 ID 排序
        regen_qs_sorted = sorted(set(regen_qs))
        regen_cost = sum(int(lg.get('energyCost', 0)) for lg in regen)
        ev_cost = sum(int(lg.get('energyCost', 0)) for lg in evidence)
        tmpl_cost = sum(int(lg.get('energyCost', 0)) for lg in template)

        # 每个日志条目应恰好消耗 1 点；若消耗不等于条数，说明有异常
        flag = '' if regen_cost == len(regen) else '  ⚠ 能量与条数不符'

        if args.csv:
            w.writerow([
                p.get('subjectId', ''), p.get('name', ''), p.get('formLabel', ''),
                len(regen), len(regen), ';'.join(regen_qs_sorted), len(evidence), len(template),
            ])
        else:
            print('=' * 68)
            print(f"被试: {p.get('subjectId')}  姓名: {p.get('name')}  试卷: {p.get('formLabel')}")
            print(f"  微调次数: {len(regen)}  消耗能量: {regen_cost}{flag}")
            if regen_qs_sorted:
                print(f"  微调题目: {', '.join(regen_qs_sorted)}")
            else:
                print('  微调题目: （无）')
            print(f"  查看材料包(view_evidence): {len(evidence)} 次 / {ev_cost} 点")
            print(f"  查看工作规范(view_template): {len(template)} 次 / {tmpl_cost} 点")
            # 校验总能量：20 - 已消耗 = 剩余能量（与 payload.scores.energyRemaining 对比）
            total_spent = regen_cost + ev_cost + tmpl_cost
            print(f"  模块 A 共消耗: {total_spent} 点")

    if not args.csv:
        print('=' * 68)
        print('提示：旧数据的 act_regen 列全为 0 是记录 bug，以上题目即为真实使用 AI 微调的题目。')
        print('若需把这些题目标记合并进 CSV 分析，可把本脚本输出与宽表按 Subject_ID 对齐。')
    return 0


if __name__ == '__main__':
    sys.exit(main())

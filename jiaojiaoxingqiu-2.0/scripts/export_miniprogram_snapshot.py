# -*- coding: utf-8 -*-
"""
导出小程序离线数据快照（只读）。

复刻 src/lib/v1/store.ts 中 publicData()/publicOrder()/sanitize() 的公开数据边界：
- 仅导出 state === "published" 且未删除且 validity !== "unavailable" 的订单
- 渠道名（渠道A/渠道B/渠道C等）替换为「平台」
- 微信/手机号等联系方式脱敏
- 不导出内部字段、原文、老师联系方式

用法（在项目根目录执行）：
  python scripts/export_miniprogram_snapshot.py
输出：
  miniprogram/data/snapshot.js            （小程序离线兜底数据）
  cloudfunctions/getFeed/snapshot-data.js （云函数数据，更新后右键上传部署即可生效）
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "tutor-v1.sqlite"
OUT_PATH = ROOT / "miniprogram" / "data" / "snapshot.js"
CLOUD_OUT_PATH = ROOT / "cloudfunctions" / "getFeed" / "snapshot-data.js"

GRADE_CN = "一二三四五六"

def grade_key(value: str) -> str:
    def repl(m):
        ch = m.group(0)
        try:
            return GRADE_CN[int(ch) - 1]
        except (ValueError, IndexError):
            return ch
    value = re.sub(r"[1-6１-６](?=年级)", repl, value)
    value = re.sub(r"小学|女生|男生|学生|[男女]", "", value)
    return value.strip()

def grade_matches(actual: str, wanted: str) -> bool:
    key = grade_key(actual)
    if key == wanted:
        return True
    if wanted.startswith("初") and key == "初中":
        return True
    if wanted.startswith("高") and key == "高中":
        return True
    if wanted.endswith("年级") and key == "小学":
        return True
    if wanted == "幼儿园" and re.search(r"小班|中班|大班|幼儿", key):
        return True
    return False

def main():
    con = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    cur = con.cursor()

    settings = json.loads(cur.execute("SELECT data FROM settings WHERE id='main'").fetchone()[0])
    channels = [c for c in settings.get("channels", []) if c.get("id") != "owned"]
    channel_names = ["渠道A", "渠道B", "渠道C"] + [c["name"] for c in channels if c.get("name")]

    def sanitize(value: str) -> str:
        result = value or ""
        for name in channel_names:
            result = result.replace(name, "平台")
        result = re.sub(r"(?:微信|手机|电话|联系号码)\s*[:：]?\s*[\w+ -]+", "[联系方式已隐藏]", result)
        result = re.sub(r"\b1[3-9]\d{9}\b", "[手机号已隐藏]", result)
        return result

    def pool_label(pool: str) -> str:
        if pool == "owned":
            return "高性价比急出单"
        if len(pool) == 1 and pool in "ABC":
            return f"{pool}池"
        return pool

    def public_order(o: dict) -> dict:
        public_pool = o.get("pool", "")
        for c in settings.get("channels", []):
            if c.get("id") == o.get("sourceChannel"):
                public_pool = c.get("pool", public_pool)
                break
        gender = o.get("gender") if o.get("gender") in ("男", "女") else ""
        return {
            "id": o.get("id"),
            "orderCode": sanitize(o.get("orderCode", "")),
            "city": sanitize(o.get("city", "")),
            "district": sanitize(o.get("district", "")),
            "address": sanitize(o.get("address", "")),
            "grade": sanitize(o.get("grade", "")),
            "gender": gender,
            "subjects": [sanitize(s) for s in o.get("subjects", [])],
            "situation": sanitize(o.get("situation", "")),
            "schedule": sanitize(o.get("schedule", "")),
            "weekdays": o.get("weekdays", []),
            "requirement": sanitize(o.get("requirement", "")),
            "teacherType": o.get("teacherType", ""),
            "collegeRate": "" if o.get("teacherType") == "professional" else sanitize(o.get("collegeRate") or ""),
            "professionalRate": "" if o.get("teacherType") == "college" else sanitize(o.get("professionalRate") or ""),
            "perClassRate": sanitize(o.get("perClassRate") or ""),
            "hourlyMin": o.get("hourlyMin"),
            "hourlyMax": o.get("hourlyMax"),
            "pool": sanitize(public_pool),
            "publicPoolLabel": sanitize(pool_label(public_pool)),
            "publishedAt": o.get("publishedAt", ""),
            "goal": sanitize(o.get("goal", "")),
            "teacherGender": o.get("teacherGender", ""),
            "collegeMin": o.get("collegeMin"),
            "collegeMax": o.get("collegeMax"),
            "professionalMin": o.get("professionalMin"),
            "professionalMax": o.get("professionalMax"),
            "timePeriods": o.get("timePeriods", []),
            "duration": o.get("duration", 0),
        }

    orders = []
    for (raw,) in cur.execute("SELECT data FROM orders"):
        o = json.loads(raw)
        if o.get("state") == "published" and not o.get("deletedAt") and o.get("validity") != "unavailable":
            orders.append(o)
    orders.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    ids = {o["id"] for o in orders}

    batches = []
    for (raw,) in cur.execute("SELECT data FROM batches"):
        b = json.loads(raw)
        items = [
            {"pool": sanitize(i.get("pool", "")), "district": sanitize(i.get("district", "")), "isNew": i.get("isNew", False)}
            for i in b.get("items", []) if i.get("orderId") in ids
        ]
        batches.append({"id": b.get("id"), "createdAt": b.get("createdAt"), "items": items})
    batches.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    batches = batches[:5]

    dictionaries = [
        {"id": d["id"], "kind": d["kind"], "name": sanitize(d["name"])}
        for d in settings.get("dictionaries", [])
        if d.get("active") and not d.get("deletedAt") and d.get("kind") in ("subject", "district", "teacherType")
    ]

    snapshot = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone(__import__("datetime").timedelta(hours=8))).isoformat(),
        "orders": [public_order(o) for o in orders],
        "batches": batches,
        "dictionaries": dictionaries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLOUD_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(snapshot, ensure_ascii=False, indent=2)
    header = (
        "// 由 scripts/export_miniprogram_snapshot.py 自动生成，请勿手工编辑。\n"
        f"// 快照时间：{snapshot['generatedAt']}\n"
        "// 重新生成：在项目根目录执行 python scripts/export_miniprogram_snapshot.py\n"
    )
    OUT_PATH.write_text(header + "module.exports = " + json_text + ";\n", encoding="utf-8")
    CLOUD_OUT_PATH.write_text(header + "module.exports = " + json_text + ";\n", encoding="utf-8")
    print(f"已导出 {len(snapshot['orders'])} 条订单、{len(snapshot['batches'])} 个批次")
    print(f"  -> {OUT_PATH}")
    print(f"  -> {CLOUD_OUT_PATH}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"导出失败：{e}", file=sys.stderr)
        sys.exit(1)

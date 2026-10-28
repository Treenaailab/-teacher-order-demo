import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminData, get, history, mutate, newSession, publicData, saveTeacher, session, transaction, put, logout } from "@/lib/v1/store";
import type { Teacher, ParentRequest } from "@/lib/v1/domain";
import { validRequestOrigin, secureSessionCookie } from "@/lib/v1/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: NextRequest) { try {
    const scope = req.nextUrl.searchParams.get("scope");
    if (!scope || scope === "public")
        return response(publicData());
    if (scope === "me") {
        const s = session(req.cookies.get("tutor-teacher")?.value);
        if (!s || s.role !== "teacher")
            return response({ teacher: null });
        const teacher = get<Teacher>("teachers", s.entity_id ?? "");
        return response({ teacher: teacher && !teacher.deletedAt ? teacher : null });
    }
    const s = session(req.cookies.get("tutor-session")?.value);
    if (!s || !["operator", "admin"].includes(s.role))
        return response({ error: "请先登录管理员账号" }, 401);
    if (scope === "history")
        return response(history(req.nextUrl.searchParams.get("id") ?? ""));
    return response(adminData(s));
}
catch (e) {
    console.error("V1 read failed", e);
    return response({ error: "本地数据读取失败，请稍后重试" }, 500);
} }
export async function POST(req: NextRequest) {
    try {
        if (!validRequestOrigin(req))
            return response({ error: "请求来源不匹配，请从本站操作" }, 403);
        if (!req.headers.get("content-type")?.includes("application/json"))
            return response({ error: "请求格式不正确" }, 415);
        const body = await req.text();
        if (body.length > 500000)
            return response({ error: "一次提交内容过大" }, 413);
        const p = JSON.parse(body);
        const action = p.action as string;
        if (action === "teacher.submit") {
            const s = session(req.cookies.get("tutor-teacher")?.value);
            const existing = s?.role === "teacher" ? get<Teacher>("teachers", s.entity_id ?? "") : undefined;
            if (existing && p.revision !== existing.revision)
                return response({ error: "资料已更新，请刷新后再提交" }, 409);
            const teacher = transaction(() => saveTeacher(p.patch, "老师本人", existing));
            const res = response({ teacher });
            if (!existing)
                res.cookies.set("tutor-teacher", newSession("teacher", "老师本人", teacher.id), { httpOnly: true, sameSite: "lax", secure: secureSessionCookie(req), path: "/", maxAge: 365 * 86400 });
            return res;
        }
        if (action === "parent.submit") {
            const names = ["学员年级", "性别", "科目", "当前情况", "辅导目标", "所在区域", "地址", "每周次数", "单次时长", "可上课时间", "期望老师类型", "老师性别要求", "其他要求", "预算", "微信", "手机号"];
            const fields = Object.fromEntries(names.map(k => [k, String(p.fields?.[k] ?? "").trim().slice(0, 5000)]));
            if (!fields["学员年级"] || !fields["科目"] || !/^1\d{10}$/.test(fields["手机号"]))
                throw new Error("请填写学员年级、科目及11位手机号");
            const record: ParentRequest = { id: randomUUID(), state: "pending_review", createdAt: new Date().toISOString(), fields, revision: 1 };
            put("requests", record.id, record);
            return response({ id: record.id, state: record.state });
        }
        const s = session(req.cookies.get("tutor-session")?.value);
        if (!s || !["operator", "admin"].includes(s.role))
            return response({ error: "请先登录管理员账号" }, 401);
        if (action === "logout") {
            logout(req.cookies.get("tutor-session")!.value);
            const res = response({ ok: true });
            res.cookies.delete("tutor-session");
            return res;
        }
        return response(mutate(action, p, s));
    }
    catch (e) {
        return response({ error: e instanceof Error ? e.message : "操作失败" }, 400);
    }
}

import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/v1/store";
import { validRequestOrigin, secureSessionCookie } from "@/lib/v1/request-origin";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { try {
    if (!validRequestOrigin(req))
        return NextResponse.json({ error: "请求来源不正确" }, { status: 403 });
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 1000)
        throw new Error("账号或密码不正确");
    const result = login(username, password);
    const res = NextResponse.json({ role: result.role, displayName: result.name }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set("tutor-session", result.token, { httpOnly: true, secure: secureSessionCookie(req), sameSite: "lax", path: "/", maxAge: 86400 });
    return res;
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "登录失败" }, { status: 401 });
} }

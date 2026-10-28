import type { NextRequest } from "next/server";

// 公网代理使用显式配置的站点地址，不信任客户端提供的转发头。
export function siteOrigin(req: NextRequest): string {
    const configured = process.env.TUTOR_PUBLIC_ORIGIN;
    if (configured)
        return new URL(configured).origin;

    // 临时反向代理（例如 Cloudflare Quick Tunnel）会把公网地址放在
    // x-forwarded-host。只接受当前请求携带的主机，避免把任意来源加入白名单。
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (host && (forwardedHost || host.endsWith(".trycloudflare.com"))) {
        // 临时隧道统一按 https 计算，忽略转发链上可能被改写的 proto 头
        const protocol = host.endsWith(".trycloudflare.com") ? "https" : (forwardedProto || "http");
        return `${protocol}://${host}`;
    }
    return req.nextUrl.origin;
}

export function validRequestOrigin(req: NextRequest): boolean {
    const origin = req.headers.get("origin");
    if (!origin)
        return true;
    return origin === siteOrigin(req);
}

export function secureSessionCookie(req: NextRequest): boolean {
    return siteOrigin(req).startsWith("https:");
}

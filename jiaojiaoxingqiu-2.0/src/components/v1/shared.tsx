"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
export async function api<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> { const r = await fetch("/api/v1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) }); const data = await r.json(); if (!r.ok)
    throw new Error(data.error ?? "操作失败"); return data; }
export function useData<T>(scope = "public") { const [data, setData] = useState<T | null>(null), [error, setError] = useState(""); const reload = useCallback(async () => { try {
    const r = await fetch(`/api/v1?scope=${scope}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) {
        if (r.status === 401 && scope !== "public")
            window.location.href = "/auth";
        throw new Error(d.error);
    }
    setData(d);
    setError("");
}
catch (e) {
    setError(e instanceof TypeError ? "连接未成功，请确认本地服务已开启后重试。" : e instanceof Error ? e.message : "加载失败，请重试。");
} }, [scope]); useEffect(() => { void reload(); const refresh = () => { if (document.visibilityState === "visible")
    void reload(); }; window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); }; }, [reload]); return { data, error, reload, setData }; }
export function Nav() {
  const path = usePathname();
  return <header className="v-nav"><Link className="v-brand" href="/"><span>✦</span>家教星球</Link><nav aria-label="主导航"><Link className={path === "/" || path.startsWith("/teacher") ? "active" : ""} href="/teacher">找家教</Link><Link className={path.startsWith("/parent") ? "active" : ""} href="/parent">找老师</Link><Link href="/#about">关于平台</Link></nav><div><Link className="v-nav-register" href="/teacher/register"><GraduationCap size={16}/>老师登记</Link><Link className="v-muted" href="/auth">身份入口<ArrowUpRight size={13}/></Link></div></header>;
}
export function Footer() { return <footer className="v-footer" id="about"><b>家教星球</b><p>认真教学，遇见合适的机会。咨询、简历、试课与收付款沟通由平台助理在微信承接。</p><Link href="/auth">管理员登录</Link> · <Link href="/">统一首页</Link></footer>; }
export function Alert({ children }: {
    children: ReactNode;
}) { return children ? <div role="status" className="v-alert">{children}</div> : null; }
export function Field({ label, value, onChange, type = "text", options, wide = false, required = false }: {
    label: string;
    value: string | number | undefined;
    onChange: (v: string) => void;
    type?: string;
    options?: string[];
    wide?: boolean;
    required?: boolean;
}) { return <label className={`v-field ${wide ? "v-wide" : ""}`}><span>{label}{required ? " *" : ""}</span>{options ? <select required={required} value={value ?? ""} onChange={e => onChange(e.target.value)}>{!options.includes("") && <option value="">请选择</option>}{options.map(x => <option key={x} value={x}>{x || "不限"}</option>)}</select> : type === "textarea" ? <textarea rows={3} value={value ?? ""} onChange={e => onChange(e.target.value)} required={required}/> : <input onInput={type === "date" ? e => onChange(e.currentTarget.value) : undefined} onBlur={type === "date" ? e => onChange(e.currentTarget.value) : undefined} type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "any" : undefined} value={value ?? ""} onChange={e => onChange(e.target.value)} required={required}/>}</label>; }
export function Multi({ label, options, value, onChange }: {
    label: string;
    options: string[];
    value: string[];
    onChange: (v: string[]) => void;
}) { return <fieldset className="v-multi"><legend>{label}</legend><div>{options.map(x => <button key={x} type="button" aria-pressed={value.includes(x)} className={value.includes(x) ? "selected" : ""} onClick={() => onChange(value.includes(x) ? value.filter(s => s !== x) : [...value, x])}>{x}</button>)}</div></fieldset>; }
export function Drawer({ title, close, children }: {
    title: string;
    close: () => void;
    children: ReactNode;
}) { useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; const esc = (e: KeyboardEvent) => { if (e.key === "Escape")
    close(); }; window.addEventListener("keydown", esc); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", esc); }; }, [close]); return <div className="v-overlay" onClick={close}><section className="v-drawer" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><header><h2>{title}</h2><button onClick={close} aria-label="关闭">关闭 ×</button></header>{children}</section></div>; }
export function download(name: string, value: unknown) { const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import "../portal.css";
import "./auth.css";

type LoginResponse = { role?: string; displayName?: string; error?: string };

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json()) as LoginResponse;
      if (!response.ok || !result.role || !result.displayName) {
        setError(result.error ?? "登录失败，请稍后再试。");
        return;
      }
      sessionStorage.setItem("tutor-admin-role", result.role);
      sessionStorage.setItem("tutor-admin-name", result.displayName);
      window.location.assign("/manage");
    } catch {
      setError("暂时无法连接登录服务，请确认本地系统正在运行。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="portal-shell admin-login-shell">
    <header className="portal-header">
      <Link className="portal-brand" href="/"><span><ShieldCheck size={20}/></span>家教星球 · 管理员登录</Link>
      <Link className="portal-back" href="/"><ArrowLeft size={15}/> 返回首页</Link>
    </header>
    <section className="admin-login-card">
      <div className="login-mark"><ShieldCheck size={24}/></div>
      <span className="portal-kicker">家教星球 · INTERNAL WORKSPACE</span>
      <h1>管理员登录</h1>
      <p>使用分配给你的管理员账号进入统一运营后台。</p>
      <form onSubmit={submit}>
        <label>账号<div className="auth-input"><UserRound size={16}/><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="输入管理员账号" required/></div></label>
        <label>密码<div className="auth-input"><LockKeyhole size={16}/><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入登录密码" required/></div></label>
        {error && <div className="auth-alert" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? "正在登录…" : "登录运营后台"}</button>
      </form>
      <div className="login-hint">普通管理员可处理日常运营；订单编辑与删除仅超级管理员可用。当前为本地验收账号，正式联网前需接入安全的账号服务。</div>
    </section>
    <footer className="auth-bottom">家教星球 · 运营管理入口</footer>
  </main>;
}

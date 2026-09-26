"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, FilePlus2, HeartHandshake, ReceiptText, ShieldCheck, UsersRound } from "lucide-react";
import { readDemoOrders } from "@/lib/demo-data";
import "./manage.css";

type AdminRole = "operator" | "admin";
const roleLabels: Record<AdminRole, string> = { operator: "普通管理员", admin: "超级管理员" };
const cards = [
  { href: "/manage/new", icon: FilePlus2, title: "快速录单", desc: "粘贴四种来源的订单，解析、核对后发布。" },
  { href: "/manage/orders", icon: ClipboardList, title: "订单管理", desc: "维护订单状态、机构有效性；超级管理员可编辑和删除。" },
  { href: "/manage/review", icon: HeartHandshake, title: "家长需求审核", desc: "审核通过后才加入自有急单池并公开。" },
  { href: "/manage/stats", icon: BarChart3, title: "渠道与运营统计", desc: "查看订单池、区域、科目、薪资与趋势数据。" },
  { href: "/manage/finance", icon: ReceiptText, title: "财务基础记录", desc: "登记信息费、退款、渠道结算和老师定金。" },
  { href: "/manage/teachers", icon: UsersRound, title: "老师名册", desc: "管理老师姓名、学校、常驻区域和授课能力。" },
];

export default function ManageHome() {
  const [role, setRole] = useState<AdminRole>("operator");
  const [name, setName] = useState("普通管理员");
  const [pending, setPending] = useState(0);
  const [teachers, setTeachers] = useState(0);
  const orders = useMemo(() => readDemoOrders(), []);

  useEffect(() => {
    const savedRole = sessionStorage.getItem("tutor-admin-role");
    if (savedRole === "admin" || savedRole === "operator") setRole(savedRole);
    setName(sessionStorage.getItem("tutor-admin-name") || "普通管理员");
    try {
      setPending(JSON.parse(localStorage.getItem("parent-requests-v1") || "[]").filter((item: { state?: string }) => item.state === "pending_review").length);
      setTeachers(JSON.parse(localStorage.getItem("teacher-roster-v1") || "[]").length + 4);
    } catch {
      setPending(0);
    }
  }, []);

  const published = orders.filter((order) => order.state === "published").length;
  const today = orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()).length;
  const superAdmin = role === "admin";

  function logout() {
    sessionStorage.removeItem("tutor-admin-role");
    sessionStorage.removeItem("tutor-admin-name");
    window.location.assign("/auth");
  }

  return <main className="manage-shell">
    <header className="manage-topbar">
      <Link className="brand" href="/"><span className="brand-mark"><BarChart3 size={18}/></span><span>家教星球<span className="brand-muted">·</span>运营工作台</span></Link>
      <div className="staff-title-actions"><span className="role-pill"><ShieldCheck size={14}/>{roleLabels[role]}</span><button className="back-link logout-button" onClick={logout}>退出登录</button><Link className="back-link" href="/teacher">老师端</Link></div>
    </header>
    <div className="manage-content">
      <div className="manage-breadcrumb">家教星球 <span>/</span> 经营驾驶舱</div>
      <div className="manage-title-row"><div><span className="section-kicker">OPERATIONS</span><h1>早上好，{name}</h1><p>一个后台按管理员角色开放相应权限。</p></div><Link className="primary-button" href="/manage/new"><FilePlus2 size={16}/> 快速录单</Link></div>
      <div className="manage-dashboard-grid"><div className="manage-stat"><span>订单总数</span><strong>{orders.length}</strong><small>含演示样本</small></div><div className="manage-stat"><span>当前公开订单</span><strong>{published}</strong><small>状态为公开中</small></div><div className="manage-stat"><span>今日新增</span><strong>{today}</strong><small>本地演示数据</small></div><div className="manage-stat"><span>待审核家长需求</span><strong>{pending}</strong><small>尚未对老师公开</small></div></div>
      <section className="manage-actions-grid">{cards.map(({ href, icon: Icon, title, desc }) => <Link className="manage-action-card" href={href} key={href}><span className="manage-action-icon"><Icon size={17}/></span><div><b>{title}{title === "老师名册" && <i className="manage-card-badge">{teachers}</i>}{title === "家长需求审核" && pending > 0 && <i className="manage-card-badge">{pending}</i>}</b><p>{desc}</p></div><ArrowRight size={15}/></Link>)}</section>
      <div className="manage-note"><b>本地验收模式：</b>录单、订单、名册和审核数据保存在当前浏览器。{superAdmin ? "超级管理员可编辑和删除已录订单。" : "普通管理员可处理日常运营；已录订单为只读，编辑和删除由超级管理员负责。"}</div>
    </div>
  </main>;
}

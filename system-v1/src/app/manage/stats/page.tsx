"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CircleAlert, MapPin, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { readDemoOrders } from "@/lib/demo-data";
import "../manage.css";
import "./stats.css";

type CountRow = { name: string; count: number };
type ChannelRow = { name: string; today: number; days_7: number; days_12: number; days_30: number };
type DashboardStats = { today: number; current_available: number; today_delisted: number; month_orders: number; channels: ChannelRow[]; regions: CountRow[]; subjects: CountRow[]; salary: CountRow[]; states: CountRow[]; finance_month: { received: number; refunded: number; channel_settlement: number; teacher_deposit: number } };

export default function StatsPage() {
  const supabase = createClient();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    async function load() {
      if (!supabase) {
        const orders = readDemoOrders();
        const now = Date.now();
        const countSince = (days: number) => orders.filter((order) => now - new Date(order.createdAt).getTime() <= days * 86400000).length;
        const counts = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((result, value) => { if (value) result[value] = (result[value] ?? 0) + 1; return result; }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        const hourly = orders.map((order) => order.hourlyMax).filter((value): value is number => value !== undefined);
        const salary: CountRow[] = ["60以下", "60–80", "80–100", "100–150", "150–200", "200+", "未标价"].map((name) => ({ name, count: hourly.filter((rate) => name === "60以下" ? rate < 60 : name === "60–80" ? rate >= 60 && rate < 80 : name === "80–100" ? rate >= 80 && rate < 100 : name === "100–150" ? rate >= 100 && rate < 150 : name === "150–200" ? rate >= 150 && rate < 200 : name === "200+" ? rate >= 200 : false).length + (name === "未标价" ? orders.length - hourly.length : 0) }));
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
        setData({ today: orders.filter((order) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(order.createdAt)) === today).length, current_available: orders.filter((order) => order.state === "published" && order.validity !== "unavailable").length, today_delisted: orders.filter((order) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(order.createdAt)) === today && ["delisted", "placed", "invalid"].includes(order.state)).length, month_orders: countSince(30), channels: ["jiang", "yang", "pengcheng", "owned"].map((source, index) => { const subset = orders.filter((order) => order.sourceChannel === source); return { name: ["姜老师", "杨老师", "鹏程", "自有渠道"][index], today: subset.filter((order) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(order.createdAt)) === today).length, days_7: subset.filter((order) => now - new Date(order.createdAt).getTime() <= 7 * 86400000).length, days_12: subset.filter((order) => now - new Date(order.createdAt).getTime() <= 12 * 86400000).length, days_30: subset.length }; }), regions: counts(orders.map((order) => order.district)).slice(0, 10), subjects: counts(orders.flatMap((order) => order.subjects)).slice(0, 10), salary, states: counts(orders.map((order) => order.state)), finance_month: { received: 0, refunded: 0, channel_settlement: 0, teacher_deposit: 0 } });
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("请先登录内部账号。"); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!profile || !["operator", "admin"].includes(profile.role)) { setError("此页面仅对 Operator 和 Admin 开放。"); setLoading(false); return; }
      const { data: stats, error: statsError } = await supabase.rpc("internal_dashboard_stats");
      if (!live) return;
      if (statsError) setError(statsError.message); else setData(stats as DashboardStats);
      setLoading(false);
    }
    void load();
    return () => { live = false; };
  }, [supabase]);

  const maxBar = Math.max(1, ...(data?.salary.map((item) => Number(item.count)) ?? [1]));
  const maxRegion = Math.max(1, ...(data?.regions.map((item) => Number(item.count)) ?? [1]));
  const maxSubject = Math.max(1, ...(data?.subjects.map((item) => Number(item.count)) ?? [1]));
  const finance = data?.finance_month;
  const net = finance ? Number(finance.received) - Number(finance.refunded) - Number(finance.channel_settlement) : 0;

  return <main className="manage-shell"><header className="manage-topbar"><a className="brand" href="/manage"><span className="brand-mark"><BarChart3 size={18}/></span><span>经营<span className="brand-muted">·</span>统计</span></a><a className="back-link" href="/manage"><ArrowLeft size={15}/> 返回运营首页</a></header><div className="manage-content"><div className="manage-breadcrumb">内部运营 <span>/</span> 渠道与订单统计</div><div className="manage-title-row"><div><span className="section-kicker">BUSINESS OVERVIEW</span><h1>家教业务经营数据</h1><p>以北京时间统计；区域、科目和薪资分布按近 30 天订单汇总。</p></div><span className="private-pill"><TrendingUp size={14}/> 内部数据</span></div>
    {error && <div className="form-alert"><CircleAlert size={16}/>{error}{error.includes("登录") && <a href="/auth">前往登录</a>}</div>}
    {!error && <><div className="manage-dashboard-grid"><div className="manage-stat"><span>今日新增</span><strong>{loading ? "—" : data?.today ?? 0}</strong></div><div className="manage-stat"><span>当前可咨询</span><strong>{loading ? "—" : data?.current_available ?? 0}</strong></div><div className="manage-stat"><span>本月订单</span><strong>{loading ? "—" : data?.month_orders ?? 0}</strong></div></div><div className="manage-stat-row"><span>今日已下架 / 已成交 / 已失效</span><b>{loading ? "—" : data?.today_delisted ?? 0}</b></div>
      <section className="stats-panel"><div className="stats-panel-title"><div><span className="section-kicker">CHANNEL SUPPLY</span><h2>渠道供单统计</h2></div><small>按订单录入时间统计</small></div><div className="stats-table-wrap"><table className="order-admin-table"><thead><tr><th>渠道</th><th>今日</th><th>近7天</th><th>近12天</th><th>近30天</th></tr></thead><tbody>{(data?.channels ?? []).map((row) => <tr key={row.name}><td><b>{row.name}</b></td><td>{row.today}</td><td>{row.days_7}</td><td>{row.days_12}</td><td>{row.days_30}</td></tr>)}</tbody></table></div></section>
      <div className="stats-two-col"><section className="stats-panel"><div className="stats-panel-title"><div><span className="section-kicker">REGIONS</span><h2><MapPin size={16}/> 热门区域</h2></div><small>近30天</small></div>{(data?.regions ?? []).map((row) => <div className="bar-row" key={row.name}><span>{row.name}</span><div className="bar-track"><i style={{ width: `${Math.max(5, Number(row.count) / maxRegion * 100)}%` }}/></div><b>{row.count}</b></div>)}</section><section className="stats-panel"><div className="stats-panel-title"><div><span className="section-kicker">SUBJECTS</span><h2>热门科目</h2></div><small>近30天</small></div>{(data?.subjects ?? []).map((row) => <div className="bar-row" key={row.name}><span>{row.name}</span><div className="bar-track"><i className="bar-subject" style={{ width: `${Math.max(5, Number(row.count) / maxSubject * 100)}%` }}/></div><b>{row.count}</b></div>)}</section></div>
      <div className="stats-two-col"><section className="stats-panel"><div className="stats-panel-title"><div><span className="section-kicker">HOURLY RATE</span><h2>时薪分布</h2></div><small>按最高时薪归档 · 近30天</small></div>{(data?.salary ?? []).map((row) => <div className="bar-row" key={row.name}><span>{row.name}</span><div className="bar-track"><i className="bar-salary" style={{ width: `${Math.max(3, Number(row.count) / maxBar * 100)}%` }}/></div><b>{row.count}</b></div>)}</section><section className="stats-panel"><div className="stats-panel-title"><div><span className="section-kicker">ORDER STATUS</span><h2>订单状态</h2></div><small>当前累计</small></div><div className="status-chips">{(data?.states ?? []).map((row) => <span key={row.name}>{({ draft: "草稿", published: "公开中", delisted: "已下架", placed: "已成交", invalid: "已失效" } as Record<string, string>)[row.name] ?? row.name}<b>{row.count}</b></span>)}</div></section></div>
      <section className="stats-panel finance-snapshot"><div className="stats-panel-title"><div><span className="section-kicker">MONTHLY CASH RECORDS</span><h2>本月基础收支记录</h2></div><a href="/manage/finance">查看财务记录 <ArrowRight size={13}/></a></div><div className="cash-grid"><div><span>收到信息费</span><b>¥{Number(finance?.received ?? 0).toLocaleString()}</b></div><div><span>退给老师</span><b>¥{Number(finance?.refunded ?? 0).toLocaleString()}</b></div><div><span>渠道结算</span><b>¥{Number(finance?.channel_settlement ?? 0).toLocaleString()}</b></div><div><span>收到老师定金（单列）</span><b>¥{Number(finance?.teacher_deposit ?? 0).toLocaleString()}</b></div><div className="cash-net"><span>信息费净额（未含定金）</span><b>¥{net.toLocaleString()}</b></div></div></section>
    </>}
    </div></main>;
}

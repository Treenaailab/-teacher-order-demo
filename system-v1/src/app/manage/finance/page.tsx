"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import "../manage.css";
import "./finance.css";

const sources = [{ id: "jiang", name: "姜老师" }, { id: "yang", name: "杨老师" }, { id: "pengcheng", name: "鹏程" }, { id: "owned", name: "自有渠道" }];
const entryTypes = [
  { id: "received", label: "收到信息费" },
  { id: "refunded", label: "退给老师" },
  { id: "channel_settlement", label: "结算给渠道" },
  { id: "teacher_deposit", label: "收到老师定金" },
  { id: "other", label: "其他" },
];
type FinancialEntry = { id: string; order_id: string | null; source_channel: string; entry_type: string; amount: number; happened_at: string; note: string; created_at: string; orders?: { order_code: string } | { order_code: string }[] | null };

export default function FinancePage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [source, setSource] = useState("jiang");
  const [type, setType] = useState("received");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderCode, setOrderCode] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    if (!supabase) { let local:FinancialEntry[]=[];try{local=JSON.parse(localStorage.getItem("finance-records-v1")||"[]")}catch{} setEntries(local);setAllowed(true);setLoading(false);return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setError("请先登录内部账号。"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || !["operator", "admin"].includes(profile.role)) { setLoading(false); setError("此区域仅对 Operator 和 Admin 开放。"); return; }
    setAllowed(true);
    const { data, error: loadError } = await supabase.from("financial_records").select("id,order_id,source_channel,entry_type,amount,happened_at,note,created_at,orders(order_code)").order("happened_at", { ascending: false }).limit(100);
    if (loadError) setError(loadError.message); else setEntries((data ?? []) as FinancialEntry[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [supabase]);

  const totals = useMemo(() => entries.reduce((result, entry) => {
    if (entry.entry_type === "received") result.received += Number(entry.amount);
    if (entry.entry_type === "refunded") result.refunded += Number(entry.amount);
    if (entry.entry_type === "channel_settlement") result.settled += Number(entry.amount);
    if (entry.entry_type === "teacher_deposit") result.deposits += Number(entry.amount);
    return result;
  }, { received: 0, refunded: 0, settled: 0, deposits: 0 }), [entries]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    if (!supabase) { const local:FinancialEntry={id:`finance-${Date.now()}`,order_id:null,source_channel:source,entry_type:type,amount:Number(amount),happened_at:new Date(`${date}T12:00:00+08:00`).toISOString(),note:note.trim(),created_at:new Date().toISOString(),orders:orderCode.trim()?{order_code:orderCode.trim()}:null};const rows=JSON.parse(localStorage.getItem("finance-records-v1")||"[]") as FinancialEntry[];localStorage.setItem("finance-records-v1",JSON.stringify([local,...rows]));setEntries([local,...entries]);setSuccess("演示财务记录已保存在当前浏览器。");setAmount("");setOrderCode("");setNote("");setSaving(false);return; }
    let orderId: string | null = null;
    if (orderCode.trim()) {
      const { data: order, error: orderError } = await supabase.from("orders").select("id").eq("order_code", orderCode.trim()).maybeSingle();
      if (orderError || !order) { setError(orderError?.message || "没有找到该订单编号，请核对后再保存。"); setSaving(false); return; }
      orderId = order.id;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("financial_records").insert({ order_id: orderId, source_channel: source, entry_type: type, amount: Number(amount), happened_at: new Date(`${date}T12:00:00+08:00`).toISOString(), note: note.trim(), created_by: user?.id });
    if (insertError) setError(insertError.message);
    else { setSuccess("财务记录已保存。"); setAmount(""); setOrderCode(""); setNote(""); await load(); }
    setSaving(false);
  }

  return <main className="manage-shell"><header className="manage-topbar"><a className="brand" href="/manage"><span className="brand-mark"><ReceiptText size={18}/></span><span>基础<span className="brand-muted">·</span>财务记录</span></a><a className="back-link" href="/manage"><ArrowLeft size={15}/> 返回运营首页</a></header><div className="manage-content"><div className="manage-breadcrumb">内部运营 <span>/</span> 基础财务记录</div><div className="manage-title-row"><div><span className="section-kicker">BASIC FINANCE</span><h1>基础财务记录</h1><p>登记实际发生的收款、退款、渠道结算和老师定金。</p></div></div>{error && <div className="form-alert"><CircleAlert size={16}/>{error}{error.includes("登录") && <a href="/auth">前往登录</a>}</div>}
    {allowed && <><div className="manage-dashboard-grid"><div className="manage-stat"><span>收到信息费（最近100笔）</span><strong>¥{totals.received.toLocaleString()}</strong></div><div className="manage-stat"><span>退款记录</span><strong>¥{totals.refunded.toLocaleString()}</strong></div><div className="manage-stat"><span>渠道结算 / 老师定金</span><strong>¥{totals.settled.toLocaleString()} / ¥{totals.deposits.toLocaleString()}</strong></div></div><section className="manage-panel"><div className="panel-step"><span>＋</span><div><b>新增一笔记录</b><small>财务记录仅内部可见；关联订单编号为选填。</small></div></div><form className="finance-form" onSubmit={submit}><label>真实来源<select value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>记录类型<select value={type} onChange={(e) => setType(e.target.value)}>{entryTypes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>金额（元）<input type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="输入实际金额"/></label><label>发生日期<input type="date" required value={date} onChange={(e) => setDate(e.target.value)}/></label><label>订单编号（选填）<input value={orderCode} onChange={(e) => setOrderCode(e.target.value)} placeholder="例如：广州26090001"/></label><label>备注（选填）<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：试课未通过，家长原因全额退款"/></label><div className="finance-form-actions"><span>目前只记录资金事实，不自动处理退费或渠道分账。</span><button className="primary-button" disabled={saving}>{saving ? "保存中…" : "保存记录"}</button></div></form>{success && <div className="form-success">{success}</div>}</section><div className="parsed-heading"><div><span className="section-kicker">RECENT ENTRIES</span><h2>最近记录</h2></div><span className="parsed-hint">最多显示最近 100 笔</span></div><div className="admin-table-wrap"><table className="order-admin-table"><thead><tr><th>日期</th><th>渠道</th><th>类型</th><th>金额</th><th>订单 / 备注</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>正在加载…</td></tr> : entries.map((entry) => { const linked = Array.isArray(entry.orders) ? entry.orders[0] : entry.orders; return <tr key={entry.id}><td>{new Date(entry.happened_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</td><td>{sources.find((item) => item.id === entry.source_channel)?.name ?? entry.source_channel}</td><td>{entryTypes.find((item) => item.id === entry.entry_type)?.label ?? entry.entry_type}</td><td>¥{Number(entry.amount).toLocaleString()}</td><td>{linked?.order_code ?? "—"}{entry.note && <><br/><span>{entry.note}</span></>}</td></tr>; })}</tbody></table></div></>}
    </div></main>;
}

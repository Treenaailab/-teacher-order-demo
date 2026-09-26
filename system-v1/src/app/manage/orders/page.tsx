"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { readDemoOrders, writeDemoOrders, type DemoOrder } from "@/lib/demo-data";
import "../manage.css";

type OrderPrivate = { source_channel: string; current_stage: string; state: DemoOrder["state"]; validity: DemoOrder["validity"]; last_confirmed_at: string | null };
type AdminOrder = { id: string; order_code: string; city: string; district: string; address_public: string; student_grade: string; subjects: string[]; created_at: string; situation?:string; schedule_text?:string; requirement_text?:string; order_private_data?: OrderPrivate | OrderPrivate[] | null };
const stateNames: Record<string, string> = { draft: "草稿", published: "公开中", delisted: "已下架", placed: "已成交", invalid: "已失效" };
const sourceNames: Record<string, string> = { jiang: "姜老师", yang: "杨老师", pengcheng: "鹏程", owned: "自有渠道" };
function privateFor(row: AdminOrder) { return Array.isArray(row.order_private_data) ? row.order_private_data[0] : row.order_private_data; }

export default function OrdersAdminPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing,setEditing]=useState<AdminOrder|null>(null);
  const [editMessage,setEditMessage]=useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) {
        setIsSuperAdmin(sessionStorage.getItem("tutor-admin-role") === "admin");
        const demo = readDemoOrders();
        setRows(demo.map((order) => ({ id: order.id, order_code: order.orderCode, city: order.city, district: order.district, address_public: order.address, student_grade: order.grade, subjects: order.subjects, created_at: order.createdAt,situation:order.situation,schedule_text:order.schedule,requirement_text:order.requirement, order_private_data: { source_channel: order.sourceChannel, current_stage: "未设置", state: order.state, validity: order.validity, last_confirmed_at: null } })));
        setPermission(true);
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setError("请先登录内部账号。"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!profile || !["operator", "admin"].includes(profile.role)) { setLoading(false); setError("此区域仅对 Operator 和 Admin 开放。"); return; }
      setIsSuperAdmin(profile.role === "admin");
      setPermission(true);
      const { data, error: loadError } = await supabase.from("orders").select("id,order_code,city,district,address_public,student_grade,subjects,situation,schedule_text,requirement_text,created_at,order_private_data(source_channel,current_stage,state,validity,last_confirmed_at)").order("created_at", { ascending: false }).limit(200);
      if (!alive) return;
      if (loadError) setError(loadError.message); else setRows((data ?? []) as AdminOrder[]);
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [supabase]);

  const visible = useMemo(() => rows.filter((row) => {
    const matchState = stateFilter === "all" || privateFor(row)?.state === stateFilter;
    const text = `${row.order_code} ${row.city} ${row.district} ${row.address_public} ${row.student_grade} ${(row.subjects ?? []).join(" ")}`.toLowerCase();
    return matchState && text.includes(query.trim().toLowerCase());
  }), [rows, query, stateFilter]);

  async function updateState(row: AdminOrder, next: string) {
    setSaving(row.id);
    if (!supabase) {
      const nextRows = readDemoOrders().map((order) => order.id === row.id ? { ...order, state: next as OrderPrivate["state"] } : order);
      writeDemoOrders(nextRows);
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, order_private_data: { ...privateFor(item), state: next } as OrderPrivate } : item));
      setSaving(null);
      return;
    }
    const { error: updateError } = await supabase.from("order_private_data").update({ state: next, updated_at: new Date().toISOString() }).eq("order_id", row.id);
    if (updateError) setError(`状态更新失败：${updateError.message}`);
    else setRows((items) => items.map((item) => item.id === row.id ? { ...item, order_private_data: { ...privateFor(item), state: next } as OrderPrivate } : item));
    setSaving(null);
  }

  async function updateValidity(row: AdminOrder, next: string) {
    setSaving(row.id);
    const patch = { validity: next, last_confirmed_at: next === "unverified" ? null : new Date().toISOString(), updated_at: new Date().toISOString() };
    if (!supabase) {
      const nextRows = readDemoOrders().map((order) => order.id === row.id ? { ...order, validity: next as OrderPrivate["validity"] } : order);
      writeDemoOrders(nextRows);
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, order_private_data: { ...privateFor(item), validity: next, last_confirmed_at: patch.last_confirmed_at } as OrderPrivate } : item));
      setSaving(null);
      return;
    }
    const { error: updateError } = await supabase.from("order_private_data").update(patch).eq("order_id", row.id);
    if (updateError) setError(`有效性更新失败：${updateError.message}`);
    else setRows((items) => items.map((item) => item.id === row.id ? { ...item, order_private_data: { ...privateFor(item), validity: next, last_confirmed_at: patch.last_confirmed_at } as OrderPrivate } : item));
    setSaving(null);
  }

  async function saveEdit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!editing)return;if(!isSuperAdmin){setEditMessage("只有超级管理员可以编辑已录订单。");return}const fd=new FormData(event.currentTarget);const patch={address_public:String(fd.get("address")||""),student_grade:String(fd.get("grade")||""),subjects:String(fd.get("subjects")||"").split(/[、，,\s/]+/).filter(Boolean),situation:String(fd.get("situation")||""),schedule_text:String(fd.get("schedule")||""),requirement_text:String(fd.get("requirement")||"")};if(!supabase){const next=readDemoOrders().map(o=>o.id===editing.id?{...o,address:patch.address_public,grade:patch.student_grade,subjects:patch.subjects,situation:patch.situation,schedule:patch.schedule_text,requirement:patch.requirement_text}:o);writeDemoOrders(next);setRows(rows=>rows.map(r=>r.id===editing.id?{...r,address_public:patch.address_public,student_grade:patch.student_grade,subjects:patch.subjects,situation:patch.situation,schedule_text:patch.schedule_text,requirement_text:patch.requirement_text}:r));setEditMessage("订单内容已保存到当前浏览器。");setEditing(null);return}const {error:updateError}=await supabase.from("orders").update({address_public:patch.address_public,student_grade:patch.student_grade,subjects:patch.subjects,situation:patch.situation,schedule_text:patch.schedule_text,requirement_text:patch.requirement_text}).eq("id",editing.id);if(updateError){setEditMessage(`保存失败：${updateError.message}`);return}setRows(rows=>rows.map(r=>r.id===editing.id?{...r,...patch}:r));setEditing(null)}

  async function deleteOrder(row: AdminOrder) {
    if (!isSuperAdmin) { setError("只有超级管理员可以删除已录订单。"); return; }
    if (!window.confirm(`确定删除订单「${row.order_code}」吗？此操作无法撤销。`)) return;
    setSaving(row.id);
    if (!supabase) {
      writeDemoOrders(readDemoOrders().filter((order) => order.id !== row.id));
      setRows((items) => items.filter((item) => item.id !== row.id));
      setEditMessage(`订单 ${row.order_code} 已删除。`);
      setSaving(null);
      return;
    }
    const { error: deleteError } = await supabase.from("orders").delete().eq("id", row.id);
    if (deleteError) setError(`删除失败：${deleteError.message}`);
    else {
      setRows((items) => items.filter((item) => item.id !== row.id));
      setEditMessage(`订单 ${row.order_code} 已删除。`);
    }
    setSaving(null);
  }

  return <main className="manage-shell"><header className="manage-topbar"><a className="brand" href="/manage"><span className="brand-mark"><Search size={18}/></span><span>家教星球<span className="brand-muted">·</span>订单管理</span></a><a className="back-link" href="/manage"><ArrowLeft size={15}/> 返回运营首页</a></header><div className="manage-content"><div className="manage-breadcrumb">家教星球 <span>/</span> 订单管理</div><div className="manage-title-row"><div><span className="section-kicker">ORDER CONTROL</span><h1>订单管理</h1><p>维护订单公开状态与向机构确认的有效性。</p></div></div>{error && <div className="form-alert"><CircleAlert size={16}/>{error}{error.includes("登录") && <a href="/auth">前往登录</a>}</div>}
    {editMessage&&<div className="form-success">{editMessage}</div>}{permission && <><input className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索订单编号、地址、学员年级或科目"/><div className="staff-title-actions" style={{ marginBottom: 12 }}>{["all", "published", "draft", "delisted", "placed", "invalid"].map((state) => <button key={state} className={`state-filter ${stateFilter === state ? "state-filter-active" : ""}`} onClick={() => setStateFilter(state)}>{state === "all" ? "全部" : stateNames[state]}</button>)}</div><div className="admin-table-wrap"><table className="order-admin-table"><thead><tr><th>订单</th><th>来源</th><th>区域</th><th>订单状态</th><th>机构确认</th><th>订单操作</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>正在加载…</td></tr> : visible.map((row) => { const privateRecord = privateFor(row); return <tr key={row.id}><td><b>{row.order_code}</b><br/><span>{row.subjects?.join(" / ")} · {row.student_grade}</span></td><td>{sourceNames[privateRecord?.source_channel ?? ""] ?? "—"}</td><td>{row.city} {row.district}<br/><span>{row.address_public}</span></td><td><select className="admin-state-select" value={privateRecord?.state ?? "draft"} disabled={saving === row.id} onChange={(e) => updateState(row, e.target.value)}>{Object.entries(stateNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><select className="admin-state-select" value={privateRecord?.validity ?? "unverified"} disabled={saving === row.id} onChange={(e) => updateValidity(row, e.target.value)}><option value="unverified">未核实</option><option value="confirmed">确认仍有效</option><option value="unavailable">确认已无效</option></select>{saving === row.id && <LoaderCircle size={13} className="spin"/>}</td><td>{isSuperAdmin?<div className="order-actions"><button className="edit-order-button" onClick={()=>setEditing(row)}>编辑</button><button className="delete-order-button" disabled={saving===row.id} onClick={()=>void deleteOrder(row)}><Trash2 size={12}/>删除</button></div>:<span>超级管理员专属</span>}</td></tr>; })}</tbody></table></div><div className="table-count">显示最近 {visible.length} 条（最多 200 条）</div></>}
    {editing&&<div className="modal-backdrop" onClick={()=>setEditing(null)}><form className="order-edit-modal" onSubmit={saveEdit} onClick={e=>e.stopPropagation()}><div className="sheet-head"><div><span className="section-kicker">EDIT ORDER</span><h3>编辑 {editing.order_code}</h3></div><button type="button" className="icon-button" onClick={()=>setEditing(null)}>×</button></div>{[["address","公开地址",editing.address_public],["grade","学员年级",editing.student_grade],["subjects","科目（中文逗号分隔）",editing.subjects.join("、")],["situation","当前情况",editing.situation||""],["schedule","上课时间",editing.schedule_text||""],["requirement","老师要求",editing.requirement_text||""]].map(([name,label,value])=><label className="edit-order-field" key={name}>{label}{name==="situation"||name==="requirement"?<textarea name={name} defaultValue={value} rows={2}/>:<input name={name} defaultValue={value} required/>}</label>)}<button className="primary-button">保存修改</button></form></div>}
    </div></main>;
}

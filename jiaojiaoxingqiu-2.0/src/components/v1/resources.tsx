"use client";
import { useState } from "react";
import Link from "next/link";
import { useAdmin } from "./admin";
import { api, Alert, Field, Drawer } from "./shared";
import { TeacherFields } from "./public";
import { OrderDrawer } from "./orders";
import { profileLabels, teacherTypeOptions, money, cashSummary, type Teacher, type Order, type Settings } from "@/lib/v1/domain";
export function Teachers() { const { data, reload } = useAdmin(); const [query, setQuery] = useState(""), [state, setState] = useState(""), [trash, setTrash] = useState(false), [selected, setSelected] = useState<Partial<Teacher> | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); const rows = data.teachers.filter(t => !!t.deletedAt === trash && (!state || t.state === state) && `${t.name} ${t.school} ${t.district}`.includes(query)); async function save() { if (!selected)
    return; setBusy(true); try {
    const t = await api<Teacher>("teacher.update", { id: selected.id, revision: selected.revision, patch: selected });
    setSelected(t);
    await reload();
    setMessage("老师资料已保存，公开状态同步到家长端。");
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return <><div className="v-row v-between"><h1>老师资源库</h1><button className="v-primary" onClick={() => { setMessage(""); setSelected({ teacherType: "college", state: "draft", subjects: [], grades: [], areas: [] }); }}>+ 新增老师</button></div><div className="v-toolbar"><input aria-label="搜索老师" placeholder="姓名 / 学校 / 常驻区域" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="筛选资料状态" value={state} onChange={e => setState(e.target.value)}><option value="">全部资料状态</option>{Object.entries(profileLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button onClick={() => setTrash(!trash)}>{trash ? "返回老师库" : "回收站"}</button></div><Alert>{!selected && message}</Alert><div className="v-table-wrap"><table className="v-table"><thead><tr>{["姓名", "类型", "学校 / 学历", "区域", "科目", "资料状态", "跟进状态", "联系方式（内部）", "操作"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(t => <tr key={t.id}><td>{t.name || "未填写"}</td><td>{teacherTypeOptions(data.settings.dictionaries).find(x => x.value === t.teacherType)?.label ?? t.teacherType}</td><td>{t.school || t.education}</td><td>{t.district}</td><td>{t.subjects.join("/")}</td><td>{profileLabels[t.state]}</td><td>{t.followup}</td><td>{t.wechat}<br />{t.phone}</td><td><div className="v-row"><button onClick={() => { setSelected(t); setMessage(""); }}>编辑 / 审核</button><button onClick={async () => { if (confirm(trash ? "恢复该老师资料？" : "将老师移入回收站并停止公开？")) {
    try {
        await api(trash ? "teacher.restore" : "teacher.delete", { id: t.id, revision: t.revision });
        await reload();
    }
    catch (e) {
        setMessage((e as Error).message);
    }
} }}>{trash ? "恢复" : "删除"}</button></div></td></tr>)}</tbody></table></div>{!rows.length && <div className="v-empty">暂无老师资料。老师登记后会出现在这里。</div>}{selected && <Drawer title={selected.name ? `老师档案 · ${selected.name}` : "新增老师"} close={() => setSelected(null)}><Alert>{message}</Alert><TeacherFields admin types={data.settings.dictionaries} value={selected} set={p => setSelected(v => ({ ...v, ...p }))}/><label className="v-field">资料状态<select value={selected.state} onChange={e => setSelected(v => ({ ...v, state: e.target.value }))}>{Object.entries(profileLabels).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label><p className="v-note">请核对拟公开内容。家长端只展示脱敏姓名与教学资料，联系方式、来源、内部备注不会返回公开接口。</p><div className="v-actions"><button disabled={busy} className="v-primary" onClick={() => void save()}>保存审核结果</button><button onClick={() => setSelected(null)}>关闭</button></div></Drawer>}</>; }
export function Finance() { const { data } = useAdmin(); const [selected, setSelected] = useState<Order | null>(null), [query, setQuery] = useState(""); const rows = data.orders.filter(o => (data.deals.some(d => d.orderId === o.id) || data.ledger.some(l => l.orderId === o.id)) && `${o.orderCode} ${o.teacherName}`.includes(query)); return <><h1>成交与财务</h1><p className="v-subtitle">成交自动建账，一单多笔流水。信息费仅收一次，家长长期课时费不由平台预收。</p><input className="v-search" placeholder="搜索订单编号或老师姓名" value={query} onChange={e => setQuery(e.target.value)}/><div className="v-table-wrap"><table className="v-table"><thead><tr>{["订单", "老师", "业务状态", "建议 / 实际信息费", "渠道费", "最终 / 个人收入", "实收", "退款", "已结算", "待收", "净现金", "财务状态", "操作"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(o => { const d = data.deals.find(d => d.orderId === o.id), cash = cashSummary(o, d, data.ledger); return <tr key={o.id}><td>{o.orderCode}{o.deletedAt ? "（回收站）" : ""}</td><td>{o.teacherName}</td><td>{o.businessState}</td><td>{d ? `${money(d.suggested)} / ${money(d.actual)}` : "尚未成交"}</td><td>{d ? money(d.channelFee) : "—"}</td><td>{d ? `${money(d.income)} / ${money(d.personal)}` : "—"}</td><td>{money(cash.received)}</td><td>{money(cash.refunds)}</td><td>{money(cash.settled)}</td><td>{money(cash.receivable)}</td><td>{money(cash.netCash)}</td><td>{cash.status}</td><td><button onClick={() => setSelected(o)}>财务明细 / 记流水</button></td></tr>; })}</tbody></table></div>{!rows.length && <div className="v-empty">尚无财务记录。订单成交或登记收款后会自动出现。</div>}<p><Link href="/manage/orders">进入订单，登记首笔定金 →</Link></p><Link href="/manage/stats">查看经营与渠道统计 →</Link>{selected && <OrderDrawer initial={selected} initialTab="finance" close={() => setSelected(null)}/>}</>; }
export function Review() { const { data, reload } = useAdmin(); const [message, setMessage] = useState(""), [busy, setBusy] = useState(""); return <><h1>家长需求审核</h1><p className="v-subtitle">审核通过后生成自有订单草稿，核对公开地址后再发布到高性价比急出单。</p><Alert>{message}</Alert>{data.requests.map(r => <section className="v-panel" key={r.id}><div className="v-row v-between"><h3>{r.fields["学员年级"]} · {r.fields["科目"]}</h3><span className="v-badge">{{ pending_review: "待审核", approved: "已通过", rejected: "已退回" }[r.state] ?? r.state}</span></div><div className="v-form-grid">{Object.entries(r.fields).map(([k, v]) => <p key={k}><small>{k}</small><br />{v || "—"}</p>)}</div>{r.state === "pending_review" ? <div className="v-row">{[true, false].map(approve => <button disabled={!!busy} className={approve ? "v-primary" : ""} key={String(approve)} onClick={async () => { setBusy(r.id); try {
    await api("request.review", { id: r.id, revision: r.revision, approve });
    await reload();
    setMessage(approve ? "已生成自有订单草稿，请到订单管理核对后发布。" : "已退回该需求。");
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy("");
} }}>{approve ? "通过并生成草稿" : "退回"}</button>)}</div> : r.orderId && <Link href="/manage/orders">查看生成的订单草稿 →</Link>}</section>)}{!data.requests.length && <div className="v-empty">暂无家长需求。</div>}</>; }
const dictionaryLabels: Record<string, string> = { subject: "科目", district: "区域", teacherType: "老师类型", teacherSource: "老师来源", lostReason: "未成交原因", refundReason: "退费原因" };
export function LegacyImport() { const { data, reload } = useAdmin(); const [message, setMessage] = useState(""); async function run() { try {
    const payload = Object.fromEntries(Object.entries({ orders: "tutor-order-demo-v1", teachers: "teacher-roster-v1", requests: "parent-requests-v1", finance: "finance-records-v1" }).map(([k, v]) => [k, JSON.parse(localStorage.getItem(v) || "[]")]));
    const result = await api<{
        imported: number;
    }>("legacy.import", { payload });
    await reload();
    setMessage(`已迁移 ${result.imported} 条旧记录。原浏览器数据保持不变。迁移订单保留为草稿，核对后发布。`);
}
catch (e) {
    setMessage((e as Error).message);
} } return <section className="v-panel"><h3>旧版本浏览器数据</h3><p className="v-note">如果这台浏览器曾录入订单、老师、家长需求或流水，可迁移到当前共享数据库。重复迁移不会重复创建。旧原始记录完整存档。</p><button onClick={() => void run()}>读取并迁移本浏览器旧数据</button><Alert>{message}</Alert>{data.legacy?.filter(r => r.kind === "finance" && !r.linked).map(r => <div className="v-panel" key={r.id}><pre className="v-raw">{JSON.stringify(r.original, null, 2)}</pre><label className="v-field">关联订单后进入财务<select defaultValue="" onChange={async (e) => { if (!e.target.value)
    return; try {
    await api("legacy.linkFinance", { id: r.id, orderId: e.target.value });
    await reload();
}
catch (error) {
    setMessage((error as Error).message);
} }}><option value="">请选择订单（请先核对金额、方向）</option>{data.orders.map(o => <option key={o.id} value={o.id}>{o.orderCode}</option>)}</select></label></div>)}</section>; }
export function Configuration() { const { data, reload } = useAdmin(); const [config, setConfig] = useState<Settings>(structuredClone(data.settings)), [tab, setTab] = useState("channels"), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); const change = (kind: Exclude<keyof Settings, "revision" | "feeRulesVersion">, id: string, patch: Record<string, unknown>) => setConfig(v => ({ ...v, [kind]: v[kind].map(x => x.id === id ? { ...x, ...patch } : x) })); async function save() { setBusy(true); try {
    const saved = await api<Settings>("settings.save", { settings: config });
    setConfig(saved);
    await reload();
    setMessage("设置已保存。历史成交保留原规则与渠道比例。");
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } function add() { if (tab === "channels")
    setConfig(v => ({ ...v, channels: [...v.channels, { id: crypto.randomUUID(), name: "新渠道", pool: "新订单池", percentage: 50, ourPercentage: 50, active: true }] }));
else if (tab === "rules")
    setConfig(v => ({ ...v, rules: [...v.rules, { id: crypto.randomUUID(), name: "新规则", mode: "weekly", frequency: 1, percentage: 100, active: false }] }));
else
    setConfig(v => ({ ...v, dictionaries: [...v.dictionaries, { id: crypto.randomUUID(), kind: tab, name: "新选项", active: true }] })); } const actions = (kind: Exclude<keyof Settings, "revision" | "feeRulesVersion">, x: {
    id: string;
    active: boolean;
    deletedAt?: string;
}) => <div className="v-row"><button onClick={() => change(kind, x.id, { active: !x.active })}>{x.active ? "停用" : "启用"}</button><button onClick={() => change(kind, x.id, { deletedAt: x.deletedAt ? undefined : new Date().toISOString() })}>{x.deletedAt ? "恢复" : "删除"}</button></div>; return <><h1>系统设置</h1><p className="v-subtitle">配置渠道、分类与信息费规则。删除可恢复，停用后不影响已保存的历史数据。</p><div className="v-toolbar">{Object.entries({ channels: "渠道", ...dictionaryLabels, rules: "信息费规则" }).map(([k, v]) => <button key={k} className={k === tab ? "selected" : ""} onClick={() => setTab(k)}>{v}</button>)}</div><Alert>{message}</Alert>{tab === "channels" ? config.channels.map(c => <section className="v-panel" key={c.id}><span className="v-badge">{c.deletedAt ? "已删除" : c.active ? "启用中" : "已停用"}</span><div className="v-form-grid"><Field label="渠道名字（内部）" value={c.name} onChange={v => change("channels", c.id, { name: v })}/><Field label="外部池名（A / B / C / owned 或自定义）" value={c.pool} onChange={v => change("channels", c.id, { pool: v })}/><Field label="渠道比例 %" type="number" value={c.percentage} onChange={v => change("channels", c.id, { percentage: Number(v), ourPercentage: 100 - Number(v) })}/><Field label="我方比例 %" type="number" value={c.ourPercentage} onChange={v => change("channels", c.id, { ourPercentage: Number(v), percentage: 100 - Number(v) })}/></div>{actions("channels", c)}</section>) : tab === "rules" ? config.rules.map(r => <section className="v-panel" key={r.id}><span className="v-badge">{r.deletedAt ? "已删除" : r.active ? "启用中" : "已停用"}</span><div className="v-form-grid"><Field label="规则名称" value={r.name} onChange={v => change("rules", r.id, { name: v })}/><label className="v-field">规则类型<select value={r.mode} onChange={e => change("rules", r.id, { mode: e.target.value })}>{[["weekly", "常规线下"], ["shortTerm", "短期家教（20天内）"], ["continuous", "连续课程（旧规则）"], ["monthly", "全职 / 住家（月薪）"], ["online", "线上（线下信息费基础的150%）"]].map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label><Field label="每周次数（5代表5次及以上）" value={r.frequency} type="number" onChange={v => change("rules", r.id, { frequency: Number(v) })}/><Field label="比例 %" value={r.percentage} type="number" onChange={v => change("rules", r.id, { percentage: Number(v) })}/></div>{actions("rules", r)}</section>) : config.dictionaries.filter(d => d.kind === tab).map(d => <section className="v-panel v-row" key={d.id}><Field label={`${dictionaryLabels[tab]}名称`} value={d.name} onChange={v => change("dictionaries", d.id, { name: v })}/><span className="v-badge">{d.deletedAt ? "已删除" : d.active ? "启用" : "停用"}</span>{actions("dictionaries", d)}</section>)}<div className="v-actions"><button onClick={add}>+ 新增</button><button disabled={busy} className="v-primary" onClick={() => void save()}>保存全部设置</button><button onClick={() => { setConfig(structuredClone(data.settings)); setMessage("未保存修改已撤回"); }}>撤回未保存修改</button></div></>; }

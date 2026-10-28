"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "./admin";
import { Alert, Field, Multi, Drawer, api } from "./shared";
import { businessStates, businessStatuses, financeStatuses, teacherTypeOptions, ledgerTypes, cashSummary, money, chinaDay, calculateDeal, type Order, type Audit } from "@/lib/v1/domain";
const labels: Record<string, string> = { orderCode: "订单编号", city: "城市", district: "区域", address: "公开地址", grade: "学员年级", gender: "学员性别", subjects: "科目", situation: "学习情况", goal: "辅导目标", schedule: "上课时间原描述", requirement: "老师要求", teacherGender: "老师性别要求", collegeRate: "大学生待遇（展示）", professionalRate: "专职待遇（展示）", perClassRate: "单次费用（展示）", frequency: "每周次数", duration: "单次时长（小时）", collegeMin: "大学生最低时薪", collegeMax: "大学生最高时薪", professionalMin: "专职最低时薪", professionalMax: "专职最高时薪", hourlyMin: "最低折算时薪", hourlyMax: "最高折算时薪", trialTime: "试课时间", teacherName: "老师姓名", teacherSource: "老师来源", trialRate: "试课时薪（元）", lessonCount: "连续辅导次数", monthlySalary: "月薪（元）", actualFee: "实际信息费（元，留空自动）", channelFeeOverride: "渠道费覆盖（元，留空自动）", incomeOverride: "最终收入覆盖（元，留空自动）", personalOverride: "个人收入覆盖（元，留空自动）", lostReason: "未成交原因", refundReason: "退费原因", refundAmount: "退费金额（元）", refundDate: "退费日期" };
const numeric = ["frequency", "duration", "collegeMin", "collegeMax", "professionalMin", "professionalMax", "hourlyMin", "hourlyMax", "trialRate", "lessonCount", "monthlySalary", "actualFee", "channelFeeOverride", "incomeOverride", "personalOverride", "refundAmount"];
export function OrderFields({ value, set, full = true, section = "all" }: {
 value: Order; set: (patch: Partial<Order>) => void; full?: boolean; section?: "all" | "details" | "followup" | "finance";
}) {
 const {data} = useAdmin();
 const [newField, setNewField] = useState("");
 const dict=(kind:string)=>data.settings.dictionaries.filter(d=>d.kind===kind && d.active && !d.deletedAt).map(d=>d.name);
 const field=(key:string)=>{
   const current=value[key as keyof Order];
   return <Field key={key} label={labels[key]} type={numeric.includes(key)?"number":key==="refundDate"?"date":["situation","goal","schedule","requirement"].includes(key)?"textarea":"text"} wide={["address","schedule","requirement","situation","goal"].includes(key)} value={key==="subjects"?value.subjects.join("、"):current as string|number|undefined} options={key==="teacherSource"?dict("teacherSource"):key==="lostReason"||key==="refundReason"?dict(key):undefined} onChange={v=>set({[key]:numeric.includes(key)?v===""?undefined:Number(v):key==="subjects"?v.split(/[、,，/]/).filter(Boolean):v})}/>;
 };
 const group=(number:string,title:string,keys:string[],extra?:React.ReactNode)=><section className="v-form-section"><div className="v-form-heading"><span>{number}</span><h3>{title}</h3></div><div className="v-form-grid">{keys.map(field)}{extra}</div></section>;
 const details=section==="all"||section==="details";
 return <>
 {details && <>
 {full && !!value.parseWarnings?.length && <Alert>原文解析提示（请结合已修正字段复核）：{value.parseWarnings.join("；")}</Alert>}
 {group("01","订单与学员",["orderCode","city","district","grade","gender","subjects","address"],<label className="v-field">内部渠道<select value={value.sourceChannel} onChange={e=>set({sourceChannel:e.target.value})}>{data.settings.channels.filter(c=>!c.deletedAt&&(c.active||c.id===value.sourceChannel)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
 {group("02","辅导内容与老师要求",["situation","goal","requirement","teacherGender"],<label className="v-field">老师类型<select value={value.teacherType} onChange={e=>set({teacherType:e.target.value})}>{teacherTypeOptions(data.settings.dictionaries).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}<option value="both">大学生 / 专职均可</option></select></label>)}
 {group("03","上课安排",["schedule","frequency","duration","trialTime"])}
 <Multi label="上课日期" options={["周一","周二","周三","周四","周五","周六","周日"]} value={value.weekdays.map(d=>["周一","周二","周三","周四","周五","周六","周日"][d-1]).filter(Boolean)} onChange={days=>set({weekdays:days.map(d=>["周一","周二","周三","周四","周五","周六","周日"].indexOf(d)+1)})}/>
 <Multi label="上课时段" options={["上午","下午","晚上"]} value={value.timePeriods} onChange={timePeriods=>set({timePeriods})}/>
 {group("04","课费待遇",["collegeRate","professionalRate","perClassRate"])}
 <details className="v-panel"><summary>核对折算时薪（用于筛选）</summary><p className="v-note">大学生、专职待遇分别保存。每次报价需结合单次时长折算，信息不完整时留空。</p><div className="v-form-grid">{["collegeMin","collegeMax","professionalMin","professionalMax","hourlyMin","hourlyMax"].map(field)}</div></details>
 <details className="v-panel"><summary>附加字段（{Object.keys(value.customFields).length}）</summary>{Object.entries(value.customFields).map(([key,v])=><div className="v-row" key={key}><Field label={key} value={v} onChange={next=>set({customFields:{...value.customFields,[key]:next}})}/><button type="button" onClick={()=>set({customFields:Object.fromEntries(Object.entries(value.customFields).filter(([k])=>k!==key))})}>移除字段</button></div>)}<div className="v-row"><Field label="新字段名称" value={newField} onChange={setNewField}/><button disabled={!newField.trim()} onClick={()=>{set({customFields:{...value.customFields,[newField.trim()]:value.customFields[newField.trim()]??""}});setNewField("");}}>+ 添加字段</button></div></details>
 </>}
 {full && (section==="all"||section==="followup") && <>
 {group("01","老师跟进",["teacherName","teacherSource"])}
 <section className="v-form-section"><div className="v-form-heading"><span>02</span><h3>订单进度与展示</h3></div><div className="v-form-grid"><Field label="业务状态" value={value.businessStatus} options={[...businessStatuses]} onChange={businessStatus=>set({businessStatus: businessStatus as Order["businessStatus"]})}/><label className="v-field">财务状态（自动）<input value={value.financeStatus || financeStatuses[0]} readOnly /></label><label className="v-field">上架状态<select value={value.state} onChange={e=>set({state:e.target.value})}><option value="draft">草稿</option>{value.publishedAt && <option value="published">上架</option>}<option value="delisted">下架</option></select></label><label className="v-field">机构有效性<select value={value.validity} onChange={e=>set({validity:e.target.value})}><option value="unverified">尚未确认</option><option value="confirmed">确认有效</option><option value="unavailable">已失效</option></select></label></div><p className="v-note">业务状态与财务状态、公开展示分别维护。成交后自动建立信息费快照，财务状态根据流水计算。</p></section>
 {value.businessStatus==="关闭"&&group("03","关闭原因",["lostReason"])}
 {(["退费中","已退费"].includes(value.businessState)||value.refundAmount>0)&&group("03","退费记录",["refundReason","refundAmount","refundDate"])}
 </>}
 {full && (section==="all"||section==="finance") && <>
 <section className="v-form-section"><div className="v-form-heading"><span>01</span><h3>信息费计费依据</h3></div><p className="v-note">所有渠道共用一套收费标准；下方分成比例根据订单渠道单独计算。</p><div className="v-form-grid"><label className="v-field">信息费规则<select value={value.feeMode} onChange={e=>set({feeMode:e.target.value})}>{[["weekly","线下常规家教"],["shortTerm","短期家教（20天内）"],["monthly","全职 / 住家（月薪）"],["online","线上（线下信息费×150%）"],["continuous","连续10/15/20次（旧规则）"]].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{(value.feeMode==="monthly"?["monthlySalary"]:["trialRate","duration",...(["continuous","shortTerm"].includes(value.feeMode)?["lessonCount"]:["frequency"])]).map(field)}</div></section>
 {group("02","实际费用与分成",["actualFee","channelFeeOverride","incomeOverride","personalOverride"])}
 <p className="v-note">留空使用自动计算；修改实际信息费后，分成按实际金额重新计算。</p>
 </>}
 </>;
}
export function LedgerForm({ order }: {
    order: Order;
}) { const { data, reload } = useAdmin(); const [type, setType] = useState("定金"), [amount, setAmount] = useState(""), [date, setDate] = useState(chinaDay()), [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); const cash = cashSummary(order, data.deals.find(d => d.orderId === order.id), data.ledger); async function save() { setBusy(true); try {
    await api("ledger.add", { id: crypto.randomUUID(), orderId: order.id, type, amount: Number(amount), date, reason });
    setMessage("流水已登记，仅记录实际发生的收支。");
    setAmount("");
    await reload();
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return <section className="v-panel"><h3>收款 / 退款 / 结算</h3><p className="v-note">{cash.status} · 实收 {money(cash.received)} · 退款 {money(cash.refunds)} · 净现金 {money(cash.netCash)}</p><div className="v-form-grid"><Field label="流水类型" value={type} options={ledgerTypes} onChange={setType}/><Field label="金额（元）" type="number" value={amount} onChange={setAmount}/><Field label="发生日期" type="date" value={date} onChange={setDate}/><Field label="原因 / 备注" value={reason} onChange={setReason}/></div><Alert>{message}</Alert><button disabled={busy || !Number(amount)} className="v-primary" onClick={() => void save()}>登记流水</button><div className="v-table-wrap"><table className="v-table"><thead><tr><th>日期</th><th>类型</th><th>金额</th><th>备注</th><th>操作</th></tr></thead><tbody>{data.ledger.filter(l => l.orderId === order.id).map(l => <tr key={l.id}><td>{l.date}</td><td>{l.type}{l.deletedAt ? "（已作废）" : ""}</td><td>{money(l.amount)}</td><td>{l.reason}</td><td>{!l.deletedAt && <button onClick={async () => { if (confirm("确认作废这笔流水？记录将保留。")) {
    try {
        await api("ledger.void", { id: l.id });
        await reload();
    }
    catch (e) {
        setMessage((e as Error).message);
    }
} }}>作废</button>}</td></tr>)}</tbody></table></div></section>; }
export function OrderDrawer({ initial, close, initialTab = "followup" }: {
    initial: Order;
    initialTab?: string;
    close: () => void;
}) { const [tab, setTab] = useState(initialTab); const { data, reload } = useAdmin(); const [value, setValue] = useState(initial), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [records, setRecords] = useState<{
    audit: Audit[];
    raw: {
        text: string;
        at: string;
    }[];
} | null>(null); const set = (patch: Partial<Order>) => setValue(v => ({ ...v, ...patch })); const previous = data.deals.find(d => d.orderId === initial.id); let formula = "", preview = previous; try {
    const c = data.settings.channels.find(c => c.id === value.sourceChannel);
    if (c) {
        preview = calculateDeal(value, c, data.settings.rules, previous);
        formula = preview.formula;
    }
}
catch (e) {
    formula = (e as Error).message;
} async function save(resume = false) { setBusy(true); try {
    const patch = Object.fromEntries(Object.entries({ ...value, actualFee: value.actualFee ?? null, channelFeeOverride: value.channelFeeOverride ?? null, incomeOverride: value.incomeOverride ?? null, personalOverride: value.personalOverride ?? null }));
    const updated = await api<Order>("order.update", { id: value.id, revision: value.revision, patch });
    setValue(updated);
    await reload();
    setMessage("已保存，老师端和财务统计同步更新。");
    if (resume) window.location.href = `/manage/new?draft=${encodeURIComponent(updated.id)}`;
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return <Drawer title={`订单 ${initial.orderCode}`} close={close}><div className="v-drawer-summary"><span className="v-badge">{value.businessState}</span><span>{value.grade} · {value.subjects.join(" / ")}</span><span>{value.district}</span></div><div className="v-drawer-tabs" role="tablist" aria-label="订单编辑分区">{[["followup","业务跟进"],["details","订单资料"],["finance","费用与流水"],["history","原文与历史"]].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?"selected":""} onClick={()=>setTab(key)}>{label}</button>)}</div><Alert>{message}</Alert>{tab==="followup" && <OrderFields value={value} set={set} section="followup"/>}{tab==="details" && <OrderFields value={value} set={set} section="details"/>}{tab==="finance" && <><OrderFields value={value} set={set} section="finance"/><section className="v-panel"><h3>信息费计算过程</h3><p className="v-formula">{formula}</p>{preview && <p>建议 {money(preview.suggested)} · 实际 {money(preview.actual)}<br />渠道 {preview.percentage}%：{money(preview.channelFee)}<br />最终总收入 {money(preview.income)} · 个人收入 {money(preview.personal)}</p>}<p className="v-note">首次成交保留规则及分成快照。留空覆盖值使用自动计算。再次改为成交不会重复建账。</p></section><LedgerForm order={data.orders.find(o => o.id === value.id) ?? value}/></>}{tab==="history" && <><h3>原始订单全文（永久保留）</h3><pre className="v-raw">{value.rawText}</pre><details open onToggle={async (e) => { if (e.currentTarget.open) {
    try {
        const r = await fetch(`/api/v1?scope=history&id=${encodeURIComponent(value.id)}`);
        if (!r.ok) throw new Error("历史记录加载失败，请重新展开后重试");
        setRecords(await r.json());
    } catch (error) { setMessage((error as Error).message); }
} }}><summary>修改历史与历次原文</summary>{records?.raw.map((r, i) => <pre className="v-raw" key={i}>{r.at}{"\n"}{r.text}</pre>)}{records?.audit.map(r => <div className="v-panel" key={r.id}><b>{r.actor} · {new Date(r.at).toLocaleString()}</b>{r.changes.map((c, i) => <p className="v-note" key={i}>{labels[c.field] ?? c.field}：{JSON.stringify(c.before)} → {JSON.stringify(c.after)}</p>)}</div>)}</details></>}<div className="v-actions"><button className="v-primary" disabled={busy} onClick={() => void save()}>保存订单及财务</button>{value.state === "draft" && !value.deletedAt && <button disabled={busy} onClick={() => void save(true)}>保存并继续校对发布</button>}<button onClick={close}>关闭</button></div></Drawer>; }
type Draft = {
    order: Order;
    missing: string[];
    parseConfidence?: number;
    parseWarnings?: string[];
    duplicates: {
        id: string;
        revision: number;
        orderCode: string;
        address: string;
        grade: string;
        subjects: string[];
        same: boolean;
        identical: boolean;
    }[];
    choice?: string;
    targetId?: string;
};
const samples: Record<string, string> = { jiang: "广州26999000\n【上课地址】越秀区（测试区域）\n【年级性别】初三男\n【补习科目】政治\n【学生情况】巩固提升\n【上课时间】一周一次，一次2小时，周六下午\n【老师要求】女老师有经验，有方式方法 专业对口，示例高校\n【工资待遇】大学生140一小时", yang: "🪽GZ-DEMO-003\n【地址】：越秀区（测试区域）\n【年级】：1年级，英语\n【基本情况】：2个小孩，喜欢读书，英语带读英文原版读物\n【时间】：一周4次，一次1h，周一到周四下午4—6点之间的一个小时\n【要求】：女大学生，有耐心，英语六级及以上，一本及以上，有经验\n【课费】：140-160/2h", pengcheng: "🆔 信息编号｜DEMO-ORDER-002\n📚 年级科目｜高三 数学 / 物理 / 可分开带\n📍 辅导地点｜广州市黄埔区（测试区域）\n💰 课费报酬｜120-150元/h\n🗓️ 时间次数｜周一到周五晚上，一次两小时\n⏰ 试课时间｜最近\n🧑 学生情况｜女孩 数学30+，物理30+\n✨ 老师要求｜有经验，有方法技巧，擅长补基础", owned: "📚 年级科目｜初二 数学\n📍 辅导地点｜海珠区（测试区域）\n💰 课费报酬｜大学生80/h，专职220/h\n🗓️ 时间次数｜一周5次，一次2.5小时，周一到周五晚8点\n⏰ 试课时间｜协商\n🧑 学生情况｜巩固基础\n✨ 老师要求｜大学生/专职均可" };
export function Intake() { const { data, reload } = useAdmin(); const [source, setSource] = useState("jiang"), [text, setText] = useState(""), [drafts, setDrafts] = useState<Draft[]>([]), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id) return;
    let cancelled = false;
    setBusy(true);
    api<Draft>("order.check", { id }).then(row => {
        if (!cancelled) { setDrafts([row]); setSource(row.order.sourceChannel); setText(row.order.rawText); setMessage("已读取保存的草稿，请核对字段和重复处理方式后发布。"); }
    }).catch(e => { if (!cancelled) setMessage((e as Error).message); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
}, []);
async function parse() {
    if (drafts.length && !confirm("重新解析会替换当前校对列表，未保存的字段修改会丢失。原草稿仍保存在订单管理中，是否继续？")) return;
    setBusy(true); try {
    const rows = await api<Draft[]>("parse", { source, text });
    setDrafts(rows);
    await reload();
    setMessage(`已解析 ${rows.length} 条草稿。确认字段及重复处理后再发布。`);
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} }
async function saveDraft(draft: Draft) {
    setBusy(true);
    try {
        const updated = await api<Order>("order.update", { id: draft.order.id, revision: draft.order.revision, patch: draft.order });
        setDrafts(rows => rows.map(row => row.order.id === updated.id ? { ...row, order: updated } : row));
        const checked = await api<Draft>("order.check", { id: updated.id });
        setDrafts(rows => rows.map(row => row.order.id === updated.id ? checked : row));
        await reload();
        setMessage("草稿已保存并重新查重，稍后可从订单管理继续校对发布。");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
}
async function publish() { setBusy(true); try {
    const saved = [];
    for (const d of drafts) {
        if (d.choice === "skip") {
            saved.push({ id: d.order.id, revision: d.order.revision, choice: "skip", targetId: undefined, targetRevision: undefined });
            continue;
        }
        const order = await api<Order>("order.update", { id: d.order.id, revision: d.order.revision, patch: d.order });
        d.order = order;
        setDrafts(rows => rows.map(row => row.order.id === order.id ? { ...row, order } : row));
        saved.push({ id: order.id, revision: order.revision, choice: d.choice ?? "", targetId: d.targetId ?? d.duplicates[0]?.id, targetRevision: d.duplicates.find(x => x.id === (d.targetId ?? d.duplicates[0]?.id))?.revision });
    }
    setDrafts([...drafts]);
    await api("order.publish", { items: saved });
    setDrafts([]);
    await reload();
    setMessage("本批处理完成。发布订单已进入老师端，跳过的草稿已移入可恢复的回收站。");
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return <div className="v-intake"><h1>快速录单</h1><p className="v-subtitle">粘贴机构订单，核对信息后，一次发布到老师端。</p><ol className="v-stepper"><li className={!drafts.length?"active":""}><b>1</b>选择渠道</li><li className={!drafts.length?"active":""}><b>2</b>粘贴原文</li><li className={drafts.length?"active":""}><b>3</b>核对与发布</li></ol><section className="v-panel"><h2>订单来自哪个渠道？</h2><div className="v-source-grid">{data.settings.channels.filter(c => c.active && !c.deletedAt).map(c => <button key={c.id} className={source === c.id ? "selected" : ""} onClick={() => setSource(c.id)}><b>{c.name}</b><small>对外展示：{c.pool === "owned" ? "高性价比急出单" : /^[ABC]$/.test(c.pool) ? c.pool + "池" : c.pool}</small></button>)}</div><div className="v-raw-input"><Field label="订单原文（支持批量，原文会永久保留）" type="textarea" wide value={text} onChange={setText}/></div><div className="v-row" style={{ marginTop: 14 }}><button onClick={() => setText(samples[source] ?? samples.owned)}>填入该渠道演示样本</button><button className="v-primary" disabled={busy || !text.trim()} onClick={() => void parse()}>解析并查重</button></div></section><Alert>{message}</Alert>{drafts.map((d, i) => <section key={d.order.id} className="v-panel"><div className="v-draft-top"><div><h2>第 {i + 1} 条 · {d.order.orderCode}</h2><p>请核对地址、学员、时间和待遇，再确认发布。</p></div><button disabled={busy} onClick={() => void saveDraft(d)}>保存草稿并重新查重</button><button className="v-danger" disabled={busy} onClick={async () => { try {await api("order.delete", { id: d.order.id, revision: d.order.revision }); setDrafts(v => v.filter(x => x.order.id !== d.order.id)); await reload();} catch(error){setMessage((error as Error).message);} }}>移除草稿</button></div>{!!d.missing.length && <Alert>需检查：{d.missing.join("、")}</Alert>}<div className="v-draft-layout"><aside className="v-draft-raw"><h3>原始订单 · 对照核验</h3><pre className="v-raw">{d.order.rawText}</pre></aside><div><OrderFields value={d.order} full={false} set={p => setDrafts(rows => rows.map((row, n) => n === i ? { ...row, order: { ...row.order, ...p } } : row))}/></div></div>{!!d.duplicates.length && <div className="v-alert"><b>{d.duplicates[0].identical ? "原文完全相同，请确认更新原单或跳过" : d.duplicates[0].same ? "疑似重复订单" : "相同编号，但订单内容差异较大"}</b>{d.duplicates.map(x => <p key={x.id}>{x.orderCode} · {x.address} · {x.grade} · {x.subjects.join("/")}</p>)}<label className="v-field">处理方式<select value={d.choice ?? ""} onChange={e => setDrafts(rows => rows.map((row, n) => n === i ? { ...row, choice: e.target.value } : row))}><option value="">请选择处理方式</option><option value="replace">以当前内容更新原订单</option><option value="new">作为新订单保留 / 已修改编号</option><option value="skip">跳过，以旧订单为主</option></select></label>{d.duplicates.length > 1 && <label className="v-field">要覆盖的原订单<select value={d.targetId ?? d.duplicates[0]?.id} onChange={e => setDrafts(rows => rows.map((row, n) => n === i ? { ...row, targetId: e.target.value } : row))}>{d.duplicates.map(x => <option key={x.id} value={x.id}>{x.orderCode} · {x.address} · {x.grade}</option>)}</select></label>}</div>}</section>)}{!!drafts.length && <div className="v-review-toolbar"><span>共 {drafts.length} 条草稿 · {drafts.filter(d=>d.duplicates.length&&!d.choice).length} 条重复待处理</span><button className="v-primary" disabled={busy || drafts.some(d => d.duplicates.length && !d.choice)} onClick={() => void publish()}>确认处理本批 · 发布 {drafts.filter(d => d.choice !== "skip").length} 条</button></div>}<p><Link href="/manage/orders">查看草稿与全部订单 →</Link></p></div>; }
export function Orders() { const { data, reload } = useAdmin(); const [query, setQuery] = useState(""), [channel, setChannel] = useState(""), [state, setState] = useState(""), [trash, setTrash] = useState(false), [selected, setSelected] = useState<Order | null>(null), [message, setMessage] = useState(""), [page, setPage] = useState(1); const rows = data.orders.filter(o => !!o.deletedAt === trash && (!channel || o.sourceChannel === channel) && (!state || o.businessState === state || o.state === state) && `${o.orderCode} ${o.address} ${o.teacherName}`.includes(query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const pages = Math.max(1, Math.ceil(rows.length / 20)), p = Math.min(page, pages); async function remove(o: Order, action: string) { if (!confirm(action === "order.purge" ? "永久删除结构化订单？原文审计仍会保留，此操作无法撤销。" : action === "order.restore" ? "确认恢复这条订单？" : "移入回收站后老师端不再显示，确认？"))
    return; try {
    await api(action, { id: o.id, revision: o.revision });
    await reload();
}
catch (e) {
    setMessage((e as Error).message);
} } return <><div className="v-row v-between"><h1>订单管理</h1><Link className="v-primary" href="/manage/new">+ 快速录单</Link></div><div className="v-toolbar"><input placeholder="订单编号 / 地址 / 老师姓名" aria-label="搜索内部订单" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/><select aria-label="筛选订单渠道" value={channel} onChange={e => { setChannel(e.target.value); setPage(1); }}><option value="">全部渠道</option>{data.settings.channels.map(c => <option key={c.id} value={c.id}>{c.name}{c.deletedAt ? "（已删除）" : ""}</option>)}</select><select aria-label="筛选订单状态" value={state} onChange={e => { setState(e.target.value); setPage(1); }}><option value="">全部状态</option><option value="draft">草稿</option><option value="published">上架中</option><option value="delisted">下架</option>{businessStates.map(s => <option key={s}>{s}</option>)}</select><button className={trash ? "selected" : ""} onClick={() => { setTrash(!trash); setPage(1); }}>{trash ? "返回全部订单" : "回收站"}</button><Link href="/manage/review">家长需求审核 →</Link></div><Alert>{message}</Alert><div className="v-table-wrap"><table className="v-table"><thead><tr>{["序号", "订单日期", "渠道来源", "订单编号", "老师姓名", "老师来源", "状态 / 上架", "试课时薪", "上课频率", "总信息费", "中介信息费", "最终总收入", "个人收入", "操作"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice((p - 1) * 20, p * 20).map((o, i) => { const d = data.deals.find(d => d.orderId === o.id); return <tr key={o.id}><td>{(p - 1) * 20 + i + 1}</td><td>{chinaDay(o.createdAt)}</td><td>{data.settings.channels.find(c => c.id === o.sourceChannel)?.name}</td><td><button onClick={() => setSelected(o)}>{o.orderCode || "未编号草稿"}</button></td><td>{o.teacherName || "—"}</td><td>{o.teacherSource || "—"}</td><td><span className="v-status-chip">{o.state === "draft" ? "待校对发布" : o.businessState}</span><br /><small>{{ draft: "草稿", published: "上架", delisted: "下架" }[o.state]}</small></td><td>¥{o.trialRate || "—"}</td><td>{o.frequency || "待确认"}次 / 周 · {o.duration || "?"}h</td><td>{d ? money(d.actual) : "—"}</td><td>{d ? money(d.channelFee) : "—"}</td><td>{d ? money(d.income) : "—"}</td><td>{d ? money(d.personal) : "—"}</td><td><div className="v-row"><button onClick={() => setSelected(o)}>编辑</button>{!trash && o.state === "draft" && <Link href={`/manage/new?draft=${encodeURIComponent(o.id)}`}>校对发布</Link>}{trash ? <><button onClick={() => void remove(o, "order.restore")}>恢复</button>{data.role === "admin" && <button className="v-danger" onClick={() => void remove(o, "order.purge")}>永久删除</button>}</> : <button onClick={() => void remove(o, "order.delete")}>删除</button>}</div></td></tr>; })}</tbody></table></div>{!rows.length && <div className="v-empty">暂无订单</div>}<div className="v-pagination"><button disabled={p === 1} onClick={() => setPage(p - 1)}>上一页</button>{p} / {pages} · 共{rows.length}条<button disabled={p === pages} onClick={() => setPage(p + 1)}>下一页</button></div>{selected && <OrderDrawer key={selected.id} initial={selected} close={() => setSelected(null)}/>}</>; }

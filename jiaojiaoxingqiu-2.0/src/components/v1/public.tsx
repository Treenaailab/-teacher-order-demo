"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { GraduationCap, ShieldCheck, BriefcaseBusiness, ArrowRight, UserRound } from "lucide-react";
import { chinaDay, grades, teacherTypeOptions, publicCopy, profileLabels, gradeMatches, type PublicOrder, type PublicTeacher, type Teacher, type Dictionary } from "@/lib/v1/domain";
import { emptyFilters, filterOrders, type Filters } from "@/lib/v1/filters";
import { Nav, Footer, Field, Multi, Alert, Drawer, api, useData } from "./shared";
type PublicData = {
    orders: PublicOrder[];
    teachers: PublicTeacher[];
    dictionaries: Dictionary[];
    batches: {
        id: string;
        createdAt: string;
        items: {
            pool: string;
            district: string;
            isNew: boolean;
        }[];
    }[];
};
export { TeacherFeed } from "./feed";
const teacherFields: [
    keyof Teacher,
    string,
    string?
][] = [["name", "姓名"], ["gender", "性别"], ["school", "学校"], ["major", "专业"], ["currentGrade", "当前年级"], ["education", "学历"], ["teachingYears", "教龄"], ["certificate", "教师资格证"], ["currentlyTeaching", "是否目前在带学生"], ["experience", "教学经验", "textarea"], ["strengths", "擅长方向", "textarea"], ["style", "教学风格"], ["suitable", "适合什么类型学生"], ["district", "常驻区域"], ["availableTime", "可授课时间"], ["minimumRate", "最低期望时薪（元/h）", "number"], ["certificates", "相关证书"], ["intro", "自我介绍", "textarea"], ["wechat", "微信"], ["phone", "手机号"]];
export function TeacherFields({ value, set, admin = false, types }: {
 value: Partial<Teacher>; set: (patch:Partial<Teacher>)=>void; admin?:boolean; types?:Dictionary[];
}) {
 const displayField=(key:keyof Teacher)=>{
  const entry=teacherFields.find(([k])=>k===key); if(!entry)return null;
  const [,label,type]=entry;
  const options=key==="gender"?["男","女"]:key==="currentlyTeaching"?["是","否"]:undefined;
  return <Field key={key} label={label} value={value[key] as string|number} type={type} wide={type==="textarea"} options={options} required={["name","wechat","phone","intro"].includes(key)} onChange={v=>set({[key]:type==="number"?Number(v):v})}/>;
 };
 const group=(n:string,title:string,description:string,keys:(keyof Teacher)[],children?:React.ReactNode)=><section className="v-form-section"><div className="v-form-heading"><span>{n}</span><h3>{title}</h3></div><p>{description}</p><div className="v-form-grid">{keys.map(displayField)}</div>{children}</section>;
 return <>
 <div className="v-type-choice" role="group" aria-label="选择老师类型">{teacherTypeOptions(types).map(t=><button type="button" key={t.value} className={(value.teacherType??"college")===t.value?"selected":""} aria-pressed={(value.teacherType??"college")===t.value} onClick={()=>set({teacherType:t.value})}>{t.value==="professional"?<BriefcaseBusiness size={27}/>:<GraduationCap size={27}/>}<span><b>{t.label.replace(/老师$/,"")}老师</b><small>{t.value==="professional"?"展示教龄与专业教学经验":"展示学校、专业与教学优势"}</small></span></button>)}</div>
 {group("01","基本资料","让平台了解你的教育背景与教学经历。",value.teacherType==="professional"?["name","gender","school","education","major","teachingYears","certificate","currentlyTeaching"]:["name","gender","school","major","currentGrade"])}
 {group("02","授课能力与安排","这些内容将在审核后展示给家长。",["district","availableTime","minimumRate"],<><Multi label="可教年级" options={[...grades,"小学","初中","高中"]} value={value.grades??[]} onChange={grades=>set({grades})}/><div className="v-form-grid"><Field label="可教科目（多个用顿号分隔）" value={value.subjects?.join("、")} onChange={v=>set({subjects:v.split(/[、,，/]/)})}/><Field label="可授课区域（多个用顿号分隔）" value={value.areas?.join("、")} onChange={v=>set({areas:v.split(/[、,，/]/)})}/></div></>)}
 {group("03","教学介绍","写清楚你擅长什么、如何教学，以及适合哪些学生。",["experience","strengths","style","suitable","certificates","intro"])}
 {group("04","联系方式","仅平台内部可见，家长端不展示完整姓名、微信和手机号。",["wechat","phone"])}
 {admin && <section className="v-form-section"><div className="v-form-heading"><span>05</span><h3>内部运营资料</h3></div><div className="v-form-grid"><Field label="老师来源" value={value.source} options={types?.filter(d=>d.kind==="teacherSource"&&d.active&&!d.deletedAt).map(d=>d.name)} onChange={source=>set({source})}/><Field label="跟进状态" value={value.followup} options={["待跟进","待完善资料","待审核","已公开","已隐藏"]} onChange={followup=>set({followup})}/><Field label="内部备注" type="textarea" wide value={value.notes} onChange={notes=>set({notes})}/><Field label="认证标签（仅经核验后填写）" value={value.verified?.join("、")} wide onChange={v=>set({verified:v.split("、").filter(Boolean)})}/></div></section>}
 </>;
}
export function TeacherRegistration() { const { data: catalog } = useData<PublicData>(); const { data, error, reload } = useData<{
    teacher: Teacher | null;
}>("me"); const initialLoaded = useRef(false); const [value, setValue] = useState<Partial<Teacher>>({ teacherType: "college", subjects: [], grades: [], areas: [] }), [message, setMessage] = useState(""), [busy, setBusy] = useState(false); useEffect(() => { if (data && !initialLoaded.current) { if(data.teacher) setValue(data.teacher); initialLoaded.current=true; } }, [data]); async function save(state: string) { setBusy(true); try {
    const result = await api<{
        teacher: Teacher;
    }>("teacher.submit", { patch: { ...value, state }, revision: value.revision });
    setValue(result.teacher);
    setMessage(state === "draft" ? "草稿已保存，可继续完善。" : "资料已提交审核。审核通过后才会公开；姓名和联系方式会被保护。");
    await reload();
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return <div className="v-app"><Nav /><main className="v-main"><section className="v-hero"><span className="v-eyebrow">加入家教星球 · 展示你的教学优势</span><h1>让家长主动看到你</h1><p className="v-subtitle">登记学校、专业与教学经验，加入家教星球师资库。不登记也可以浏览订单。</p><div className="v-row"><Link href="/teacher">先看看订单 →</Link>{value.state && <span className="v-badge">{profileLabels[value.state]}</span>}</div></section><Alert>{error || message}</Alert><div className="v-profile-layout"><section className="v-panel"><TeacherFields types={catalog?.dictionaries} value={value} set={p => setValue(v => ({ ...v, ...p }))}/><p className="v-note">微信、手机号和完整姓名仅内部可见。公开资料请勿自行填写联系方式。当前浏览器保留“我的资料”访问凭证，修改后需要重新审核。</p><div className="v-profile-actions"><button disabled={busy || !data} onClick={() => void save("draft")}>保存草稿</button><button disabled={busy || !data} className="v-primary" onClick={() => void save("pending_review")}>提交审核</button></div></section><aside className="v-profile-aside"><ShieldCheck size={27}/><h3>认真介绍，让家长了解你</h3><p>资料提交后由平台审核。完整姓名与联系方式仅供内部对接。</p><ul><li>填写教育与教学背景</li><li>补充授课范围和时间</li><li>提交资料等待审核</li><li>审核后进入公开师资库</li></ul><Link href="/parent">看看公开简历展示 →</Link></aside></div></main><Footer /></div>; }
export function ParentTeachers() { const { data, error } = useData<PublicData>(); const [grade, setGrade] = useState(""), [subject, setSubject] = useState(""), [filter, setFilter] = useState({ grade: "", subject: "" }), [selected, setSelected] = useState<PublicTeacher | null>(null); const teachers = data?.teachers.filter(t => (!filter.grade || t.grades.some(g => gradeMatches(g, filter.grade))) && (!filter.subject || t.subjects.includes(filter.subject))) ?? []; return <div className="v-app"><Nav /><main className="v-main"><section className="v-hero v-parent-hero"><span className="v-eyebrow">家教星球 · 公开师资库</span><h1>每个孩子，<em>都有适合的老师。</em></h1><p>了解老师的教学经验与擅长方向。平台审核资料后展示，具体对接由助理在微信完成。</p></section><section className="v-panel v-parent-search"><div className="v-form-grid"><Field label="孩子年级" value={grade} onChange={setGrade} options={["", ...grades]}/><Field label="辅导科目" value={subject} onChange={setSubject} options={["", ...data?.dictionaries.filter(d => d.kind === "subject").map(d => d.name) ?? []]}/><button className="v-primary" onClick={() => setFilter({ grade, subject })}>查看适合的老师</button></div></section><Alert>{error}</Alert><div className="v-parent-results"><h2>认识适合的老师</h2><span>{data?teachers.length+" 位符合条件":"正在读取师资…"}</span></div><div className="v-grid">{teachers.map(t => <article className="v-card v-teacher-card" key={t.id}><div className="v-teacher-head"><span className="v-avatar">{t.displayName[0]}</span><div><h3>{t.displayName}</h3><small>{teacherTypeOptions(data?.dictionaries).find(x => x.value === t.teacherType)?.label ?? t.teacherType} · {t.major}</small></div></div><p>可教：{t.grades.join(" / ")} · {t.subjects.join(" / ")}</p><p>擅长：{t.strengths || "待补充"}<br />教学经验：{t.experience || "待补充"}<br />教学风格：{t.style || "待补充"}<br />适合：{t.suitable || "待补充"}</p><div className="v-chips">{t.verified.map(x => <span className="v-badge" key={x}>{x}</span>)}</div><footer><strong>{t.minimumRate ? `参考 ¥${t.minimumRate}/h 起` : "课时费待沟通"}</strong><button onClick={() => setSelected(t)}>查看老师资料</button></footer></article>)}</div>{data && !teachers.length && <div className="v-empty"><UserRound size={30}/><h3>暂时没有符合条件的老师</h3><p>试试其他年级或科目，也可以留下辅导需求。</p><button onClick={()=>{setGrade("");setSubject("");setFilter({grade:"",subject:""});}}>查看全部老师</button></div>}<section className="v-cta v-section"><h2>也可以留下辅导需求</h2><p>需求先进入内部审核，联系方式不会公开。</p><Link className="v-primary" href="/parent/request">提交辅导需求 →</Link></section></main><Footer />{selected && <Drawer title={selected.displayName} close={() => setSelected(null)}><div className="v-panel v-teacher-card"><span className="v-avatar">{selected.displayName[0]}</span>{[["性别", selected.gender], ["学校", selected.school], ["专业", selected.major], ["学历/年级", selected.education || selected.currentGrade], ["可教", selected.grades.join(" / ") + " · " + selected.subjects.join(" / ")], ["经验", selected.experience], ["擅长", selected.strengths], ["风格", selected.style], ["适合", selected.suitable], ["时间", selected.availableTime], ["参考课时费", selected.minimumRate ? `¥${selected.minimumRate}/h 起` : "待沟通"], ["教龄", selected.teachingYears], ["认证标签", selected.verified.join(" / ")], ["自我介绍", selected.intro]].map(([k, v]) => <p key={k}><b>{k}</b><br />{v || "未填写"}</p>)}<p className="v-note">感兴趣请通过微信联系平台助理，并提供老师展示名称。</p></div></Drawer>}</div>; }

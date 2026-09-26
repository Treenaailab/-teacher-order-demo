"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, Search, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { demoTeachers } from "@/lib/demo-data";
import "../manage.css";

type Teacher = { id: string; display_name: string; school: string | null; preferred_districts: string[]; created_at: string; teacher_type?:string; major?:string; subjects?:string[]; teaching_districts?:string[]; minimum_hourly_rate?:string; wechat?:string; phone?:string };

export default function TeachersPage() {
  const supabase = createClient();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) { let submitted:Teacher[]=[];try{submitted=JSON.parse(localStorage.getItem("teacher-roster-v1")||"[]")}catch{} setTeachers([...submitted,...demoTeachers]); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("请先登录内部账号。"); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!profile || !["operator", "admin"].includes(profile.role)) { setError("此页面仅对 Operator 和 Admin 开放。"); setLoading(false); return; }
      const { data, error: loadError } = await supabase.from("profiles").select("id,display_name,school,preferred_districts,created_at").eq("role", "teacher").order("created_at", { ascending: false }).limit(500);
      if (!alive) return;
      if (loadError) setError(loadError.message); else setTeachers((data ?? []) as Teacher[]);
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [supabase]);

  const visible = useMemo(() => teachers.filter((teacher) => `${teacher.display_name} ${teacher.school ?? ""} ${(teacher.preferred_districts ?? []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [teachers, query]);

  return <main className="manage-shell"><header className="manage-topbar"><a className="brand" href="/manage"><span className="brand-mark"><UsersRound size={18}/></span><span>老师<span className="brand-muted">·</span>名册</span></a><a className="back-link" href="/manage"><ArrowLeft size={15}/> 返回运营首页</a></header><div className="manage-content"><div className="manage-breadcrumb">内部运营 <span>/</span> 老师名册</div><div className="manage-title-row"><div><span className="section-kicker">TEACHER DIRECTORY</span><h1>老师名册</h1><p>查看老师姓名、学校和常驻区域，供内部运营筛选参考。</p></div><span className="private-pill"><UsersRound size={14}/> 仅内部可见</span></div>
    {error && <div className="form-alert"><CircleAlert size={16}/>{error}{error.includes("登录") && <a href="/auth">前往登录</a>}</div>}
    {!error && <><div className="manage-dashboard-grid"><div className="manage-stat"><span>已注册老师</span><strong>{loading ? "—" : teachers.length}</strong></div></div><input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索老师姓名、学校或常驻区域"/><div className="admin-table-wrap"><table className="order-admin-table"><thead><tr><th>老师姓名 / 类型</th><th>学校 / 专业</th><th>常驻 / 可授课区域</th><th>科目 / 最低时薪</th><th>微信 / 手机号</th><th>注册日期</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>正在加载…</td></tr> : visible.length ? visible.map((teacher) => <tr key={teacher.id}><td><b>{teacher.display_name}</b><br/><span>{teacher.teacher_type==="professional"?"专职老师":teacher.teacher_type==="college"?"大学生老师":"演示老师"}</span></td><td>{teacher.school || "未填写"}<br/><span>{teacher.major||""}</span></td><td>{teacher.preferred_districts?.join("、")||"未填写"}<br/><span>{teacher.teaching_districts?.join("、")||""}</span></td><td>{teacher.subjects?.join("、")||"—"}<br/><span>{teacher.minimum_hourly_rate?`最低 ¥${teacher.minimum_hourly_rate}/小时`:""}</span></td><td>{teacher.wechat||"—"}<br/><span>{teacher.phone||""}</span></td><td>{new Date(teacher.created_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</td></tr>) : <tr><td colSpan={6}><Search size={14}/> 暂无匹配老师</td></tr>}</tbody></table></div><div className="table-count">当前显示 {visible.length} 位老师；最多读取最近 500 位</div></>}
    </div></main>;
}

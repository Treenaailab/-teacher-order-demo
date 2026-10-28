"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, BookOpen, CalendarDays, Check, Copy, GraduationCap, MapPin, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Users, Wallet, X } from "lucide-react";
import { chinaDay, grades, teacherTypeOptions, publicCopy, type PublicOrder, type Dictionary } from "@/lib/v1/domain";
import { emptyFilters, filterOrders, type Filters } from "@/lib/v1/filters";
import { Nav, Footer, Field, Multi, Alert, Drawer, useData } from "./shared";

type FeedData = {
  orders: PublicOrder[];
  pools?: string[];
  dictionaries: Dictionary[];
  batches: { id: string; createdAt: string; items: { pool: string; district: string; isNew: boolean }[] }[];
};
const poolLabel = (p: string) => p === "owned" ? "高性价比急出单" : /^[A-Z]$/.test(p) ? `${p}池` : p;
function dateLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (chinaDay(value) === chinaDay()) return `${Math.floor(minutes / 60)}小时前`;
  return new Date(value).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" });
}
function compensation(order: PublicOrder) {
  return [order.collegeRate && `大学生 ${order.collegeRate}`, order.professionalRate && `专职 ${order.professionalRate}`, !order.collegeRate && !order.professionalRate && order.perClassRate].filter(Boolean).join("；") || "待遇待确认";
}
export function OrderCard({ order, onCopy, copied = false }: { order: PublicOrder; onCopy: () => void; copied?: boolean }) {
  const facts = [["地址", order.address], ["学员", `${order.grade}${order.gender && !order.grade.includes(order.gender) ? ` · ${order.gender}` : ""}`], ["科目", order.subjects.join(" / ")], ["情况", order.situation], ["目标", order.goal], ["时间", order.schedule], ["要求", order.requirement], ["待遇", compensation(order)]];
  return <article className="v-card v-order-card">
    <div className="v-card-head"><span className={`v-badge pool-${order.pool}`}>{order.publicPoolLabel}</span>{order.completed && <span className="v-badge v-badge-completed">已成交</span>}<span className="v-order-code">{order.orderCode}</span><time dateTime={order.publishedAt}>{chinaDay(order.publishedAt) === chinaDay() && <b>NEW · </b>}{dateLabel(order.publishedAt)}</time></div>
    <h3>{order.grade}<span> / </span>{order.subjects.join("、")}</h3>
    <dl>{facts.filter(([, value]) => value).map(([label, value]) => <div className="v-fact" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <footer><span className="v-card-contact">{order.completed ? "该订单已成交，暂不接受咨询" : "复制订单，微信咨询助理"}</span>{order.completed ? <button className="v-copy v-copy-disabled" disabled aria-label="该订单已成交，暂不接受咨询">已成交</button> : <button className={copied ? "v-copy copied" : "v-copy"} onClick={onCopy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "已复制" : "复制完整信息"}</button>}</footer>
  </article>;
}
export function TeacherFeed() {
  const { data, error, reload } = useData<FeedData>();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState("");
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const orders = data?.orders ?? [];
  const results = useMemo(() => filterOrders(orders, filters).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [orders, filters]);
  const pages = Math.max(1, Math.ceil(results.length / 10));
  const currentPage = Math.min(page, pages);
  useEffect(() => setPage(1), [filters]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters(previous => ({ ...previous, [key]: value }));
  const consultable = orders.filter(order => !order.completed);
  const today = orders.filter(order => chinaDay(order.publishedAt) === chinaDay());
  const todayOpen = today.filter(order => !order.completed);
  const high = Math.max(0, ...todayOpen.map(order => order.hourlyMax ?? 0));
  const choices = (kind: string) => data?.dictionaries.filter(d => d.kind === kind).map(d => d.name) ?? [];
  const pools = [...new Set(["A", "B", "C", "owned", ...(data?.pools ?? []), ...orders.map(order => order.pool)])];
  const tags = [
    ...(["pools", "districts", "subjects", "grades", "times"] as const).flatMap(key => filters[key].map(value => ({ label: key === "pools" ? poolLabel(value) : value, remove: () => set(key, filters[key].filter(x => x !== value)) }))),
    ...(["type", "date", "min", "max"] as const).filter(key => filters[key]).map(key => ({ label: key === "type" ? teacherTypeOptions(data?.dictionaries).find(t => t.value === filters.type)?.label ?? filters.type : key === "min" ? `≥ ¥${filters.min}/h` : key === "max" ? `≤ ¥${filters.max}/h` : filters[key], remove: () => set(key, "") }))
  ];
  const scrollFeed = () => document.getElementById("feed")?.scrollIntoView({ behavior: "auto", block: "start" });
  function quick(type: string) {
    if (type === "today") setFilters({ ...emptyFilters, date: "今天" });
    if (type === "high") setFilters({ ...emptyFilters, min: "150" });
    if (type === "highest" && high) setFilters({ ...emptyFilters, date: "今天", min: String(high) });
    if (type === "all") setFilters({ ...emptyFilters });
    if (type === "filter") setExpanded(true);
    scrollFeed();
  }
  async function copy(order: PublicOrder) {
    if (order.completed) return;
    const text = publicCopy(order);
    try {
      if (!navigator.clipboard) throw new Error("manual");
      await navigator.clipboard.writeText(text);
      setCopied(order.id); setMessage("完整订单已复制，现在可以到微信咨询助理。");
    } catch { setManual(text); }
  }
  async function refresh() { setRefreshing(true); await reload(); setRefreshing(false); }
  return <div className="v-app"><Nav/><main className="v-main">
    <section className="v-hero v-home-hero">
      <div className="v-hero-copy"><span className="v-eyebrow"><span className="v-live-dot"/> 家教星球 · 广州家教机会</span><h1>认真教学的你，<br/><em>值得被看见。</em></h1><p>在这里找到合适的学生，也让家长遇见合适的老师。<br className="v-desktop-only"/>每一份新机会，都从一次认真了解开始。</p><div className="v-hero-proof"><span><ShieldCheck size={15}/>人工审核发布</span><span><BookOpen size={15}/>完整订单信息</span><span><Users size={15}/>微信助理承接</span></div></div>
      <div className="v-role-stack"><a className="v-role-card teacher" href="#feed"><span className="v-role-icon"><GraduationCap size={25}/></span><div><small>我是老师</small><h2>我想找学生 / 找家教单</h2><p>无需注册，直接浏览最新家教机会</p></div><ArrowUpRight size={22}/></a><Link className="v-role-card parent" href="/parent"><span className="v-role-icon"><Users size={24}/></span><div><small>我是学生 / 家长</small><h2>我想找老师</h2><p>按孩子年级和科目，了解合适的师资</p></div><ArrowUpRight size={22}/></Link></div>
    </section>
    <section aria-label="家教数据看板" className="v-overview"><div className="v-stats">
      <button className="v-stat" onClick={() => quick("today")}><span><CalendarDays size={17}/>今日新增</span><strong>{data ? today.length : "—"}<small>单</small></strong><p>今天发布的新机会 <ArrowUpRight size={14}/></p></button>
      <button className="v-stat" onClick={() => quick("all")}><span><BookOpen size={17}/>当前可咨询</span><strong>{data ? consultable.length : "—"}<small>单</small></strong><p>已成交订单会标记并停止咨询 <ArrowUpRight size={14}/></p></button>
      <button className="v-stat" disabled={!high} onClick={() => quick("highest")}><span><Wallet size={17}/>今日最高时薪</span><strong>{data && high ? `¥${high}` : "—"}<small>{high ? "/小时" : ""}</small></strong><p>{!data ? "正在获取订单" : high ? "查看今日高薪机会" : "今日暂无新单报价"}{!!high && <ArrowUpRight size={14}/>}</p></button>
    </div><div className="v-ticker"><span className="v-ticker-title"><span className="v-live-dot"/>订单更新</span><div>{!data ? (error ? "订单暂未加载，请重试连接。" : "正在读取最新发布记录…") : data.batches.some(b => b.items.length) ? data.batches.filter(b => b.items.length).slice(0, 3).map(batch => <p key={batch.id}><time>{dateLabel(batch.createdAt)}</time>{Object.entries(batch.items.reduce((acc, item) => ({ ...acc, [item.pool]: (acc[item.pool] ?? 0) + 1 }), {} as Record<string, number>)).map(([pool, count]) => `${poolLabel(pool)}更新${count}单`).join(" · ")}<span> · {Object.entries(batch.items.reduce((acc, item) => ({ ...acc, [item.district || "其他"]: (acc[item.district || "其他"] ?? 0) + 1 }), {} as Record<string, number>)).map(([district, count]) => `${district}${count}`).join(" · ")}</span></p>) : <p>还没有发布批次，发布新订单后将在这里显示。</p>}</div></div><p className="v-consult-note">“当前可咨询”表示订单正在公开展示，是否仍有名额请通过微信向助理确认。</p></section>
    <section className="v-section v-shortcuts"><div className="v-section-heading"><h2>快速找一找</h2><span>从你关心的条件开始</span></div><div className="v-quick">
      <button onClick={() => quick("today")}><CalendarDays/><b>今日新单</b><small>看看今天的新机会</small></button><button onClick={() => quick("filter")}><SlidersHorizontal/><b>按条件找家教</b><small>地区、科目、时间</small></button><button onClick={() => quick("high")}><Wallet/><b>高薪家教</b><small>150元/小时起</small></button><Link href="/parent"><Users/><b>家长找老师</b><small>了解平台师资</small></Link><Link href="/teacher/register"><GraduationCap/><b>老师登记</b><small>让家长看到你</small></Link><Link href="/teacher/register?view=me"><UserRound/><b>我的资料</b><small>查看与完善简历</small></Link>
    </div></section>
    <section className="v-section v-feed" id="feed"><div className="v-section-heading"><div><span className="v-eyebrow">今日机会 · 持续更新</span><h2>刷一刷，今天又有什么新单子</h2><p className="v-note">卡片就是完整详情，找到合适的订单后复制给微信助理。</p></div><button className="v-icon-text" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={15} className={refreshing ? "v-spin" : ""}/>{refreshing ? "刷新中" : "刷新订单"}</button></div>
      <div className="v-filter-box"><div className="v-search-row"><Search size={19}/><input aria-label="搜索订单" placeholder="搜订单编号、地点、年级、科目…" value={filters.query} onChange={e => set("query", e.target.value)}/>{filters.query && <button aria-label="清空搜索" onClick={() => set("query", "")}><X size={16}/></button>}<button className={expanded ? "selected v-filter-toggle" : "v-filter-toggle"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16}/>组合筛选{tags.length ? ` (${tags.length})` : ""}</button></div>
        <div className="v-pool-row"><span>订单池</span><button className={!filters.pools.length ? "selected" : ""} onClick={() => set("pools", [])}>全部</button>{pools.map(pool => <button key={pool} aria-pressed={filters.pools.includes(pool)} className={filters.pools.includes(pool) ? "selected" : ""} onClick={() => set("pools", filters.pools.includes(pool) ? filters.pools.filter(p => p !== pool) : [...filters.pools, pool])}>{poolLabel(pool)}</button>)}</div>
        <Multi label="区域 · 可多选" options={choices("district")} value={filters.districts} onChange={v => set("districts", v)}/>
        {expanded && <div className="v-expanded-filters"><Multi label="科目 · 可多选" options={choices("subject")} value={filters.subjects} onChange={v => set("subjects", v)}/><Multi label="年级 · 可多选" options={grades} value={filters.grades} onChange={v => set("grades", v)}/><div className="v-form-grid"><label className="v-field">老师类型<select value={filters.type} onChange={e => set("type", e.target.value)}><option value="">不限</option>{teacherTypeOptions(data?.dictionaries).map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><Field label="最低时薪（元/h）" type="number" value={filters.min} onChange={v => set("min", v)}/><Field label="最高时薪（元/h）" type="number" value={filters.max} onChange={v => set("max", v)}/><Field label="发布时间" options={["", "今天", "昨天", "近3天", "近7天"]} value={filters.date} onChange={v => set("date", v)}/></div><Multi label="时间 · 可多选" options={["工作日", "周末", "周一", "周二", "周三", "周四", "周五", "周六", "周日", "上午", "下午", "晚上"]} value={filters.times} onChange={v => set("times", v)}/><p className="v-note">不同条件同时满足，同一条件多选满足任意一个即可。待遇按所选老师类型筛选。</p></div>}
        {(tags.length > 0 || filters.query) && <div className="v-active-filters"><span>已选</span>{tags.map((tag, i) => <button key={i} onClick={tag.remove}>{tag.label}<X size={12}/></button>)}<button className="v-clear" onClick={() => setFilters({ ...emptyFilters })}>清除全部筛选</button></div>}
      </div>
      {filters.min && filters.max && Number(filters.min) > Number(filters.max) && <Alert>最低时薪不能高于最高时薪，请调整筛选范围。</Alert>}
      {error && <div className="v-load-error" role="alert"><b>暂时无法读取订单</b><p>{error} 已有记录不会因此被删除。</p><button onClick={() => void refresh()}>重新加载</button></div>}
      <div className="v-results-heading"><p>{data ? <>找到 <b>{results.length}</b> 条家教机会</> : "正在加载家教机会…"}</p><span>最新发布优先 · 每页10条</span></div>
      {!data && !error ? <div className="v-grid" aria-label="正在加载订单">{[0, 1, 2, 3].map(i => <div className="v-skeleton" key={i}/>)}</div> : <div className="v-grid v-order-grid">{results.slice((currentPage - 1) * 10, currentPage * 10).map(order => <OrderCard key={order.id} order={order} copied={copied === order.id} onCopy={() => void copy(order)}/>)}</div>}
      {data && !results.length && <div className="v-empty"><Search size={28}/><h3>暂时没有符合条件的订单</h3><p>可以减少一些条件，或稍后再来看看新机会。</p><button onClick={() => setFilters({ ...emptyFilters })}>查看全部订单</button></div>}
      {!!data && results.length > 0 && <div className="v-pagination"><button disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); scrollFeed(); }}>上一页</button><span>第 <b>{currentPage}</b> / {pages} 页</span><button disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); scrollFeed(); }}>下一页</button></div>}
    </section>
    <section className="v-cta v-registration-cta"><div className="v-cta-icon"><GraduationCap size={38}/></div><div><span className="v-eyebrow">让每一份教学经验被看见</span><h2>让家长主动看到你</h2><p>展示学校、专业和教学经验。资料审核通过后，<br className="v-desktop-only"/>家长可以按孩子的年级和科目找到你。</p></div><Link className="v-primary" href="/teacher/register">登记老师资料 <ArrowRight size={17}/></Link></section>
    <section className="v-parent-invite"><div><h2>为孩子，找一位合适的老师</h2><p>从教学经验、擅长方向和教学风格，认真了解一位老师。</p></div><Link href="/parent">前往家长师资库 <ArrowUpRight size={18}/></Link></section>
  </main><Footer/>{message && <div className="v-toast" role="status"><Check size={17}/>{message}<button aria-label="关闭复制提示" onClick={() => setMessage("")}><X size={15}/></button></div>}{manual && <Drawer title="复制完整信息" close={() => setManual("")}><p>浏览器暂不支持自动复制，请选择以下全文复制。</p><textarea className="v-copy-text" value={manual} readOnly onFocus={e => e.target.select()}/></Drawer>}</div>;
}

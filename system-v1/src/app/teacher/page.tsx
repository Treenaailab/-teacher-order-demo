"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, Bell, Bookmark, BriefcaseBusiness, Check, ChevronDown,
  Clock3, Copy, Filter, GraduationCap, MapPin, Search, SlidersHorizontal,
  Sparkles, UsersRound, X } from "lucide-react";
import { copyOrderText, orderMatchesQuery, poolLabel, sampleOrders, type PublicPool, type TutorOrder } from "@/lib/orders";
import { createClient } from "@/lib/supabase/browser";
import { readDemoOrders } from "@/lib/demo-data";
import "../home.css";

const pools: (PublicPool | "all")[] = ["all", "A", "B", "C", "owned"];
const areas = ["全部区域", "天河区", "越秀区", "荔湾区", "海珠区", "番禺区", "花都区", "黄埔区", "增城区", "白云区"];
type MarketStats = { available: number; today_new: number; today_highest_hourly: number | null; pools: Record<string, number>; areas: { name: string; count: number }[]; all_areas: { name: string; count: number }[]; subjects: { name: string; count: number }[] };
type RecentBatch = { created_at: string; published_count: number; pool: PublicPool };

function rateLabel(order: TutorOrder) {
  const options = [order.collegeRate && `大学生 ${order.collegeRate}`, order.professionalRate && `专职 ${order.professionalRate}`, order.perClassRate];
  return options.filter(Boolean).join(" · ") || "待遇面议";
}

function rateNumber(order: TutorOrder) {
  if (order.hourlyMin !== undefined && order.hourlyMax !== undefined) return order.hourlyMin === order.hourlyMax ? `${order.hourlyMin}` : `${order.hourlyMin}–${order.hourlyMax}`;
  return "—";
}

function ageLabel(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function mapPublicOrder(row: Record<string, any>): TutorOrder {
  const low = row.calculated_hourly_min == null ? undefined : Number(row.calculated_hourly_min);
  const high = row.calculated_hourly_max == null ? low : Number(row.calculated_hourly_max);
  const range = (minimum?: number, maximum?: number) => minimum == null ? undefined : `${minimum === maximum ? minimum : `${minimum}–${maximum}`}元/小时`;
  return {
    id: row.id,
    orderCode: row.order_code,
    city: row.city,
    district: row.district,
    address: row.address_public,
    grade: row.student_grade,
    gender: row.student_gender,
    subjects: row.subjects ?? [],
    situation: row.situation,
    schedule: row.schedule_text,
    weekdays: row.weekdays ?? [],
    requirement: row.requirement_text,
    teacherType: row.teacher_type,
    collegeRate: range(row.college_hourly_min == null ? undefined : Number(row.college_hourly_min), row.college_hourly_max == null ? undefined : Number(row.college_hourly_max)),
    professionalRate: range(row.professional_hourly_min == null ? undefined : Number(row.professional_hourly_min), row.professional_hourly_max == null ? undefined : Number(row.professional_hourly_max)),
    perClassRate: row.per_class_fee == null ? undefined : `${row.per_class_fee}${row.per_class_fee_max != null && Number(row.per_class_fee_max) !== Number(row.per_class_fee) ? `–${row.per_class_fee_max}` : ""}元${row.class_duration_hours ? `/${row.class_duration_hours}小时` : "/次"}`,
    hourlyMin: low,
    hourlyMax: high,
    pool: row.pool,
    publishedAt: row.published_at,
  };
}

export default function Home() {
  const supabase = createClient();
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [ordersData, setOrdersData] = useState<TutorOrder[]>([...sampleOrders].sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()));
  const [dataMode, setDataMode] = useState<"preview" | "loading" | "live" | "error">(isConfigured ? "loading" : "preview");
  const [loadError, setLoadError] = useState("");
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
  const loadedOnce = useRef(false);
  const [totalCount, setTotalCount] = useState(sampleOrders.length);
  const [pool, setPool] = useState<(typeof pools)[number]>("all");
  const [areasSelected, setAreasSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [subjectsSelected, setSubjectsSelected] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState("不限年级");
  const [teacher, setTeacher] = useState("不限老师类型");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [timeFilter, setTimeFilter] = useState("不限时间");
  const [dateFilter, setDateFilter] = useState("全部可咨询");
  const [copied, setCopied] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sortMode,setSortMode]=useState<"newest"|"rate">("newest");
  const pageSize = 10;

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => { void loadOrders(); }, query ? 220 : 0);
    async function loadOrders() {
      if (!supabase) {
        const demo = readDemoOrders().filter((order) => order.state === "published" && order.validity !== "unavailable").sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime());
        setOrdersData(demo);
        setTotalCount(demo.length);
        setDataMode("preview");
        loadedOnce.current = true;
        return;
      }
      if (!loadedOnce.current) setDataMode("loading");
      const dateStamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const todayStart = new Date(`${dateStamp}T00:00:00+08:00`);
      let since: string | null = null; let until: string | null = null;
      if (dateFilter === "今天") since = todayStart.toISOString();
      else if (dateFilter === "昨天") { until = todayStart.toISOString(); since = new Date(todayStart.getTime() - 86400000).toISOString(); }
      else if (dateFilter === "近3天") since = new Date(todayStart.getTime() - 2 * 86400000).toISOString();
      else if (dateFilter === "近7天") since = new Date(todayStart.getTime() - 6 * 86400000).toISOString();
      let weekdays: number[] | null = null; let period: string | null = null;
      if (timeFilter === "工作日") weekdays = [1, 2, 3, 4, 5];
      else if (timeFilter === "周末") weekdays = [6, 7];
      else if (["上午", "下午", "晚上"].includes(timeFilter)) period = timeFilter;
      else if (timeFilter !== "不限时间") weekdays = [timeFilter === "周日" ? 7 : Number(timeFilter.replace("周", ""))];
      const [{ data, error }, statsResult, batchResult] = await Promise.all([supabase.rpc("public_order_feed", {
        p_offset: (page - 1) * pageSize,
        p_limit: pageSize,
        p_query: query.trim(),
        p_pool: pool === "all" ? null : pool,
        p_districts: areasSelected.length ? areasSelected : null,
        p_subjects: subjectsSelected.length ? subjectsSelected : null,
        p_teacher_type: teacher === "大学生" ? "college" : teacher === "专职老师" ? "professional" : null,
        p_min_hourly: minimum ? Number(minimum) : null,
        p_max_hourly: maximum ? Number(maximum) : null,
        p_weekdays: weekdays,
        p_time_period: period,
        p_since: since,
        p_until: until,
      }), supabase.rpc("public_market_stats"), supabase.rpc("public_recent_uploads")]);
      if (!alive) return;
      if (error) { loadedOnce.current = true; setLoadError(error.message); setOrdersData([]); setTotalCount(0); setDataMode("error"); return; }
      const feed = data as { total?: number; orders?: Record<string, unknown>[] };
      setOrdersData((feed.orders ?? []).map((row) => mapPublicOrder(row as Record<string, any>)));
      setTotalCount(Number(feed.total ?? 0));
      if (!statsResult.error && statsResult.data) setMarketStats(statsResult.data as MarketStats);
      if (!batchResult.error && batchResult.data) setRecentBatches(batchResult.data as RecentBatch[]);
      loadedOnce.current = true;
      setDataMode("live");
    }
    const interval = window.setInterval(() => { void loadOrders(); }, 60000);
    return () => { alive = false; window.clearTimeout(timer); window.clearInterval(interval); };
  }, [supabase, page, query, pool, areasSelected, subjectsSelected, teacher, minimum, maximum, timeFilter, dateFilter]);

  const previewFiltered = useMemo(() => ordersData.filter((order) => {
    const poolOk = pool === "all" || order.pool === pool;
    const areaOk = areasSelected.length === 0 || areasSelected.includes(order.district);
    const subjectOk = subjectsSelected.length === 0 || subjectsSelected.some((selected) => order.subjects.some((item) => item.includes(selected)) || order.subjects.includes("全科"));
    const gradeOk = gradeFilter === "不限年级" || order.grade.includes(gradeFilter);
    const teacherOk = teacher === "不限老师类型" || (teacher === "大学生" ? order.teacherType !== "professional" : order.teacherType !== "college");
    const rateOk = (!minimum || (order.hourlyMax ?? 0) >= Number(minimum)) && (!maximum || (order.hourlyMin ?? Infinity) <= Number(maximum));
    const dayOk = timeFilter === "不限时间" || (timeFilter === "工作日" ? order.weekdays.some((d) => d >= 1 && d <= 5) : timeFilter === "周末" ? order.weekdays.some((d) => d === 6 || d === 7) : ["上午", "下午", "晚上"].includes(timeFilter) ? order.schedule.includes(timeFilter) : order.weekdays.includes(timeFilter === "周日" ? 7 : Number(timeFilter.replace("周", ""))));
    const dateOk = dateFilter === "全部可咨询" || (dateFilter === "今天" ? new Date(order.publishedAt).toDateString() === new Date().toDateString() : dateFilter === "昨天" ? new Date(order.publishedAt).toDateString() === new Date(Date.now() - 86400000).toDateString() : Date.now() - new Date(order.publishedAt).getTime() <= (dateFilter === "近3天" ? 3 : 7) * 86400000);
    return poolOk && areaOk && subjectOk && gradeOk && teacherOk && rateOk && dayOk && dateOk && orderMatchesQuery(order, query);
  }), [ordersData, pool, areasSelected, subjectsSelected, gradeFilter, teacher, minimum, maximum, timeFilter, dateFilter, query]);
  const displayedCount = dataMode === "preview" ? previewFiltered.length : totalCount;
  const pages = Math.max(1, Math.ceil(displayedCount / pageSize));
  const orderSource=dataMode === "preview"?previewFiltered:ordersData;
  const sortedOrders=[...orderSource].sort((a,b)=>sortMode==="newest"?new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime():(b.hourlyMax??0)-(a.hourlyMax??0));
  const visibleOrders = dataMode === "preview" ? sortedOrders.slice((page - 1) * pageSize, page * pageSize) : sortedOrders;

  async function handleCopy(order: TutorOrder) {
    const value=copyOrderText(order);
    try { await navigator.clipboard.writeText(value); }
    catch { const input=document.createElement("textarea");input.value=value;input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();document.execCommand("copy");input.remove(); }
    setCopied(order.id);window.setTimeout(() => setCopied(null), 1800);
  }

  function selectPool(value: (typeof pools)[number]) { setPool(value); setPage(1); }
  function toggleArea(value: string) { setAreasSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); setPage(1); }
  function toggleSubject(value: string) { setSubjectsSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); setPage(1); }

  const countBy = (values:string[]) => Object.entries(values.reduce<Record<string,number>>((out,value)=>{out[value]=(out[value]||0)+1;return out},{})).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
  const gradeRows=countBy(ordersData.map(order=>order.grade.match(/幼儿园|一年级|二年级|三年级|四年级|五年级|六年级|初一|初二|初三|高一|高二|高三/)?.[0]||"其他年级")).slice(0,4);
  const teacherRows=[{name:"大学生",count:ordersData.filter(o=>o.teacherType!=="professional").length},{name:"专职老师",count:ordersData.filter(o=>o.teacherType!=="college").length}];
  const payRows=[{name:"80元以下",count:ordersData.filter(o=>(o.hourlyMax||0)<80).length},{name:"80–120元",count:ordersData.filter(o=>(o.hourlyMax||0)>=80&&(o.hourlyMax||0)<120).length},{name:"120元以上",count:ordersData.filter(o=>(o.hourlyMax||0)>=120).length}];
  const timeRows=[{name:"工作日",count:ordersData.filter(o=>o.weekdays.some(d=>d>=1&&d<=5)).length},{name:"周末",count:ordersData.filter(o=>o.weekdays.some(d=>d>=6)).length},{name:"晚上",count:ordersData.filter(o=>/晚上|傍晚/.test(o.schedule)).length}];
  const poolRows=(['A','B','C','owned'] as const).map(key=>({key,name:key==='owned'?'高性价比急出单':`${key}池`,count:ordersData.filter(o=>o.pool===key).length}));
  const topPayOrders=[...ordersData].sort((a,b)=>(b.hourlyMax||0)-(a.hourlyMax||0)).slice(0,3);

  return <main className="site-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="家教星球首页"><span className="brand-mark"><GraduationCap size={22}/></span><span>家教星球</span></a>
      <nav className="desktop-nav" aria-label="主导航"><a className="nav-active" href="#orders">找家教</a><a href="#market">市场行情</a><a href="#about">关于平台</a></nav>
      <div className="top-actions"><button className="icon-button notification" aria-label="消息"><Bell size={18}/><i/></button><a className="login-link" href="/">身份入口</a><a className="signup-button" href="/teacher/register">注册老师账号 <ArrowRight size={15}/></a></div>
    </header>

    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> 每天更新真实家教机会</div><h1>找到适合你的<br/><span>下一份家教。</span></h1><p>按区域、科目和课酬快速筛选。看到合适的订单，复制信息发给微信代理继续咨询。</p><div className="hero-actions"><a className="primary-button" href="#orders">浏览最新订单 <ArrowDownUp size={16}/></a><span className="safe-note"><span className="safe-dot"/> 公开信息已做隐私处理</span></div></div>
      <div className="hero-card"><div className="hero-card-top"><div><span className="tiny-label">今日订单速览</span><span className="live-label"><i/>{dataMode === "live" ? "自动更新" : dataMode === "loading" ? "连接中" : "预览数据"}</span></div><span className="date-pill">订单公开浏览</span></div><div className="hero-stats"><div><strong>{marketStats?.available ?? ordersData.length}</strong><span>可咨询订单</span></div><div><strong>{marketStats?.today_new ?? ordersData.filter((o) => new Date(o.publishedAt).toDateString() === new Date().toDateString()).length}</strong><span>今日新增</span></div><div><strong>¥{marketStats?.today_highest_hourly ?? Math.max(0, ...ordersData.map((o) => o.hourlyMax || 0))}</strong><span>今日最高时薪</span></div></div><div className="hero-update"><span className="update-icon"><Sparkles size={15}/></span><div className="activity-list">{recentBatches.length ? recentBatches.slice(0, 3).map((batch, index) => <span key={`${batch.created_at}-${index}`}><b>{ageLabel(batch.created_at)} · {poolLabel[batch.pool]}新增{batch.published_count}单</b></span>) : <><b>订单持续更新</b><span>录单发布后会显示新增批次</span></>}</div><ArrowRight size={16}/></div></div>
      <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
    </section>

    <section className="teacher-dashboard"><div className="dash-title"><div><span className="section-kicker">TUTOR MARKET PULSE</span><h2>家教数据看板</h2><p>点击区域、科目和订单池，可直接带入订单筛选。</p></div><span>本地演示 · {ordersData.length} 条</span></div><div className="dash-kpis"><button onClick={()=>{setDateFilter("今天");setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><small>今日新增</small><b>{ordersData.filter(o=>new Date(o.publishedAt).toDateString()===new Date().toDateString()).length||4}</b><i>查看今日订单 →</i></button><button onClick={()=>{setPool("all");document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><small>当前可咨询</small><b>{marketStats?.available??ordersData.length}</b><i>浏览全部 →</i></button><button onClick={()=>{setMinimum("120");setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><small>今日最高时薪</small><b>¥{marketStats?.today_highest_hourly??Math.max(0,...ordersData.map(o=>o.hourlyMax||0))}</b><i>查看高薪单 →</i></button></div><div className="dash-panels"><article className="dash-panel"><h3>区域热度</h3>{(marketStats?.areas.slice(0,4)??countBy(ordersData.map(o=>o.district)).slice(0,4)).map(x=><button key={x.name} onClick={()=>{setAreasSelected([x.name]);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel"><h3>热门科目</h3>{(marketStats?.subjects.slice(0,4)??countBy(ordersData.flatMap(o=>o.subjects)).slice(0,4)).map(x=><button key={x.name} onClick={()=>{setSubjectsSelected([x.name]);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel"><h3>年级分布</h3>{gradeRows.map(x=><button key={x.name} onClick={()=>{setGradeFilter(x.name);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel"><h3>老师类型需求</h3>{teacherRows.map(x=><button key={x.name} onClick={()=>{setTeacher(x.name);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel"><h3>薪资区间</h3>{payRows.map(x=><button key={x.name} onClick={()=>{setMinimum(x.name.includes("120")?"120":x.name.includes("80")?"80":"");setMaximum(x.name.includes("以下")?"79":x.name.includes("120")?"":"119");setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel"><h3>上课时间热度</h3>{timeRows.map(x=><button key={x.name} onClick={()=>{setTimeFilter(x.name);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><i style={{width:`${Math.max(8,100*x.count/Math.max(1,ordersData.length))}%`}}/><b>{x.count}</b></button>)}</article><article className="dash-panel dash-pools"><h3>订单池更新情况</h3>{poolRows.map(x=><button key={x.key} onClick={()=>{setPool(x.key);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span>{x.name}</span><b>{x.count} 单</b></button>)}</article><article className="dash-panel dash-recent"><h3>最近更新动态</h3>{ordersData.slice(0,3).map(o=><button key={o.id} onClick={()=>document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}><span>{poolLabel[o.pool]} · {o.subjects.join("/ ")} · {o.district}</span><b>{ageLabel(o.publishedAt)}</b></button>)}</article></div><article className="dash-highpay"><div><span className="section-kicker">HIGH RATE</span><h3>今日高薪单</h3></div>{topPayOrders.map(o=><button key={o.id} onClick={()=>{setQuery(o.orderCode);setPage(1);document.querySelector("#orders")?.scrollIntoView({behavior:"smooth"})}}><span><b>¥{o.hourlyMin??0}–{o.hourlyMax??o.hourlyMin}</b><small>{o.district} · {o.subjects.join("/")}</small></span><ArrowRight size={15}/></button>)}</article></section>

    <section className="content-wrap" id="orders">
      <div className="section-heading"><div><span className="section-kicker">ORDER FEED</span><h2>刷一刷，今天又有什么新单子</h2><p>每条订单都可以直接复制，发给微信代理确认。</p></div><button className="filter-mobile" onClick={() => setShowFilters(true)}><SlidersHorizontal size={17}/> 筛选</button></div>
      <div className="search-row"><label className="search-box"><Search size={19}/><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="搜索订单编号、地址、学校、科目、年级…"/><kbd>⌘ K</kbd></label><button className="desktop-filter-button" onClick={() => setShowFilters(true)}><Filter size={16}/> 高级筛选 <ChevronDown size={14}/></button></div>

      <div className="filter-label">按订单来源浏览 <span>·</span> <small>可以多选查看，当前单选</small></div>
      <div className="pool-tabs" role="tablist" aria-label="订单池筛选">
        {pools.map((item) => { const label = item === "all" ? "全部订单" : item === "owned" ? "高性价比急出单" : `${item} 池`; const count = item === "all" ? (marketStats?.available ?? ordersData.length) : (marketStats?.pools[item] ?? ordersData.filter((o) => o.pool === item).length); return <button key={item} onClick={() => selectPool(item)} className={`pool-tab ${pool === item ? "selected" : ""} ${item === "owned" ? "owned-tab" : ""}`}>{label}<span>{count}</span></button>; })}
      </div>
      <div className="area-row"><span className="area-caption"><MapPin size={15}/> 区域</span><div className="area-scroll"><button className={`area-chip ${areasSelected.length === 0 ? "area-selected" : ""}`} onClick={() => { setAreasSelected([]); setPage(1); }}>全部</button>{areas.filter((item) => item !== "全部区域").map((item) => <button key={item} className={`area-chip ${areasSelected.includes(item) ? "area-selected" : ""}`} onClick={() => toggleArea(item)}>{item.replace("区", "")}<span>{marketStats?.all_areas.find((entry) => entry.name === item)?.count ?? ordersData.filter((o) => o.district === item).length}</span></button>)}</div></div>

      <div className="feed-meta"><span>为你找到 <b>{displayedCount}</b> 条订单</span><button className="sort-button" onClick={()=>{setSortMode(current=>current==="newest"?"rate":"newest");setPage(1)}}><Clock3 size={15}/> {sortMode==="newest"?"最新发布":"时薪优先"} <ChevronDown size={14}/></button></div>
      <div className="order-grid">
        {visibleOrders.map((order) => <article className="order-card" key={order.id}>
          <div className="card-topline"><div className="card-tags"><span className={`pool-badge badge-${order.pool.toLowerCase()}`}>{poolLabel[order.pool]}</span><span className="new-badge">NEW</span></div><span className="published-time">{ageLabel(order.publishedAt)}</span></div>
          <div className="order-title-row"><h3>{order.subjects.join(" / ")} <span>·</span> {order.grade}</h3><div className="rate-highlight"><strong>¥{rateNumber(order)}</strong><small>/ 小时</small></div></div>
          <div className="order-location"><MapPin size={15}/><span>{order.city} · {order.address}</span></div>
          <p className="order-situation">{order.situation}</p>
          <div className="order-facts"><div><span>上课时间</span><b>{order.schedule}</b></div><div><span>老师要求</span><b>{order.requirement}</b></div><div><span>老师类型</span><b>{order.teacherType === "college" ? "大学生" : order.teacherType === "professional" ? "专职老师" : "大学生 / 专职均可"}</b></div></div>
          <div className="card-footer"><div className="rate-detail"><BriefcaseBusiness size={15}/><span>{rateLabel(order)}</span></div><button className={`copy-button ${copied === order.id ? "copy-success" : ""}`} onClick={() => handleCopy(order)}>{copied === order.id ? <Check size={15}/> : <Copy size={15}/>} {copied === order.id ? "已复制" : "复制完整信息"}</button></div>
        </article>)}
      </div>
      {displayedCount === 0 && <div className="empty-state"><Search size={25}/><b>没有找到符合条件的订单</b><span>试试调整关键词或筛选条件。</span><button onClick={() => { setQuery(""); setAreasSelected([]); setSubjectsSelected([]); setGradeFilter("不限年级"); setTeacher("不限老师类型"); setMinimum(""); setMaximum(""); setTimeFilter("不限时间"); setDateFilter("全部可咨询"); setPool("all"); setPage(1); }}>清除筛选</button></div>}
      {displayedCount > 0 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页 <ArrowRight size={14}/></button><small>每页 10 条</small></div>}
      {dataMode === "preview" && <div className="sample-notice"><Sparkles size={15}/> 当前展示虚构演示订单；筛选与复制可直接体验。</div>}{dataMode === "error" && <div className="sample-notice"><Sparkles size={15}/> 正式订单暂时无法加载：{loadError}</div>}
    </section>

    <section className="market-section" id="market"><div className="market-heading"><div><span className="section-kicker">TODAY’S SNAPSHOT</span><h2>今天的家教市场</h2><p>快速了解当前订单的区域和科目分布。</p></div><span className="market-date"><Clock3 size={14}/> 今日更新</span></div><div className="market-grid"><div className="market-card"><div className="market-card-title"><MapPin size={16}/><b>热门区域</b><span>订单数</span></div>{(marketStats?.areas.slice(0, 4) ?? ["越秀区", "花都区", "天河区"].map((name) => ({ name, count: ordersData.filter((o) => o.district === name).length }))).map((item, i) => <div className="market-line" key={item.name}><span><i>{String(i + 1).padStart(2, "0")}</i>{item.name}</span><b>{item.count}</b></div>)}</div><div className="market-card"><div className="market-card-title"><Bookmark size={16}/><b>热门科目</b><span>订单数</span></div>{(marketStats?.subjects.slice(0, 4) ?? ["数学", "英语", "全科"].map((name) => ({ name, count: ordersData.filter((o) => o.subjects.includes(name)).length }))).map((item, i) => <div className="market-line" key={item.name}><span><i>{String(i + 1).padStart(2, "0")}</i>{item.name}</span><b>{item.count}</b></div>)}</div><div className="market-card market-join"><div className="join-icon"><UsersRound size={21}/></div><h3>让合适的订单<br/>更快找到你</h3><p>注册后完善学校和常驻区域，方便后续获取更适合你的订单。</p><a href="/teacher/register">注册老师账号 <ArrowRight size={15}/></a></div></div></section>
    <footer className="footer" id="about"><a className="brand footer-brand" href="/"><span className="brand-mark"><GraduationCap size={19}/></span><span>家教星球</span></a><span>让每一份认真教学，都遇见合适的机会。</span><span>老师注册资料仅供内部管理</span></footer>
    <nav className="mobile-nav"><a className="mobile-active" href="#orders"><GraduationCap size={19}/><span>找家教</span></a><a href="#market"><Bookmark size={19}/><span>市场</span></a><a href="/teacher/register"><UsersRound size={19}/><span>老师登记</span></a></nav>

    {showFilters && <div className="modal-backdrop" onClick={() => setShowFilters(false)}><section className="filter-sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-head"><div><span className="section-kicker">FILTER ORDERS</span><h3>筛选家教订单</h3></div><button className="icon-button" onClick={() => setShowFilters(false)} aria-label="关闭"><X size={20}/></button></div><label className="form-label">发布时间</label><select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>{["今天", "昨天", "近3天", "近7天", "全部可咨询"].map((x) => <option key={x}>{x}</option>)}</select><label className="form-label">区域（可多选）</label><div className="filter-choice-list"><button className={`filter-choice ${areasSelected.length === 0 ? "choice-active" : ""}`} onClick={() => setAreasSelected([])}>全部区域</button>{areas.filter((x) => x !== "全部区域").map((x) => <button key={x} className={`filter-choice ${areasSelected.includes(x) ? "choice-active" : ""}`} onClick={() => toggleArea(x)}>{x}</button>)}</div><label className="form-label">科目（可多选）</label><div className="filter-choice-list">{["语文", "数学", "英语", "物理", "化学", "生物", "全科"].map((x) => <button key={x} className={`filter-choice ${subjectsSelected.includes(x) ? "choice-active" : ""}`} onClick={() => toggleSubject(x)}>{x}</button>)}</div><label className="form-label">年级</label><select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>{["不限年级", "幼儿园", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"].map((x) => <option key={x}>{x}</option>)}</select><label className="form-label">老师类型</label><select value={teacher} onChange={(e) => setTeacher(e.target.value)}>{["不限老师类型", "大学生", "专职老师"].map((x) => <option key={x}>{x}</option>)}</select><label className="form-label">上课时间</label><select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>{["不限时间", "工作日", "周末", "周一", "周二", "周三", "周四", "周五", "周六", "周日", "上午", "下午", "晚上"].map((x) => <option key={x}>{x}</option>)}</select><div className="rate-range"><div><label className="form-label">最低时薪（元）</label><input className="sheet-input" inputMode="numeric" placeholder="不限" value={minimum} onChange={(e) => setMinimum(e.target.value.replace(/\D/g, ""))}/></div><div><label className="form-label">最高时薪（元）</label><input className="sheet-input" inputMode="numeric" placeholder="不限" value={maximum} onChange={(e) => setMaximum(e.target.value.replace(/\D/g, ""))}/></div></div><div className="sheet-actions"><button className="clear-button" onClick={() => { setAreasSelected([]); setSubjectsSelected([]); setGradeFilter("不限年级"); setTeacher("不限老师类型"); setMinimum(""); setMaximum(""); setTimeFilter("不限时间"); setDateFilter("全部可咨询"); setPage(1); }}>清除筛选</button><button className="primary-button" onClick={() => { setPage(1); setShowFilters(false); }}>查看 {displayedCount} 条订单 <ArrowRight size={15}/></button></div></section></div>}
  </main>;
}

import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardCheck, HeartHandshake, MapPin, ShieldCheck } from "lucide-react";
import "../portal.css";
import "./parent.css";

export default function ParentHome(){return <main className="portal-shell"><header className="portal-header"><Link className="portal-brand" href="/"><span><HeartHandshake size={20}/></span>家教星球</Link><Link className="portal-back" href="/"><ArrowLeft size={15}/> 返回首页</Link></header><section className="parent-hero"><div className="portal-kicker">FAMILY · TUTOR REQUEST</div><h1>为孩子找到<br/><em>合适的老师。</em></h1><p>告诉我们孩子的学习情况、所在区域和时间安排，运营团队审核后联系你跟进。</p><Link className="parent-primary" href="/parent/request">填写找老师需求 <ArrowRight size={17}/></Link></section><section className="parent-steps"><article><span><ClipboardCheck size={19}/></span><b>填写需求</b><small>约 2 分钟完成信息</small></article><article><span><ShieldCheck size={19}/></span><b>运营审核</b><small>不会直接公开个人信息</small></article><article><span><MapPin size={19}/></span><b>协助匹配</b><small>按区域与老师条件筛选</small></article></section><div className="parent-note">提交内容仅保存在本地演示浏览器，不会发送到服务器。<Link href="/teacher">我是老师，去找家教单 →</Link></div></main>}

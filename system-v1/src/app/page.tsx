import Link from "next/link";
import { ArrowRight, GraduationCap, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import "./portal.css";

export default function Home() {
  return <main className="portal-shell"><header className="portal-header"><Link className="portal-brand" href="/"><span><GraduationCap size={21}/></span>家教星球</Link><span className="portal-chip"><Sparkles size={14}/> 本地产品验收版</span></header><section className="portal-hero"><div className="portal-kicker">TUTOR MATCHING · GUANGZHOU</div><h1>让每一份认真教学，<br/><em>都遇见合适的机会。</em></h1><p>老师找家教机会，家长发布辅导需求，运营团队统一审核和维护。</p></section><section className="portal-choices"><Link href="/teacher" className="portal-choice teacher-choice"><span className="choice-icon"><GraduationCap size={23}/></span><div><small>TEACHER</small><h2>我是老师，我想找学生</h2><p>浏览最新家教单，按区域、科目、课酬和时间筛选。</p></div><ArrowRight className="choice-arrow" size={19}/></Link><Link href="/parent" className="portal-choice parent-choice"><span className="choice-icon"><HeartHandshake size={22}/></span><div><small>FAMILY</small><h2>我是学生/家长，我想找老师</h2><p>提交辅导需求，待运营审核后为你匹配合适老师。</p></div><ArrowRight className="choice-arrow" size={19}/></Link></section><div className="portal-admin"><Link href="/auth"><ShieldCheck size={16}/> 管理员登录 <span>· 账号密码进入后台</span><ArrowRight size={14}/></Link></div><footer>当前版本使用虚构测试数据 · 表单和操作仅保存在当前浏览器</footer></main>;
}

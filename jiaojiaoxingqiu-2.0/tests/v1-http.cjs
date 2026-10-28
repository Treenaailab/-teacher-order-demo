const assert=require('node:assert/strict'),fs=require('node:fs');
process.loadEnvFile('.env.local');
const base=process.env.TUTOR_TEST_BASE_URL || 'http://localhost:3000';let checks=0;
const check=(name,fn)=>{assert(fn,name);checks++;console.log('PASS',name)};
(async()=>{
for(const path of ['/','/teacher','/teacher/register','/parent','/parent/request','/auth','/manage','/manage/new','/manage/orders','/manage/teachers','/manage/finance','/manage/review','/manage/stats','/manage/settings']){const r=await fetch(base+path);check(`页面 ${path} HTTP 200`,r.status===200);const html=await r.text();check(`页面 ${path} 无服务器错误页`,!html.includes('Internal Server Error'))}
check('匿名不能读取内部档案',(await fetch(base+'/api/v1?scope=admin')).status===401);
check('匿名不能编辑订单',(await fetch(base+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'order.update',id:'fake'})})).status===401);
check('跨站修改被拒绝',(await fetch(base+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:JSON.stringify({action:'parse'})})).status===403);
const response=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.TUTOR_ADMIN_USERNAME,password:process.env.TUTOR_ADMIN_PASSWORD})});check('现有普通管理员真实登录',response.status===200);const cookie=response.headers.get('set-cookie');check('Cookie为HttpOnly及SameSite',/HttpOnly/i.test(cookie)&&/SameSite=lax/i.test(cookie));const auth=await response.json();check('登录响应不返回密码和令牌',Object.keys(auth).every(k=>['role','displayName'].includes(k)));
const r=await fetch(base+'/api/v1?scope=admin',{headers:{Cookie:cookie.split(';')[0]}});check('有效服务端会话访问后台',r.status===200);const data=await r.json();check('角色来自服务端',data.role==='operator');const qa=data.orders.find(o=>o.orderCode==='DEMO-ORDER-001');if(qa)console.log('UI验收订单状态',JSON.stringify({state:qa.businessState,refundAmount:qa.refundAmount,refundDate:qa.refundDate,teacherName:qa.teacherName}));
const pub=await(await fetch(base+'/api/v1')).json();const serialized=JSON.stringify(pub);check('公开订单不返回真实渠道',!/(渠道A|渠道B|渠道C|sourceChannel|rawText|teacherName|teacherSource)/.test(serialized));check('公开教师不返回私有字段',pub.teachers.every(t=>!['name','wechat','phone','notes','source'].some(k=>k in t)));
const logout=await fetch(base+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie.split(';')[0]},body:JSON.stringify({action:'logout'})});check('登出撤销服务端会话',logout.ok&&(await fetch(base+'/api/v1?scope=admin',{headers:{Cookie:cookie.split(';')[0]}})).status===401);
fs.writeFileSync('work/v1-http-results.json',JSON.stringify({at:new Date().toISOString(),checks,pages:14},null,2));console.log(`COMPLETE ${checks} HTTP checks`);
})().catch(e=>{console.error(e.message);process.exitCode=1});

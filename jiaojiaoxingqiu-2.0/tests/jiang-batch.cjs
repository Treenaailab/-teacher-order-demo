const fs = require("node:fs"), path = require("node:path"), ts = require("typescript"), assert = require("node:assert/strict");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { parseOrders } = require("../src/lib/parser.ts");
const text = `🟥🟥🟥
GZ26999001
海珠区示例小区
高二女数学基础辅导一周1-2次，一次2小时，周内晚上7点~9点或周六日均可女120元一个小时

GZ26999002//这个为准加急
黄埔区示例地铁站
高一男数学物理巩固基础提优一周1次，一次2个小时，周六男100元一个小时

GZ26999003//改
从化区示例花园附近
六年级，男全科阶段测评成绩处于中等水平一周3次，一次2小时，周内晚6:30开始男80元一个小时

GZ26999004
白云区示例区域
初三女 数学查缺补漏一周一次，周末辅导女80一个小时

GZ26999005//
番禺区示例小区附近
初三 男数语化基础辅导/查漏补缺一周2次，一次2个小时，周六全天周日上午，国庆连续辅导男100元一个小时

GZ26999006
黄埔区示例园区
高三男国际学校
物理巩固基础提优，物理的内容是全英的，但是可以用手机翻译过来，可以中文上课一周1次，一次2个小时，国庆后周五晚上，晚上男女，物理专业的研究生物理160元一个小时

GZ26999007//
增城区示例社区
初三女物理一周一次，一次2小时，周末女老师，重点高校大学生120元一个小时

GZ26999008
天河区示例区域
二年级，男全科作业辅导一周5次，周内晚7：00-9:30女80元一个小时

GZ26999009
花都区示例路段
初二全科作业辅导一周一次，一次2个小时，周六上午女100元一个小时

GZ26999010//这个为准🥳
花都区示例社区
六年级全科一周5-6次，1-4晚上9点开始辅导一个小时20分钟，周末2小时小时重点高校，90元一个小时，

GZ26999011//
番禺区示例镇示例路
二年级，男全科作业，基础，答疑一周6次，一次2小时，周一到周六晚上5点半开始女70元一个小时

珠海26999012
珠海市金湾区示例图书馆
高一男化学巩固基础提优预习复习一周1次，一次2个小时，周六时间可协商，国庆安排两次课，长期男经120元一个小时

GZ26999013//
白云区示例路口附近
初二全科巩固基础提优一周1次，一次2个小时，周末100元一个小时

GZ26999014//
联系地址：越秀区示例区域
年级性别：高三女
辅导科目：数学物化生
学习情况：查缺补漏，作业辅导
时间安排：2周一次，一次2小时，周末
教员要求：女
老师报酬：大学生120元一个小时

GZ26999015//
联系地址：海珠区示例地铁站附近
年级性别：初二男
辅导科目：数学物理英语
学员情况：巩固基础提优，先学习数学后续加英语，孩子基础还可以，孩子重点班
时间安排：一周1次，一次2个小时，周末时间可协商，7号可以试课
教员要求：男女
老师报酬：研究生100元一个小时`;
const rows = parseOrders(text, "jiang");
const expected = [
    ["GZ26999001", "海珠区", "高二女", "数学", 120, 1, 2, "女"],
    ["GZ26999002", "黄埔区", "高一男", "数学 / 物理", 100, 1, 2, "男"],
    ["GZ26999003", "从化区", "六年级男", "全科", 80, 3, 2, "男"],
    ["GZ26999004", "白云区", "初三女", "数学", 80, 1, 0, "女"],
    ["GZ26999005", "番禺区", "初三男", "数学 / 语文 / 化学", 100, 2, 2, "男"],
    ["GZ26999006", "黄埔区", "高三男", "物理", 160, 1, 2, "不限"],
    ["GZ26999007", "增城区", "初三女", "物理", 120, 1, 2, "女"],
    ["GZ26999008", "天河区", "二年级男", "全科", 80, 5, 2.5, "女"],
    ["GZ26999009", "花都区", "初二", "全科", 100, 1, 2, "女"],
    ["GZ26999010", "花都区", "六年级", "全科", 90, 5, 0, ""],
    ["GZ26999011", "番禺区", "二年级男", "全科", 70, 6, 2, "女"],
    ["珠海26999012", "金湾区", "高一男", "化学", 120, 1, 2, "男"],
    ["GZ26999013", "白云区", "初二", "全科", 100, 1, 2, ""],
    ["GZ26999014", "越秀区", "高三女", "数学 / 物理 / 化学 / 生物", 120, 0.5, 2, "女"],
    ["GZ26999015", "海珠区", "初二男", "数学 / 物理 / 英语", 100, 1, 2, "不限"],
];
assert.equal(rows.length, 15);
rows.forEach((r, i) => {
    assert.deepEqual([r.orderCode, r.district, r.student, r.subject, r.hourlyMin, r.frequency, r.duration, r.teacherGender], expected[i], `第${i + 1}条关键字段`);
    assert.ok(r.rawText.includes(r.orderCode), "每条保留订单原文");
    assert.ok(!/元|\d+一个小时/.test(r.schedule), "薪酬不能混入上课安排");
    assert.ok(Number.isFinite(r.duration), "时长必须为有限数值");
});
assert.ok(rows[3].parseWarnings.some(x => x.includes("时长")), "缺失时长需人工核对");
assert.ok(rows[9].schedule.includes("一个小时20分钟") && rows[9].schedule.includes("周末2小时"), "保留不同日期时长原描述");
assert.ok(rows[9].parseWarnings.some(x => x.includes("时长")));
assert.ok(rows[13].parseWarnings.some(x => x.includes("隔周")));
assert.ok(rows[5].situation.includes("可以中文上课"), "不能丢失国际学校辅导说明");
assert.ok(rows[5].requirement.includes("研究生") && rows[5].requirement.includes("物理专业"));
assert.ok(rows[6].requirement.includes("重点高校"));
assert.ok(rows[9].requirement.includes("重点高校"));
assert.equal(rows[11].city, "珠海");
const embeddedNumber = parseOrders("GZ26999999\n【地址】海珠区示例路123456号\n【年级】初二男\n【科目】数学\n【时间】一周1次，一次2小时\n【待遇】100元/h\n备注电话：13800000000", "jiang");
assert.equal(embeddedNumber.length, 1, "地址和备注中的长数字不能被当成新订单");
process.env.TUTOR_DB_PATH = path.resolve("work", `jiang-batch-${Date.now()}.sqlite`);
process.env.TUTOR_EMPTY_DB = "1";
const store = require("../src/lib/v1/store.ts");
const actor = { role: "operator", name: "解析验收" };
const drafts = store.mutate("parse", { source: "jiang", text }, actor);
assert.equal(drafts.length, 15);
assert.ok(drafts.every(d => d.order.state === "draft" && d.order.pool === "A"));
drafts.forEach((d, i) => {
    const saved = store.get("orders", d.order.id);
    assert.equal(saved.rawText, rows[i].rawText);
    assert.deepEqual(saved.subjects, rows[i].subject.split(" / "));
});
const corrected = store.mutate("order.update", { id: drafts[3].order.id, revision: 1, patch: { duration: 2 } }, actor);
assert.equal(corrected.duration, 2);
assert.equal(corrected.rawText, rows[3].rawText, "人工补全时长保留原文");
const reopened = store.mutate("order.check", { id: corrected.id }, actor);
assert.ok(!reopened.missing.some(x => x.includes("时长")), "补全时长后重新核对不应继续提示缺失");
const unresolved = store.mutate("order.check", { id: drafts[9].order.id }, actor);
assert.ok(unresolved.missing.some(x => x.includes("时长")), "重开草稿保留未解决提示");
const duplicates = store.mutate("parse", { source: "jiang", text }, actor);
assert.ok(duplicates.every(d => d.duplicates.length > 0), "整批重复上传都应提示");
console.log("PASS 渠道A15条：关键字段逐条断言、特殊时间警告、草稿入库、人工修正、重复检测、原文保留（独立测试库）");

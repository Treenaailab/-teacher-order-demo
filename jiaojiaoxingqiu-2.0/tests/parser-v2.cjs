/* 柔性解析与双状态回归测试，使用独立临时 SQLite。 */
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
process.env.TUTOR_DB_PATH = path.resolve("work", `parser-v2-${Date.now()}.sqlite`);
process.env.TUTOR_EMPTY_DB = "1";
const { parseOrders } = require("../src/lib/parser.ts");
const store = require("../src/lib/v1/store.ts");
const domain = require("../src/lib/v1/domain.ts");
const actor = { role: "operator", name: "V2测试管理员" };
const unlabelled = `广州26999000
越秀区示例路段
初三男
政治
巩固提升
一周一次，一次2小时，周六下午
女老师有经验，示例高校
大学生140一小时`;
const second = `26999016
地址★ 天河区示例路段附近
初一 女生 数学
基础巩固
每周2次，每次1.5小时，周末下午
女大学生，有经验
专职220元/小时`;
const rows = parseOrders(`${unlabelled}\n\n${second}`, "owned");
assert.equal(rows.length, 2, "无固定标签的空行批量应拆成两条");
assert.equal(rows[0].address, "越秀区示例路段");
assert.equal(rows[0].collegeMin, 140);
assert.equal(rows[0].parseConfidence, 100);
assert.equal(rows[1].district, "天河区");
assert.equal(rows[1].duration, 1.5);
assert.equal(rows[1].professionalMin, 220);
const draft = store.mutate("parse", { source: "owned", text: unlabelled }, actor)[0].order;
assert.equal(draft.businessStatus, "待匹配");
assert.equal(draft.business_status, "待匹配");
assert.equal(draft.financeStatus, "未收款");
const closed = store.mutate("order.update", { id: draft.id, revision: draft.revision, patch: { businessStatus: "成交" } }, actor);
assert.equal(closed.businessState, "已成交", "新业务状态需兼容旧字段");
assert.equal(closed.businessStatus, "成交");
assert.equal(store.all("deals")[0].actual, 42000);
assert.equal(domain.cashSummary(closed, store.all("deals")[0], []).status, "未收款");
console.log("PASS parser-v2: 柔性拆单、无标签推断、字段置信度、双状态兼容、财务状态");

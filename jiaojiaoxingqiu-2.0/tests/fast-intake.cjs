/* Uses an isolated SQLite file; the user's order database is never modified. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, file);
process.env.TUTOR_DB_PATH = path.resolve('work', `fast-intake-${Date.now()}.sqlite`);
process.env.TUTOR_EMPTY_DB = '1';
const store = require('../src/lib/v1/store.ts');
const { parseOrders } = require('../src/lib/parser.ts');
const actor = { role: 'operator', name: '测试管理员' };
const raw = (situation = '巩固提升', code = '广州26999000') => `${code}\n【上课地址】越秀区测试地点\n【年级性别】初三男\n【补习科目】政治\n【学生情况】${situation}\n【上课时间】一周一次，一次2小时，周六下午\n【老师要求】女老师有经验\n【工资待遇】大学生140一小时`;
const screenshotSample = '广州GZ579990\n年级性别科目：高一男生物理\n成绩：基础不好\n时间：一周1次 每次2小时 周六上课\n课费：240-260/2小时\n要求：211院校 专业对口点的 高中理科辅导经验丰富点 负责耐心熟悉知识点 讲课思路清晰的\n地点：花都区示例花园';
assert.equal(parseOrders(screenshotSample, 'jiang').length, 1);

const first = store.mutate('parse.publish', { source: 'jiang', text: raw() }, actor);
assert.equal(first.published, 1);
assert.equal(store.publicData().orders.length, 1);
let order = store.all('orders')[0];
const id = order.id;
assert.equal(order.state, 'published');

const repeat = store.mutate('parse.publish', { source: 'jiang', text: raw('查漏补缺') }, actor);
assert.equal(repeat.updated, 1);
order = store.get('orders', id);
assert.equal(order.situation, '查漏补缺');
assert.equal(store.publicData().orders.length, 1);
assert.equal(store.history(id).raw.length, 2);

const withinBatch = store.mutate('parse.publish', { source: 'jiang', text: `${raw('旧版', '广州26999001')}\n\n${raw('最新版', '广州26999001')}` }, actor);
assert.equal(withinBatch.total, 2);
assert.equal(withinBatch.unique, 1);
assert.equal(withinBatch.published, 1);
assert.equal(store.all('orders').find(o => o.orderCode === '广州26999001').situation, '最新版');
const staleDraft = store.mutate('parse', { source: 'jiang', text: raw('历史重复草稿', '广州26999001') }, actor)[0].order;
const cleanOld = store.mutate('parse.publish', { source: 'jiang', text: raw('本次最新', '广州26999001') }, actor);
assert.equal(cleanOld.updated, 1);
assert.equal(cleanOld.deduplicated, 1);
assert.ok(store.get('orders', staleDraft.id).deletedAt);
assert.equal(store.publicData().orders.length, 2);

order = store.mutate('order.update', { id, revision: order.revision, patch: { businessState: '已成交' } }, actor);
const dealCount = store.all('deals').length;
const protectedResult = store.mutate('parse.publish', { source: 'jiang', text: raw('成交后重发') }, actor);
assert.equal(protectedResult.protected, 1);
assert.equal(store.get('orders', id).situation, '查漏补缺');
assert.equal(store.get('orders', id).businessState, '已成交');
assert.equal(store.all('deals').length, dealCount);
assert.equal(store.publicData().orders.length, 2);

const screenshotResult = store.mutate('parse.publish', { source: 'jiang', text: screenshotSample }, actor);
assert.equal(screenshotResult.published, 1);
assert.equal(store.publicData().orders.length, 3);
const screenshotRepeat = store.mutate('parse.publish', { source: 'jiang', text: screenshotSample.replace('广州GZ579990', 'GZ579990').replace('基础不好', '基础一般') }, actor);
assert.equal(screenshotRepeat.updated, 1);
assert.equal(store.publicData().orders.length, 3);

const incomplete = store.mutate('parse.publish', { source: 'jiang', text: '广州26999002\n【年级性别】初三男\n【补习科目】政治\n【上课时间】周六一次2小时\n【工资待遇】140元每小时' }, actor);
assert.equal(incomplete.published, 0);
assert.equal(incomplete.skipped.length, 1);
assert.equal(store.publicData().orders.length, 3);

console.log('PASS 一键解析上架、同批保留最新、跨批更新、编号别名查重、已成交保护、缺字段跳过（独立测试库）');

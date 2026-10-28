import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { sampleOrders } from "../orders";
import { parseOrders, parseSchedule, compensationBounds, type OrderSource, type ParsedOrder } from "../parser";
import { businessStates, businessStatuses, financeStatuses, toBusinessStatus, toLegacyBusinessState, profileStates, ledgerTypes, calculateDeal, cashSummary, cents, type Order, type Teacher, type Deal, type Ledger, type Settings, type Batch, type ParentRequest, type Audit, type PublicTeacher, type PublicOrder, type LegacyRecord, type BusinessStatus, type FinanceStatus } from "./domain";
const tables = ["orders", "teachers", "deals", "ledger", "batches", "requests", "settings", "audit", "legacy"] as const;
type Table = typeof tables[number];
const stamp = () => new Date().toISOString();
const globals = globalThis as unknown as {
    tutorDB?: DatabaseSync;
};
export function db() { if (globals.tutorDB) {
    globals.tutorDB.exec("CREATE TABLE IF NOT EXISTS legacy (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))");
    return globals.tutorDB;
} const path = process.env.TUTOR_DB_PATH || resolve(process.cwd(), "data/tutor-v1.sqlite"); mkdirSync(dirname(path), { recursive: true }); const d = new DatabaseSync(path); d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;"); for (const table of tables)
    d.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));`); d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS deal_order ON deals(json_extract(data,'$.orderId')); CREATE TABLE IF NOT EXISTS raw_versions (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, raw_text TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TRIGGER IF NOT EXISTS raw_immutable_update BEFORE UPDATE ON raw_versions BEGIN SELECT RAISE(ABORT,'Original text is immutable'); END; CREATE TRIGGER IF NOT EXISTS raw_immutable_delete BEFORE DELETE ON raw_versions BEGIN SELECT RAISE(ABORT,'Original text is retained'); END; CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL, entity_id TEXT, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);`); globals.tutorDB = d; if (!get<Settings>("settings", "main")) {
    put("settings", "main", defaults());
    if (process.env.TUTOR_EMPTY_DB !== "1")
        seed();
} return d; }
function normalizeOrder(value: Order): Order {
    const businessStatus = toBusinessStatus(value.businessStatus ?? value.business_status, value.businessState);
    const financeStatus = (financeStatuses.includes(value.financeStatus as FinanceStatus) ? value.financeStatus : value.finance_status) as FinanceStatus ?? "未收款";
    return { ...value, schemaVersion: Math.max(2, value.schemaVersion ?? 1), businessStatus, financeStatus, business_status: businessStatus, finance_status: financeStatus, parseWarnings: value.parseWarnings ?? [], parsedFields: value.parsedFields ?? {} };
}
export function all<T>(table: Table): T[] { return db().prepare(`SELECT data FROM ${table}`).all().map(r => { const value = JSON.parse(r.data as string); return (table === "orders" ? normalizeOrder(value as Order) : value) as T; }); }
export function get<T>(table: Table, id: string): T | undefined { const r = db().prepare(`SELECT data FROM ${table} WHERE id=?`).get(id); if (!r) return undefined; const value = JSON.parse(r.data as string); return (table === "orders" ? normalizeOrder(value as Order) : value) as T; }
export function put(table: Table, id: string, data: unknown) { db().prepare(`INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(id, JSON.stringify(data)); }
export function transaction<T>(fn: () => T): T { db().exec("BEGIN IMMEDIATE"); try {
    const value = fn();
    db().exec("COMMIT");
    return value;
}
catch (e) {
    db().exec("ROLLBACK");
    throw e;
} }
export function settings() { const current = get<Settings>("settings", "main")!; if ((current.feeRulesVersion ?? 0) >= 2) return current; const migrated = structuredClone(current); const weeklyFive = migrated.rules.find(r => r.id === "weekly-5"); if (weeklyFive) weeklyFive.percentage = 80; const monthly = migrated.rules.find(r => r.id === "monthly"); if (monthly) { monthly.percentage = 20; monthly.name = "全职 / 住家（月薪）"; } const online = migrated.rules.find(r => r.id === "online"); if (online) online.name = "线上（线下信息费基础的150%）"; if (!migrated.rules.some(r => r.mode === "shortTerm" && !r.deletedAt)) migrated.rules.push({ id: "short-term-20day", name: "短期家教（20天内）", mode: "shortTerm", frequency: 0, percentage: 20, active: true }); migrated.feeRulesVersion = 2; migrated.revision = (migrated.revision ?? 0) + 1; put("settings", "main", migrated); return migrated; }
export function defaults(): Settings { return { feeRulesVersion: 2, channels: [{ id: "jiang", name: "渠道A", pool: "A", percentage: 50, ourPercentage: 50, active: true }, { id: "yang", name: "渠道B", pool: "B", percentage: 50, ourPercentage: 50, active: true }, { id: "pengcheng", name: "渠道C", pool: "C", percentage: 50, ourPercentage: 50, active: true }, { id: "owned", name: "自有", pool: "owned", percentage: 50, ourPercentage: 50, active: true }], dictionaries: Object.entries({ subject: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理", "全科"], district: ["天河区", "海珠区", "番禺区", "越秀区", "白云区", "黄埔区", "荔湾区", "增城区", "花都区", "佛山", "东莞", "其他"], teacherType: ["大学生", "专职老师"], teacherSource: ["社群", "小红书", "转介绍", "校园代理", "其他"], lostReason: ["老师不合适", "家长取消", "订单已出", "时间不匹配", "薪资不匹配", "老师主动放弃", "简历未通过", "其他"], refundReason: ["家长取消", "试课未通过", "老师放弃", "其他"] }).flatMap(([kind, names]) => names.map((name, i) => ({ id: `${kind}-${i}`, kind, name, active: true }))), rules: [...([150, 100, 90, 80, 80].map((percentage, i) => ({ id: `weekly-${i + 1}`, name: `每周${i + 1}${i === 4 ? "次及以上" : "次"}`, mode: "weekly", frequency: i + 1, percentage, active: true }))), { id: "continuous", name: "连续10/15/20次（旧规则）", mode: "continuous", frequency: 0, percentage: 20, active: true }, { id: "short-term-20day", name: "短期家教（20天内）", mode: "shortTerm", frequency: 0, percentage: 20, active: true }, { id: "monthly", name: "全职 / 住家（月薪）", mode: "monthly", frequency: 0, percentage: 20, active: true }, { id: "online", name: "线上（线下信息费基础的150%）", mode: "online", frequency: 0, percentage: 150, active: true }] }; }
export function fromParsed(p: ParsedOrder, sourceChannel: string): Order { const now = stamp(), businessStatus: BusinessStatus = "待匹配", financeStatus: FinanceStatus = "未收款"; return { id: randomUUID(), orderCode: p.orderCode, city: p.city, district: p.district, address: p.address, grade: p.grade, gender: p.gender, subjects: p.subject.split(/[、,，/\s]+/).filter(Boolean), situation: p.situation, schedule: p.schedule, weekdays: p.weekdays, requirement: p.requirement, teacherType: p.teacherType, collegeRate: p.collegeRate, professionalRate: p.professionalRate, perClassRate: p.classRate, hourlyMin: p.hourlyMin, hourlyMax: p.hourlyMax, collegeMin: p.collegeMin, collegeMax: p.collegeMax, professionalMin: p.professionalMin, professionalMax: p.professionalMax, pool: settings().channels.find(c => c.id === sourceChannel)?.pool ?? p.pool, sourceChannel, state: "draft", businessState: "已发布", businessStatus, financeStatus, business_status: businessStatus, finance_status: financeStatus, validity: "unverified", createdAt: now, updatedAt: now, publishedAt: "", revision: 1, rawText: p.rawText, rawCompensation: p.rawCompensation, rawSchedule: p.rawSchedule, goal: p.goal, teacherGender: p.teacherGender, frequency: p.frequency, duration: p.duration, timePeriods: p.timePeriods, trialTime: p.trialTime, teacherName: "", teacherSource: "", lostReason: "", refundReason: "", refundAmount: 0, refundDate: "", trialRate: p.hourlyMin ?? 0, feeMode: "weekly", lessonCount: 10, monthlySalary: 0, customFields: {}, schemaVersion: 2, parseConfidence: p.parseConfidence, parseWarnings: p.parseWarnings, parsedFields: p.parsedFields }; }
function seed() { for (const fixture of sampleOrders) {
    const source = ({ A: "jiang", B: "yang", C: "pengcheng", owned: "owned" })[fixture.pool];
    const raw = `${fixture.orderCode}\n【地址】${fixture.address}\n【年级】${fixture.grade}\n【科目】${fixture.subjects.join("/")}\n【情况】${fixture.situation}\n【时间】${fixture.schedule}\n【要求】${fixture.requirement}\n【待遇】${fixture.collegeRate ?? fixture.professionalRate ?? fixture.perClassRate ?? ""}`;
    const parsed = parseOrders(raw, source as OrderSource)[0];
    const base = fromParsed(parsed, source), c = compensationBounds(fixture.collegeRate ?? (fixture.teacherType !== "professional" ? fixture.perClassRate ?? "" : ""), base.duration), p = compensationBounds(fixture.professionalRate ?? (fixture.teacherType !== "college" ? fixture.perClassRate ?? "" : ""), base.duration);
    const order = { ...base, ...fixture, collegeRate: fixture.collegeRate ?? "", professionalRate: fixture.professionalRate ?? "", collegeMin: c?.min, collegeMax: c?.max, professionalMin: p?.min, professionalMax: p?.max, sourceChannel: source, state: "published", createdAt: fixture.publishedAt, rawText: raw };
    put("orders", order.id, order);
    addRaw(order.id, raw);
} }
function addRaw(orderId: string, text: string) { if (!text)
    return; const found = db().prepare("SELECT id FROM raw_versions WHERE order_id=? AND raw_text=?").get(orderId, text); if (!found)
    db().prepare("INSERT INTO raw_versions VALUES(?,?,?,?)").run(randomUUID(), orderId, text, stamp()); }
export function history(id: string) { return { audit: all<Audit>("audit").filter(a => a.entityId === id).sort((a, b) => b.at.localeCompare(a.at)), raw: db().prepare("SELECT raw_text AS text,created_at AS at FROM raw_versions WHERE order_id=? ORDER BY created_at").all(id) }; }
function audit(entity: string, id: string, actor: string, before: object, after: object) { const a = before as Record<string, unknown>, b = after as Record<string, unknown>; const changes = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(field => ({ field, before: a[field] ?? null, after: b[field] ?? null })); if (changes.length) {
    const entry: Audit = { id: randomUUID(), entity, entityId: id, actor, at: stamp(), changes };
    put("audit", entry.id, entry);
} }
function must<T>(value: T | undefined, message = "记录不存在"): T { if (!value)
    throw new Error(message); return value; }
function revision(current: {
    revision: number;
}, expected: unknown) { if (current.revision !== expected)
    throw new Error("记录已被其他窗口修改，请刷新后重试。"); }
function finite(value: unknown, min = 0, max = 10000000) { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error("数值超出允许范围"); return value; }
function text(value: unknown, max = 30000) { if (typeof value !== "string" || value.length > max)
    throw new Error("文本字段格式或长度不正确"); return value.trim(); }
const orderFields = ["orderCode", "city", "district", "address", "grade", "gender", "subjects", "situation", "schedule", "weekdays", "requirement", "teacherType", "collegeRate", "professionalRate", "perClassRate", "hourlyMin", "hourlyMax", "collegeMin", "collegeMax", "professionalMin", "professionalMax", "sourceChannel", "state", "businessState", "businessStatus", "business_status", "financeStatus", "finance_status", "validity", "goal", "teacherGender", "frequency", "duration", "timePeriods", "trialTime", "teacherName", "teacherSource", "lostReason", "refundReason", "refundAmount", "refundDate", "trialRate", "feeMode", "lessonCount", "monthlySalary", "actualFee", "channelFeeOverride", "incomeOverride", "personalOverride", "customFields"];
const numberFields = ["hourlyMin", "hourlyMax", "collegeMin", "collegeMax", "professionalMin", "professionalMax", "frequency", "duration", "refundAmount", "trialRate", "lessonCount", "monthlySalary", "actualFee", "channelFeeOverride", "incomeOverride", "personalOverride"];
function patchOrder(old: Order, patch: Record<string, unknown>): Order {
    const next = { ...old } as Order;
    for (const k of orderFields) {
        if (!(k in patch))
            continue;
        const value = patch[k];
        if (numberFields.includes(k)) {
            (next as unknown as Record<string, unknown>)[k] = value == null ? undefined : finite(value);
        }
        else if (["subjects", "weekdays", "timePeriods"].includes(k)) {
            if (!Array.isArray(value) || value.length > 40)
                throw new Error("列表格式不正确");
            if (k === "weekdays" && value.some(d => !Number.isInteger(d) || d < 1 || d > 7))
                throw new Error("上课日期须在周一到周日之间");
            (next as unknown as Record<string, unknown>)[k] = k === "weekdays" ? value : value.map(v => text(v, 100));
        }
        else if (k === "customFields") {
            if (!value || Array.isArray(value) || typeof value !== "object")
                throw new Error("附加字段格式不正确");
            next.customFields = Object.fromEntries(Object.entries(value).map(([key, v]) => [text(key, 80), text(v, 3000)]));
        }
    else
            (next as unknown as Record<string, unknown>)[k] = text(value);
    }
    const requestedBusiness = (patch.businessStatus ?? patch.business_status) as string | undefined;
    if (requestedBusiness !== undefined) {
        if (!businessStatuses.includes(requestedBusiness as BusinessStatus))
            throw new Error("订单业务状态不正确");
        next.businessStatus = requestedBusiness as BusinessStatus;
        next.business_status = next.businessStatus;
        next.businessState = toLegacyBusinessState(next.businessStatus, next.businessState);
    }
    else if ("businessState" in patch) {
        next.businessStatus = toBusinessStatus(next.businessState, next.businessState);
        next.business_status = next.businessStatus;
    }
    const requestedFinance = (patch.financeStatus ?? patch.finance_status) as string | undefined;
    if (requestedFinance !== undefined) {
        if (!financeStatuses.includes(requestedFinance as FinanceStatus))
            throw new Error("财务状态不正确");
        next.financeStatus = requestedFinance as FinanceStatus;
        next.finance_status = next.financeStatus;
    }
    const ratesChanged = ["collegeRate", "professionalRate", "perClassRate", "duration", "teacherType"].some(k => k in patch && patch[k] !== old[k as keyof Order]);
    if (ratesChanged) {
        const c = compensationBounds(next.collegeRate || ((next.teacherType !== "professional" ? next.perClassRate : "") ?? ""), next.duration), p = compensationBounds(next.professionalRate || ((next.teacherType !== "college" ? next.perClassRate : "") ?? ""), next.duration);
        next.collegeMin = c?.min;
        next.collegeMax = c?.max;
        next.professionalMin = p?.min;
        next.professionalMax = p?.max;
        const rates = [next.teacherType !== "professional" ? c?.min : undefined, next.teacherType !== "professional" ? c?.max : undefined, next.teacherType !== "college" ? p?.min : undefined, next.teacherType !== "college" ? p?.max : undefined].filter(x => x !== undefined) as number[];
        next.hourlyMin = rates.length ? Math.min(...rates) : undefined;
        next.hourlyMax = rates.length ? Math.max(...rates) : undefined;
        if (patch.trialRate === undefined || patch.trialRate === old.trialRate)
            next.trialRate = next.hourlyMin ?? 0;
    }
    if (!businessStates.includes(next.businessState as typeof businessStates[number]))
        throw new Error("订单业务状态不正确");
    if (!["draft", "published", "delisted"].includes(next.state))
        throw new Error("上架状态不正确");
    const channel = must(settings().channels.find(c => c.id === next.sourceChannel), "渠道不存在");
    if (next.sourceChannel !== old.sourceChannel && (!channel.active || channel.deletedAt))
        throw new Error("渠道已停用");
    next.pool = channel.pool;
    if (next.businessState === "未成交" && !next.lostReason)
        throw new Error("请填写未成交原因");
    if (["退费中", "已退费"].includes(next.businessState) && (!next.refundReason || !next.refundAmount || !/^\d{4}-\d{2}-\d{2}$/.test(next.refundDate)))
        throw new Error(!next.refundReason ? "请填写退费原因" : !next.refundAmount ? "请填写退费金额" : "请填写退费日期（YYYY-MM-DD）");
    if (next.state === "published" && (!next.orderCode || !next.address || !next.grade || !next.subjects.length || !next.schedule))
        throw new Error("发布前请补齐编号、地址、年级、科目和时间");
    if (next.state === "published" && !next.publishedAt)
        next.publishedAt = stamp();
    next.updatedAt = stamp();
    next.revision = old.revision + 1;
    return next;
}
function saveOrder(old: Order, next: Order, actor: string) {
    if (next.businessState === "已退费") {
        const refunded = all<Ledger>("ledger").filter(t => t.orderId === next.id && t.type === "退款" && !t.deletedAt).reduce((s, t) => s + t.amount, 0);
        if (refunded < cents(next.refundAmount))
            throw new Error("请先登记实际退款流水，再标记已退费。");
    }
    const previous = all<Deal>("deals").find(d => d.orderId === next.id);
    if (next.businessState === "已成交" || previous) {
        const channel = must(settings().channels.find(c => c.id === next.sourceChannel));
        const rules = previous && previous.rule.mode === next.feeMode && (next.feeMode !== "weekly" || previous.rule.frequency === Math.min(5, next.frequency)) ? [previous.rule] : settings().rules;
        const deal = calculateDeal(next, channel, rules, previous);
        put("deals", deal.id, deal);
        audit("deal", next.id, actor, previous ?? {}, deal);
    }
    put("orders", next.id, next);
    audit("order", next.id, actor, old, next);
    return next;
}
export function duplicates(order: Order) { return all<Order>("orders").filter(o => o.id !== order.id && !o.deletedAt).filter(o => o.orderCode === order.orderCode || (o.address === order.address && o.grade === order.grade && o.subjects.join() === order.subjects.join())).map(o => ({ id: o.id, orderCode: o.orderCode, address: o.address, grade: o.grade, subjects: o.subjects, revision: o.revision, same: o.address === order.address && o.grade === order.grade && o.subjects.join() === order.subjects.join(), identical: o.rawText.trim() === order.rawText.trim() })); }
function orderCodeKey(code: string) {
    return code.trim().toUpperCase().replace(/[\s\-_/]/g, "").replace(/^广州市?GZ/, "GZ").replace(/^广州市?/, "GZ");
}
const parsedContentFields = ["orderCode", "city", "district", "address", "grade", "gender", "subjects", "situation", "schedule", "weekdays", "requirement", "teacherType", "collegeRate", "professionalRate", "perClassRate", "hourlyMin", "hourlyMax", "collegeMin", "collegeMax", "professionalMin", "professionalMax", "sourceChannel", "goal", "teacherGender", "frequency", "duration", "timePeriods", "trialTime"] as const;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export type Session = {
    role: string;
    name: string;
    entity_id: string | null;
    expires: number;
};
export function session(token: string | undefined) { if (!token)
    return undefined; return db().prepare("SELECT role,name,entity_id,expires FROM sessions WHERE token_hash=? AND expires>?").get(hash(token), Date.now()) as Session | undefined; }
export function newSession(role: string, name: string, entityId = "") { const token = randomBytes(32).toString("hex"); db().prepare("INSERT INTO sessions VALUES(?,?,?,?,?)").run(hash(token), role, name, entityId, Date.now() + (role === "teacher" ? 365 : 1) * 86400e3); return token; }
export function logout(token: string) { db().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token)); }
function equal(a: string, b: string) { return !!a && !!b && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b))); }
export function login(username: string, password: string) { const key = hash(username); const attempt = db().prepare("SELECT attempts,reset_at FROM login_attempts WHERE key=?").get(key); if (attempt && Number(attempt.reset_at) > Date.now() && Number(attempt.attempts) >= 10)
    throw new Error("尝试次数过多，请15分钟后重试"); for (const a of [{ u: process.env.TUTOR_ADMIN_USERNAME, p: process.env.TUTOR_ADMIN_PASSWORD, role: "operator", name: "普通管理员" }, { u: process.env.TUTOR_SUPERADMIN_USERNAME, p: process.env.TUTOR_SUPERADMIN_PASSWORD, role: "admin", name: "超级管理员" }])
    if (equal(username, a.u ?? "") && equal(password, a.p ?? "")) {
        db().prepare("DELETE FROM login_attempts WHERE key=?").run(key);
        return { ...a, token: newSession(a.role, a.name) };
    } db().prepare("INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END").run(key, Date.now() + 900e3, Date.now(), Date.now()); throw new Error("账号或密码不正确"); }
// Public payloads are allowlisted. Internal fields and original text never leave this boundary.
function sanitize(value: string, extra: string[] = []) { let result = value; for (const name of ["渠道A", "渠道B", "渠道C", ...settings().channels.filter(c => c.id !== "owned").map(c => c.name), ...extra].filter(Boolean)) {
    result = result.split(name).join("平台");
} return result.replace(/(?:微信|手机|电话|联系号码)\s*[:：]?\s*[\w+ -]+/gi, "[联系方式已隐藏]").replace(/\b1[3-9]\d{9}\b/g, "[手机号已隐藏]"); }
export function publicOrder(o: Order): PublicOrder { const clean = (s: string) => sanitize(s ?? ""); const publicPool = settings().channels.find(c => c.id === o.sourceChannel)?.pool ?? o.pool; return { id: o.id, orderCode: clean(o.orderCode), city: clean(o.city), district: clean(o.district), address: clean(o.address), grade: clean(o.grade), gender: ["男", "女"].includes(o.gender) ? o.gender : "", subjects: o.subjects.map(clean), situation: clean(o.situation), schedule: clean(o.schedule), weekdays: o.weekdays, requirement: clean(o.requirement), teacherType: o.teacherType, collegeRate: o.teacherType === "professional" ? "" : clean(o.collegeRate ?? ""), professionalRate: o.teacherType === "college" ? "" : clean(o.professionalRate ?? ""), perClassRate: clean(o.perClassRate ?? ""), hourlyMin: o.hourlyMin, hourlyMax: o.hourlyMax, pool: clean(publicPool) as PublicOrder["pool"], publicPoolLabel: clean(publicPool === "owned" ? "高性价比急出单" : /^[A-Z]$/.test(publicPool) ? publicPool + "池" : publicPool), completed: o.businessStatus === "成交" || o.businessState === "已成交", publishedAt: o.publishedAt, goal: clean(o.goal), teacherGender: o.teacherGender, collegeMin: o.collegeMin, collegeMax: o.collegeMax, professionalMin: o.professionalMin, professionalMax: o.professionalMax, timePeriods: o.timePeriods, duration: o.duration }; }
export function publicTeacher(t: Teacher): PublicTeacher { const clean = (s: string) => sanitize(s ?? "", [t.name, t.wechat, t.phone]); return { id: t.id, displayName: `${t.name.slice(0, 1) || "已认证"}老师${t.school ? "｜" + clean(t.school.replace("华南师范大学", "华师")) : ""}`, gender: t.gender, teacherType: t.teacherType, school: clean(t.school), major: clean(t.major), currentGrade: clean(t.currentGrade), education: clean(t.education), teachingYears: clean(t.teachingYears), grades: t.grades.map(clean), subjects: t.subjects.map(clean), experience: clean(t.experience), strengths: clean(t.strengths), style: clean(t.style), suitable: clean(t.suitable), availableTime: clean(t.availableTime), minimumRate: t.minimumRate, intro: clean(t.intro), verified: t.verified.map(clean) }; }
export function publicData() { const currentSettings = settings(); const orders = all<Order>("orders").filter(o => o.state === "published" && !o.deletedAt && o.validity !== "unavailable").sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); const ids = new Set(orders.map(o => o.id)); const pools = [...new Set(["A", "B", "C", "owned", ...currentSettings.channels.filter(c => c.active && !c.deletedAt).map(c => c.pool).filter(Boolean)])]; return { orders: orders.map(publicOrder), pools, teachers: all<Teacher>("teachers").filter(t => t.state === "published" && !t.deletedAt).map(publicTeacher), batches: all<Batch>("batches").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(b => ({ id: b.id, createdAt: b.createdAt, items: b.items.filter(i => ids.has(i.orderId)).map(i => ({ pool: sanitize(i.pool), district: sanitize(i.district), isNew: i.isNew })) })), dictionaries: currentSettings.dictionaries.filter(d => d.active && !d.deletedAt && ["subject", "district", "teacherType"].includes(d.kind)).map(d => ({ id: d.id, kind: d.kind, name: sanitize(d.name) })) }; }
export function adminData(s: Session) {
    const orders = all<Order>("orders");
    const deals = all<Deal>("deals").map(deal => {
        // 兼容旧表单把空的实际信息费保存为 0 的成交记录。
        // 仅对实际为 0 且订单也没有人工金额覆盖的记录重算，保留真实人工金额。
        if (deal.actual !== 0)
            return deal;
        const order = orders.find(item => item.id === deal.orderId);
        const channel = order && settings().channels.find(item => item.id === order.sourceChannel);
        if (!order || !channel || (order.actualFee !== undefined && order.actualFee > 0))
            return deal;
        try {
            return calculateDeal({ ...order, actualFee: undefined }, channel, [deal.rule], deal);
        }
        catch {
            return deal;
        }
    });
    const ledger = all<Ledger>("ledger");
    const ordersWithFinance = orders.map(order => { const status = cashSummary(order, deals.find(deal => deal.orderId === order.id), ledger).status; return { ...order, financeStatus: status, finance_status: status }; });
    return { orders: ordersWithFinance, teachers: all<Teacher>("teachers"), requests: all<ParentRequest>("requests"), deals, ledger, batches: all<Batch>("batches"), legacy: all<LegacyRecord>("legacy"), settings: settings(), role: s.role, name: s.name };
}
export function emptyTeacher(): Teacher { return { id: randomUUID(), name: "", gender: "", teacherType: "college", school: "", major: "", currentGrade: "", education: "", teachingYears: "", certificate: "", currentlyTeaching: "", grades: [], subjects: [], experience: "", strengths: "", style: "", suitable: "", district: "", areas: [], availableTime: "", minimumRate: 0, certificates: "", intro: "", wechat: "", phone: "", source: "自主登记", notes: "", followup: "待跟进", state: "draft", verified: [], createdAt: stamp(), updatedAt: stamp(), revision: 0 }; }
export function saveTeacher(patch: Record<string, unknown>, actor: string, existing?: Teacher, admin = false) { const t = { ...(existing ?? emptyTeacher()) }; for (const k of Object.keys(t)) {
    if (["id", "createdAt", "updatedAt", "revision", "deletedAt", ...(!admin ? ["source", "notes", "followup", "verified"] : [])].includes(k) || !(k in patch))
        continue;
    const value = patch[k];
    if (["subjects", "grades", "areas", "verified"].includes(k)) {
        if (!Array.isArray(value))
            throw new Error("请选择有效列表");
        (t as unknown as Record<string, unknown>)[k] = [...new Set(value.map(v => text(v, 100)).filter(Boolean))];
    }
    else if (k === "minimumRate")
        t.minimumRate = finite(value);
    else
        (t as unknown as Record<string, unknown>)[k] = text(value, 5000);
} if (!profileStates.includes(t.state as typeof profileStates[number]))
    throw new Error("资料状态不正确"); if (!admin && !["draft", "pending_review"].includes(t.state))
    throw new Error("公开资料需要管理员审核"); if (["pending_review", "published"].includes(t.state) && (!t.name || !t.phone || !t.wechat || !t.subjects.length || !t.grades.length || !t.intro))
    throw new Error("请补齐姓名、联系方式、可教年级科目和自我介绍"); if (t.phone && !/^1\d{10}$/.test(t.phone))
    throw new Error("请输入11位手机号"); t.updatedAt = stamp(); t.revision++; put("teachers", t.id, t); audit("teacher", t.id, actor, existing ?? {}, t); return t; }
export function mutate(action: string, p: Record<string, unknown>, s: Session): unknown {
    return transaction(() => {
        const actor = s.name;
        if (action === "legacy.import") {
            const payload = p.payload as Record<string, Record<string, unknown>[]>;
            let imported = 0;
            for (const [kind, items] of Object.entries(payload)) {
                if (!["orders", "teachers", "requests", "finance"].includes(kind) || !Array.isArray(items))
                    continue;
                for (const item of items.slice(0, 1000)) {
                    const id = `legacy-${kind}-${String(item.id ?? hash(JSON.stringify(item)))}`;
                    if (get("legacy", id))
                        continue;
                    const record: LegacyRecord = { id, kind, original: item, createdAt: stamp() };
                    put("legacy", id, record);
                    if (kind === "orders") {
                        const code = String(item.orderCode ?? "");
                        if (!all<Order>("orders").some(o => o.orderCode === code)) {
                            const raw = String(item.rawText ?? `【订单编号】${code}\n【地址】${item.address ?? ""}\n【年级】${item.grade ?? ""}\n【科目】${(item.subjects as string[] ?? []).join("/")}\n【情况】${item.situation ?? ""}\n【时间】${item.schedule ?? ""}\n【要求】${item.requirement ?? ""}\n【待遇】${item.collegeRate ?? item.professionalRate ?? item.perClassRate ?? ""}`);
                            const parsed = parseOrders(raw, String(item.sourceChannel ?? "owned") as OrderSource)[0];
                            if (parsed) {
                                const order = fromParsed(parsed, String(item.sourceChannel ?? "owned"));
                                order.id = id;
                                order.createdAt = String(item.createdAt ?? stamp());
                                order.customFields = { 迁移说明: item.rawText ? "旧版原文已保留" : "旧版未保存原文，此处由旧结构化字段重建；旧记录另行完整存档" };
                                put("orders", id, order);
                                addRaw(id, raw);
                                record.linked = id;
                            }
                        }
                    }
                    if (kind === "teachers") {
                        const t = emptyTeacher();
                        Object.assign(t, { id, name: String(item.display_name ?? ""), gender: String(item.gender ?? ""), teacherType: String(item.teacher_type ?? "college"), school: String(item.school ?? ""), major: String(item.major ?? ""), currentGrade: String(item.current_grade ?? ""), district: (item.preferred_districts as string[] ?? []).join("、"), areas: item.teaching_districts ?? [], subjects: item.subjects ?? [], grades: item.grades ?? [], minimumRate: Number(item.minimum_hourly_rate) || 0, availableTime: String(item.available_time ?? ""), wechat: String(item.wechat ?? ""), phone: String(item.phone ?? ""), teachingYears: String(item.teaching_years ?? ""), certificate: String(item.teacher_certificate ?? ""), currentlyTeaching: String(item.currently_teaching ?? ""), state: "incomplete", notes: "旧浏览器资料迁移，待核对后公开", revision: 1 });
                        put("teachers", id, t);
                        record.linked = id;
                    }
                    if (kind === "requests") {
                        put("requests", id, { id, state: "pending_review", createdAt: String(item.created_at ?? stamp()), fields: Object.fromEntries(Object.entries(item).filter(([k]) => /[\u4e00-\u9fff]/.test(k)).map(([k, v]) => [k, String(v)])), revision: 1 });
                        record.linked = id;
                    }
                    put("legacy", id, record);
                    imported++;
                }
            }
            audit("legacy", "migration", actor, {}, { imported });
            return { imported };
        }
        if (action === "legacy.linkFinance") {
            const old = must(get<LegacyRecord>("legacy", text(p.id)));
            if (old.kind !== "finance" || old.linked)
                throw new Error("该旧流水已处理");
            const order = must(get<Order>("orders", text(p.orderId)));
            const source = old.original;
            const types: Record<string, string> = { received: "全款", refunded: "退款", channel_settlement: "渠道结算", teacher_deposit: "定金", other: "其他收入" };
            const entry: Ledger = { id: old.id, orderId: order.id, type: types[String(source.entry_type)] ?? "其他收入", amount: cents(finite(Number(source.amount), 0.01)), date: String(source.happened_at ?? stamp()).slice(0, 10), reason: String(source.note ?? "旧版流水迁移"), createdAt: String(source.created_at ?? stamp()) };
            put("ledger", entry.id, entry);
            put("legacy", old.id, { ...old, linked: order.id });
            audit("ledger", order.id, actor, {}, entry);
            return entry;
        }
        if (action === "parse.publish") {
            const source = text(p.source, 80);
            const channel = must(settings().channels.find(c => c.id === source && c.active && !c.deletedAt), "请选择已启用的渠道");
            const parsed = parseOrders(text(p.text, 200000), source as OrderSource);
            if (!parsed.length) throw new Error("没有识别到订单，请检查粘贴内容。");
            if (parsed.length > 100) throw new Error("每批最多100条");
            // 同一批次由后出现的版本胜出；不为被覆盖的文本创建草稿。
            const latest = new Map<string, typeof parsed[number]>();
            parsed.forEach((item, index) => latest.set(orderCodeKey(item.orderCode) || `__missing_${index}`, item));
            const batch: Batch = { id: randomUUID(), createdAt: stamp(), items: [] };
            const result = { total: parsed.length, unique: latest.size, published: 0, updated: 0, unchanged: 0, protected: 0, deduplicated: 0, skipped: [] as { code: string; reason: string }[] };
            const hasFinancialRecord = (order: Order) => all<Deal>("deals").some(d => d.orderId === order.id) || all<Ledger>("ledger").some(l => l.orderId === order.id && !l.deletedAt);
            const isProtected = (order: Order) => order.businessStatus === "成交" || order.businessState === "已成交" || hasFinancialRecord(order);
            for (const item of latest.values()) {
                const incoming = fromParsed(item, channel.id);
                const missing = [!incoming.orderCode && "编号", !incoming.address && "地址", !incoming.grade && "年级", !incoming.subjects.length && "科目", !incoming.schedule && "时间"].filter(Boolean).join("、");
                if (missing) { result.skipped.push({ code: incoming.orderCode || "未识别编号", reason: `缺少${missing}` }); continue; }
                const key = orderCodeKey(incoming.orderCode);
                const matches = all<Order>("orders").filter(o => !o.deletedAt && orderCodeKey(o.orderCode) === key)
                    .sort((a, b) => Number(isProtected(b)) - Number(isProtected(a)) || Number(b.state === "published") - Number(a.state === "published") || b.updatedAt.localeCompare(a.updatedAt));
                const target = matches[0];
                if (target) {
                    for (const duplicate of matches.slice(1)) {
                        if (isProtected(duplicate)) continue;
                        const removed = { ...duplicate, deletedAt: stamp(), revision: duplicate.revision + 1, updatedAt: stamp() };
                        put("orders", removed.id, removed);
                        audit("order", removed.id, actor, duplicate, removed);
                        result.deduplicated++;
                    }
                    addRaw(target.id, incoming.rawText);
                    // 成交与已有流水的订单保留原业务和财务快照，不因重发订单改变金额或成交状态。
                    if (isProtected(target)) { result.protected++; continue; }
                    if (target.rawText.trim() === incoming.rawText.trim() && target.state === "published") { result.unchanged++; continue; }
                    const patch = Object.fromEntries(parsedContentFields.map(key => [key, incoming[key]]));
                    const next = patchOrder(target, { ...patch, state: target.state === "delisted" ? "delisted" : "published" });
                    next.rawText = incoming.rawText;
                    next.rawSchedule = incoming.rawSchedule;
                    next.rawCompensation = incoming.rawCompensation;
                    next.parseConfidence = incoming.parseConfidence;
                    next.parseWarnings = incoming.parseWarnings;
                    next.parsedFields = incoming.parsedFields;
                    if (next.state === "published") next.publishedAt = stamp();
                    saveOrder(target, next, actor);
                    if (next.state === "published") batch.items.push({ orderId: next.id, pool: next.pool, district: next.district, isNew: false });
                    result.updated++;
                    continue;
                }
                const published = patchOrder(incoming, { state: "published" });
                put("orders", published.id, published);
                addRaw(published.id, published.rawText);
                audit("order", published.id, actor, {}, published);
                batch.items.push({ orderId: published.id, pool: published.pool, district: published.district, isNew: true });
                result.published++;
            }
            if (batch.items.length) put("batches", batch.id, batch);
            return result;
        }
        if (action === "parse") {
            const source = text(p.source, 80);
            const channel = must(settings().channels.find(c => c.id === source && c.active && !c.deletedAt), "请选择已启用的渠道");
            const raw = text(p.text, 200000);
            const parsed = parseOrders(raw, source as OrderSource);
            if (!parsed.length)
                throw new Error("没有识别到订单字段，请检查粘贴内容。");
            if (parsed.length > 100)
                throw new Error("每批最多100条");
            const rows = parsed.map(item => { const order = fromParsed(item, channel.id); put("orders", order.id, order); addRaw(order.id, item.rawText); audit("order", order.id, actor, {}, order); return { order, missing: [...new Set(item.parseWarnings)], parseConfidence: item.parseConfidence, parseWarnings: item.parseWarnings }; });
            return rows.map(row => ({ ...row, duplicates: duplicates(row.order) }));
        }
        if (action === "order.update") {
            const old = must(get<Order>("orders", text(p.id)));
            revision(old, p.revision);
            if (old.deletedAt) throw new Error("请先从回收站恢复订单再编辑");
            const patch = p.patch as Record<string, unknown>;
            if (old.state === "draft" && patch.state === "published")
                throw new Error("草稿请先校对与查重，再通过确认发布上架");
            return saveOrder(old, patchOrder(old, patch), actor);
        }
        if (action === "order.check") {
            const order = must(get<Order>("orders", text(p.id)));
            if (order.deletedAt || order.state !== "draft") throw new Error("此订单已发布或已删除，请刷新订单列表");
            return { order, duplicates: duplicates(order), missing: [
                !order.orderCode && "订单编号", !order.address && "地址", !order.grade && "年级",
                !order.subjects.length && "科目", !order.schedule && "时间",
                !order.duration && "单次时长缺失或有多种安排，请核对",
                !order.frequency && "每周次数未明确，请核对",
                order.frequency > 0 && order.frequency < 1 && "隔周上课，信息费规则需人工确认"
            ].filter(Boolean), parseWarnings: order.parseWarnings, parseConfidence: order.parseConfidence };
        }
        if (action === "order.publish") {
            if (!Array.isArray(p.items))
                throw new Error("无发布数据");
            const batch: Batch = { id: randomUUID(), createdAt: stamp(), items: [] };
            for (const item of p.items as {
                id: string;
                revision: number;
                choice: string;
                targetId?: string;
                targetRevision?: number;
            }[]) {
                let old = must(get<Order>("orders", item.id));
                revision(old, item.revision);
                if (old.deletedAt || old.state !== "draft") throw new Error("只能发布未删除的草稿，请刷新后重试");
                if (item.choice === "skip") {
                    const skipped = { ...old, deletedAt: stamp(), revision: old.revision + 1 };
                    put("orders", old.id, skipped);
                    audit("order", old.id, actor, old, skipped);
                    continue;
                }
                const matches = duplicates(old);
                if (matches.length && !['new', 'replace'].includes(item.choice))
                    throw new Error(`${old.orderCode} 存在重复，请确认处理方式`);
                let isNew = true;
                if (item.choice === "replace") {
                    const target = must(get<Order>("orders", item.targetId ?? ""), "请选择要覆盖的旧订单");
                    if (!matches.some(match => match.id === target.id)) throw new Error("覆盖目标不在当前重复订单中，请重新查重");
                    revision(target, item.targetRevision);
                    addRaw(target.id, old.rawText);
                    const businessKeys = ["businessState", "teacherName", "teacherSource", "lostReason", "refundReason", "refundAmount", "refundDate", "actualFee", "channelFeeOverride", "incomeOverride", "personalOverride", "trialRate", "feeMode", "lessonCount", "monthlySalary"];
                    const kept = Object.fromEntries(businessKeys.map(k => [k, (target as unknown as Record<string, unknown>)[k]]));
                    const updated = patchOrder(target, { ...old, ...kept, state: "published" });
                    updated.publishedAt = stamp();
                    saveOrder(target, updated, actor);
                    put("orders", old.id, { ...old, deletedAt: stamp(), revision: old.revision + 1 });
                    old = updated;
                    isNew = false;
                }
                else {
                    const next = patchOrder(old, { state: "published" });
                    next.publishedAt = stamp();
                    saveOrder(old, next, actor);
                    old = next;
                }
                batch.items.push({ orderId: old.id, pool: old.pool, district: old.district, isNew });
            }
            if (batch.items.length)
                put("batches", batch.id, batch);
            return batch;
        }
        if (["order.delete", "order.restore", "order.purge"].includes(action)) {
            const old = must(get<Order>("orders", text(p.id)));
            revision(old, p.revision);
            if (action === "order.purge") {
                if (s.role !== "admin")
                    throw new Error("仅超级管理员可永久删除");
                if (!old.deletedAt)
                    throw new Error("请先移入回收站");
                if (all<Deal>("deals").some(d => d.orderId === old.id) || all<Ledger>("ledger").some(l => l.orderId === old.id))
                    throw new Error("关联财务的订单保留在回收站，避免账目丢失");
                db().prepare("DELETE FROM orders WHERE id=?").run(old.id);
                audit("order", old.id, actor, old, { permanentlyDeleted: true });
                return { ok: true };
            }
            const next = { ...old, deletedAt: action === "order.delete" ? stamp() : undefined, revision: old.revision + 1 };
            put("orders", old.id, next);
            audit("order", old.id, actor, old, next);
            return next;
        }
        if (action === "ledger.add") {
            const order = must(get<Order>("orders", text(p.orderId)));
            const type = text(p.type, 30);
            if (!ledgerTypes.includes(type))
                throw new Error("流水类型不正确");
            const amount = cents(finite(p.amount, 0.01));
            const reason = text(p.reason ?? "", 3000), date = text(p.date, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()))
                throw new Error("日期不正确");
            if (type === "退款" && !reason)
                throw new Error("退款需填写原因");
            const entryId = text(p.id, 80);
            const existingEntry = get<Ledger>("ledger", entryId);
            if (existingEntry) {
                if (existingEntry.orderId !== order.id || existingEntry.type !== type || existingEntry.amount !== amount || existingEntry.date !== date || existingEntry.reason !== reason)
                    throw new Error("重复请求编号已用于其他流水");
                return existingEntry;
            }
            const rows = all<Ledger>("ledger").filter(l => l.orderId === order.id && !l.deletedAt);
            if (type === "退款") {
                const net = rows.reduce((v, l) => v + (["定金", "补款", "全款"].includes(l.type) ? l.amount : l.type === "退款" ? -l.amount : 0), 0);
                if (amount > net)
                    throw new Error("退款不能超过该订单尚未退还的实收金额");
            }
            const id = text(p.id, 80);
            if (get<Ledger>("ledger", id))
                return get<Ledger>("ledger", id);
            const entry: Ledger = { id, orderId: order.id, type, amount, date, reason, createdAt: stamp() };
            put("ledger", id, entry);
            audit("ledger", order.id, actor, {}, entry);
            return entry;
        }
        if (action === "ledger.void") {
            const old = must(get<Ledger>("ledger", text(p.id)));
            const next = { ...old, deletedAt: stamp() };
            const order = must(get<Order>("orders", old.orderId));
            const others = all<Ledger>("ledger").filter(x => x.orderId === order.id && x.id !== old.id && !x.deletedAt);
            const received = others.filter(x => ["定金", "补款", "全款"].includes(x.type)).reduce((a, x) => a + x.amount, 0), refunds = others.filter(x => x.type === "退款").reduce((a, x) => a + x.amount, 0);
            if (refunds > received || order.businessState === "已退费" && refunds < cents(order.refundAmount))
                throw new Error("作废后与退款状态冲突，请先调整状态或相关流水");
            put("ledger", old.id, next);
            audit("ledger", order.id, actor, old, next);
            return next;
        }
        if (action === "teacher.update") {
            const old = p.id ? must(get<Teacher>("teachers", text(p.id))) : undefined;
            if (old)
                revision(old, p.revision);
            return saveTeacher(p.patch as Record<string, unknown>, actor, old, true);
        }
        if (action === "teacher.delete" || action === "teacher.restore") {
            const old = must(get<Teacher>("teachers", text(p.id)));
            revision(old, p.revision);
            const next = { ...old, deletedAt: action.endsWith("delete") ? stamp() : undefined, revision: old.revision + 1 };
            put("teachers", old.id, next);
            audit("teacher", old.id, actor, old, next);
            return next;
        }
        if (action === "settings.save") {
            const config = p.settings as Settings;
            const old = settings();
            if ((config.revision ?? 1) !== (old.revision ?? 1))
                throw new Error("设置已被其他管理员更新，请刷新页面再修改");
            config.revision = (old.revision ?? 1) + 1;
            for (const c of config.channels) {
                text(c.id, 80);
                text(c.name, 100);
                text(c.pool, 100);
                finite(c.percentage, 0, 100);
                finite(c.ourPercentage, 0, 100);
                if (Math.abs(c.percentage + c.ourPercentage - 100) > 0.001)
                    throw new Error("渠道与我方分成之和必须为100%");
            }
            for (const r of config.rules) {
                finite(r.percentage, 0, 1000);
                if (!["weekly", "continuous", "shortTerm", "monthly", "online"].includes(r.mode))
                    throw new Error("规则类型不正确");
                finite(r.frequency, 0, 5);
            }
            for (const collection of [config.channels, config.rules, config.dictionaries])
                if (new Set(collection.map(x => x.id)).size !== collection.length)
                    throw new Error("配置编号重复");
            for (const c of old.channels)
                if (!config.channels.some(x => x.id === c.id))
                    throw new Error("渠道需移入回收站，不能直接移除");
            const keys = config.rules.filter(r => r.active && !r.deletedAt).map(r => `${r.mode}-${r.mode === "weekly" ? r.frequency : 0}`);
            if (new Set(keys).size !== keys.length)
                throw new Error("同一种信息费条件只能启用一条规则");
            put("settings", "main", config);
            audit("settings", "main", actor, old, config);
            return config;
        }
        if (action === "request.review") {
            const old = must(get<ParentRequest>("requests", text(p.id)));
            revision(old, p.revision);
            if (old.state !== "pending_review")
                throw new Error("该需求已处理");
            const approved = p.approve === true;
            let orderId = "";
            if (approved) {
                const f = old.fields;
                const raw = `【年级性别】${f["学员年级"]}${f["性别"]}\n【科目】${f["科目"]}\n【地址】${f["所在区域"]}\n【情况】${f["当前情况"]}\n【目标】${f["辅导目标"]}\n【时间】每周${f["每周次数"]}，每次${f["单次时长"]}，${f["可上课时间"]}\n【要求】${f["期望老师类型"]}，${f["老师性别要求"]}，${f["其他要求"]}\n【待遇】${f["预算"]}`;
                const order = fromParsed(parseOrders(raw, "owned")[0], "owned");
                orderId = order.id;
                put("orders", order.id, order);
                addRaw(order.id, JSON.stringify(f));
                audit("order", order.id, actor, {}, order);
            }
            const next = { ...old, state: approved ? "approved" : "rejected", orderId, revision: old.revision + 1 };
            put("requests", old.id, next);
            audit("request", old.id, actor, old, next);
            return next;
        }
        throw new Error("不支持的操作");
    });
}

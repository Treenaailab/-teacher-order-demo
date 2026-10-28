import type { TutorOrder } from "../orders";
export const businessStates = ["已发布", "定金（简历待审核）", "信息费已交（试课中）", "已成交", "未成交", "退费中", "已退费"] as const;
export const businessStatuses = ["待匹配", "待确认", "已派单", "成交", "关闭"] as const;
export const financeStatuses = ["未收款", "定金已收", "信息费已收", "部分收款", "已收款", "待渠道结算", "已结算", "退费中", "已退款"] as const;
export type BusinessStatus = typeof businessStatuses[number];
export type FinanceStatus = typeof financeStatuses[number];
export const profileStates = ["draft", "incomplete", "pending_review", "published", "hidden"] as const;
export const profileLabels: Record<string, string> = { draft: "草稿", incomplete: "待完善", pending_review: "待审核", published: "已公开", hidden: "已隐藏" };
export const ledgerTypes = ["定金", "补款", "全款", "退款", "渠道结算", "其他收入", "其他支出"];
export const grades = ["幼儿园", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三", "其他"];
export type Channel = {
    id: string;
    name: string;
    pool: string;
    percentage: number;
    ourPercentage: number;
    active: boolean;
    deletedAt?: string;
};
export type Dictionary = {
    id: string;
    kind: string;
    name: string;
    active: boolean;
    deletedAt?: string;
};
export function teacherTypeOptions(items: Dictionary[] = []) { return (items.length ? items : [{ id: "teacherType-0", kind: "teacherType", name: "大学生", active: true }, { id: "teacherType-1", kind: "teacherType", name: "专职老师", active: true }]).filter(x => x.kind === "teacherType" && x.active !== false && !x.deletedAt).map(x => ({ value: x.id === "teacherType-0" ? "college" : x.id === "teacherType-1" ? "professional" : x.id, label: x.name })); }
export type FeeRule = {
    id: string;
    name: string;
    mode: string;
    frequency: number;
    percentage: number;
    active: boolean;
    deletedAt?: string;
};
export type Settings = {
    revision?: number;
    feeRulesVersion?: number;
    channels: Channel[];
    dictionaries: Dictionary[];
    rules: FeeRule[];
};
export type Order = Omit<TutorOrder, "pool"> & {
    pool: string;
    sourceChannel: string;
    state: string;
    businessState: string;
    businessStatus: BusinessStatus;
    financeStatus: FinanceStatus;
    business_status?: BusinessStatus;
    finance_status?: FinanceStatus;
    validity: string;
    createdAt: string;
    updatedAt: string;
    revision: number;
    deletedAt?: string;
    rawText: string;
    rawCompensation: string;
    rawSchedule: string;
    goal: string;
    teacherGender: string;
    frequency: number;
    duration: number;
    timePeriods: string[];
    trialTime: string;
    collegeMin?: number;
    collegeMax?: number;
    professionalMin?: number;
    professionalMax?: number;
    teacherName: string;
    teacherSource: string;
    lostReason: string;
    refundReason: string;
    refundAmount: number;
    refundDate: string;
    trialRate: number;
    feeMode: string;
    lessonCount: number;
    monthlySalary: number;
    actualFee?: number;
    channelFeeOverride?: number;
    incomeOverride?: number;
    personalOverride?: number;
    customFields: Record<string, string>;
    schemaVersion?: number;
    parseConfidence?: number;
    parseWarnings?: string[];
    parsedFields?: Record<string, string>;
};
export type Deal = {
    id: string;
    orderId: string;
    createdAt: string;
    channelId: string;
    channelName: string;
    percentage: number;
    suggested: number;
    actual: number;
    channelFee: number;
    income: number;
    personal: number;
    formula: string;
    rule: FeeRule;
};
export type Ledger = {
    id: string;
    orderId: string;
    type: string;
    amount: number;
    date: string;
    reason: string;
    createdAt: string;
    deletedAt?: string;
};
export type Teacher = {
    id: string;
    name: string;
    gender: string;
    teacherType: string;
    school: string;
    major: string;
    currentGrade: string;
    education: string;
    teachingYears: string;
    certificate: string;
    currentlyTeaching: string;
    grades: string[];
    subjects: string[];
    experience: string;
    strengths: string;
    style: string;
    suitable: string;
    district: string;
    areas: string[];
    availableTime: string;
    minimumRate: number;
    certificates: string;
    intro: string;
    wechat: string;
    phone: string;
    source: string;
    notes: string;
    followup: string;
    state: string;
    verified: string[];
    createdAt: string;
    updatedAt: string;
    revision: number;
    deletedAt?: string;
};
export type PublicTeacher = Pick<Teacher, "id" | "gender" | "teacherType" | "school" | "major" | "currentGrade" | "education" | "teachingYears" | "grades" | "subjects" | "experience" | "strengths" | "style" | "suitable" | "availableTime" | "minimumRate" | "intro" | "verified"> & {
    displayName: string;
};
export type PublicOrder = TutorOrder & {
    completed: boolean;
    goal: string;
    teacherGender: string;
    collegeMin?: number;
    collegeMax?: number;
    professionalMin?: number;
    professionalMax?: number;
    timePeriods: string[];
    duration: number;
    publicPoolLabel: string;
};
export type ParentRequest = {
    id: string;
    state: string;
    createdAt: string;
    orderId?: string;
    fields: Record<string, string>;
    revision: number;
};
export type Batch = {
    id: string;
    createdAt: string;
    items: {
        orderId: string;
        pool: string;
        district: string;
        isNew: boolean;
    }[];
};
export type Audit = {
    id: string;
    entity: string;
    entityId: string;
    actor: string;
    at: string;
    changes: {
        field: string;
        before: unknown;
        after: unknown;
    }[];
};
export type LegacyRecord = {
    id: string;
    kind: string;
    original: Record<string, unknown>;
    linked?: string;
    createdAt: string;
};
export type AdminData = {
    orders: Order[];
    teachers: Teacher[];
    requests: ParentRequest[];
    deals: Deal[];
    ledger: Ledger[];
    batches: Batch[];
    legacy: LegacyRecord[];
    settings: Settings;
    role: string;
    name: string;
};
export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
export const money = (value: number) => `¥${(value / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function toBusinessStatus(value: unknown, legacy = ""): BusinessStatus {
    if (businessStatuses.includes(value as BusinessStatus)) return value as BusinessStatus;
    if (["已成交"].includes(legacy)) return "成交";
    if (["未成交", "退费中", "已退费"].includes(legacy)) return "关闭";
    if (["定金（简历待审核）"].includes(legacy)) return "待确认";
    if (["信息费已交（试课中）"].includes(legacy)) return "已派单";
    return "待匹配";
}
export function toLegacyBusinessState(value: BusinessStatus, fallback = "已发布"): typeof businessStates[number] {
    return ({ "待匹配": "已发布", "待确认": "定金（简历待审核）", "已派单": "信息费已交（试课中）", "成交": "已成交", "关闭": fallback === "退费中" || fallback === "已退费" ? fallback : "未成交" } as Record<BusinessStatus, typeof businessStates[number]>)[value];
}
export function chinaDay(value: string | number | Date = new Date()) { return new Date(new Date(value).getTime() + 8 * 3600e3).toISOString().slice(0, 10); }
export function within(value: string, start: string, end: string) { const day = chinaDay(value); return (!start || day >= start) && (!end || day <= end); }
export function gradeKey(value: string) { return value.replace(/[1-6１-６](?=年级)/g, x => "一二三四五六"[Number(x.normalize("NFKC")) - 1]).replace(/小学|女生|男生|学生|[男女]/g, "").trim(); }
export function gradeMatches(actual: string, wanted: string) { const key = gradeKey(actual); return key === wanted || (wanted.startsWith("初") && key === "初中") || (wanted.startsWith("高") && key === "高中") || (wanted.endsWith("年级") && key === "小学") || (wanted === "幼儿园" && /小班|中班|大班|幼儿/.test(key)); }
export function calculateDeal(order: Order, channel: Channel, rules: FeeRule[], previous?: Deal): Deal {
    if (order.feeMode !== "monthly" && (!(order.trialRate > 0) || !(order.duration > 0)))
        throw new Error("此订单和所有渠道共用同一套信息费标准。请先补全有效试课时薪和单次时长，再计算信息费。");
    if (["weekly", "online"].includes(order.feeMode) && (!Number.isInteger(order.frequency) || order.frequency < 1 || order.frequency > 21))
        throw new Error("请确认每周上课次数（1–21）；次数不确定时按区间上限计算，试课后再多退少补。");
    if (order.feeMode === "continuous" && ![10, 15, 20].includes(order.lessonCount))
        throw new Error("连续辅导次数请选择10、15或20次。");
    if (order.feeMode === "shortTerm" && (!Number.isInteger(order.lessonCount) || order.lessonCount < 1))
        throw new Error("请填写20天内预计授课总次数。");
    if (order.feeMode === "monthly" && !(order.monthlySalary > 0))
        throw new Error("请填写有效月薪。");
    const activeRules = rules.filter(r => r.active && !r.deletedAt);
    const offlineRule = order.feeMode === "online" ? activeRules.find(r => r.mode === "weekly" && r.frequency === Math.min(5, order.frequency)) : undefined;
    const rule = order.feeMode === "online" ? activeRules.find(r => r.mode === "online") : activeRules.find(r => r.mode === order.feeMode && (r.mode !== "weekly" || r.frequency === Math.min(5, order.frequency)));
    if (!rule || (order.feeMode === "online" && !offlineRule))
        throw new Error("共享信息费标准配置不完整，请在系统设置中检查全局规则；渠道分成比例单独设置。");
    const base = order.feeMode === "monthly" ? order.monthlySalary : order.trialRate * order.duration * (["continuous", "shortTerm"].includes(order.feeMode) ? order.lessonCount : order.frequency);
    // 成交订单未填写实际信息费，或旧表单把空值保存成 0 时，沿用建议金额。
    // 只有大于 0 的实际金额才作为人工覆盖值，避免出现“建议 660、实际 0”的假成交账。
    const feePercentage = order.feeMode === "online" ? offlineRule!.percentage * rule.percentage / 100 : rule.percentage;
    const suggested = cents(base * feePercentage / 100), actual = order.actualFee === undefined || order.actualFee <= 0 ? suggested : cents(order.actualFee);
    const percentage = previous?.channelId === channel.id ? previous.percentage : channel.percentage;
    const channelFee = order.channelFeeOverride === undefined ? Math.round(actual * percentage / 100) : cents(order.channelFeeOverride);
    const income = order.incomeOverride === undefined ? actual - channelFee : cents(order.incomeOverride), personal = order.personalOverride === undefined ? Math.round(income / 2) : cents(order.personalOverride);
    if ([actual, channelFee, income, personal].some(n => !Number.isFinite(n) || n < 0) || channelFee > actual)
        throw new Error("财务金额必须非负，渠道费不能超过实际信息费。");
    const formula = order.feeMode === "online" ? `${base.toFixed(2)} × ${offlineRule!.percentage}%（线下标准）× ${rule.percentage}%（线上系数）= ${(suggested / 100).toFixed(2)} 元` : `${base.toFixed(2)} × ${rule.percentage}% = ${(suggested / 100).toFixed(2)} 元（${rule.name}）`;
    return { id: previous?.id ?? order.id, orderId: order.id, createdAt: previous?.createdAt ?? new Date().toISOString(), channelId: channel.id, channelName: previous?.channelId === channel.id ? previous.channelName : channel.name, percentage, suggested, actual, channelFee, income, personal, rule, formula };
}
export function cashSummary(order: Order, deal: Deal | undefined, ledger: Ledger[]) {
    const rows = ledger.filter(t => t.orderId === order.id && !t.deletedAt), sum = (types: string[]) => rows.filter(t => types.includes(t.type)).reduce((a, t) => a + t.amount, 0);
    const received = sum(["定金", "补款", "全款"]), refunds = sum(["退款"]), settled = sum(["渠道结算"]), otherIncome = sum(["其他收入"]), otherExpense = sum(["其他支出"]);
    const receivable = Math.max(0, (deal?.actual ?? 0) - received), channelDue = Math.max(0, (deal?.channelFee ?? 0) - settled), netCash = received - refunds - settled + otherIncome - otherExpense;
    let status: FinanceStatus = "未收款";
    if (received > 0)
        status = rows.every(t => t.type === "定金") ? "定金已收" : "部分收款";
    if (deal && received >= deal.actual)
        status = channelDue > 0 ? "信息费已收" : "已结算";
    if (!deal && received > 0)
        status = "已收款";
    if (order.businessState === "信息费已交（试课中）" && received > 0 && !deal)
        status = "已收款";
    if (order.businessState === "退费中")
        status = "退费中";
    if (order.businessState === "已退费")
        status = "已退款";
    return { received, refunds, settled, receivable, channelDue, netCash, status, financeStatus: status };
}
export function publicCopy(o: PublicOrder) { return `【${o.publicPoolLabel}｜${o.orderCode}】\n地址：${o.address}\n学员：${o.grade}${o.gender && !o.grade.includes(o.gender) ? o.gender : ""}\n科目：${o.subjects.join(" / ")}\n情况：${o.situation}\n目标：${o.goal || "未注明"}\n时间：${o.schedule}\n要求：${o.requirement}\n待遇：${[o.collegeRate && `大学生 ${o.collegeRate}`, o.professionalRate && `专职 ${o.professionalRate}`, o.perClassRate].filter(Boolean).join("；") || "面议"}`; }

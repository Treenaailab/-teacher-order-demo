import type { PublicPool, TeacherType } from "./orders";
export type OrderSource = "jiang" | "yang" | "pengcheng" | "owned";
export type ParsedOrder = {
    orderCode: string;
    address: string;
    student: string;
    subject: string;
    situation: string;
    schedule: string;
    requirement: string;
    teacherType: TeacherType;
    weekdays: number[];
    collegeRate: string;
    professionalRate: string;
    classRate: string;
    pool: PublicPool;
    rawText: string;
    missing: string[];
    city: string;
    district: string;
    grade: string;
    gender: string;
    goal: string;
    teacherGender: string;
    frequency: number;
    duration: number;
    timePeriods: string[];
    trialTime: string;
    rawCompensation: string;
    rawSchedule: string;
    collegeMin?: number;
    collegeMax?: number;
    professionalMin?: number;
    professionalMax?: number;
    hourlyMin?: number;
    hourlyMax?: number;
    parseConfidence: number;
    parseWarnings: string[];
    parsedFields: Record<string, string>;
};
const pools: Record<OrderSource, PublicPool> = { jiang: "A", yang: "B", pengcheng: "C", owned: "owned" };
const aliases: Record<string, string[]> = { code: ["信息编号", "订单编号", "订单号", "编号"], address: ["上课地址", "上课地点", "联系地址", "辅导地点", "授课地点", "地址", "地点"], student: ["年级性别", "学员年级", "学员信息", "学生信息", "学员", "年级"], combined: ["年级科目", "年级/科目", "年级科目"], subject: ["补习科目", "辅导科目", "授课科目", "科目"], situation: ["基本情况", "学生情况", "学员情况", "学生状态", "学习情况", "情况"], goal: ["辅导目标", "学习目标", "辅导方向", "目标"], schedule: ["上课时间", "上课安排", "时间安排", "时间次数", "上课频率", "时间"], requirement: ["老师要求", "教师要求", "教员要求", "师资要求", "要求"], rate: ["工资待遇", "课费报酬", "老师报酬", "薪资待遇", "课费", "待遇", "报酬", "薪资"], trial: ["试课时间", "试课"] };
const labels = Object.values(aliases).flat().sort((a, b) => b.length - a.length);
const subjects = /语文|数学|英语|物理|化学|生物|历史|地理|政治|全科|科学|美术|音乐|编程|奥数/g;
const compactSubjectMap: Record<string, string[]> = { "数语化": ["数学", "语文", "化学"], "语数英": ["语文", "数学", "英语"], "数英": ["数学", "英语"], "物化生": ["物理", "化学", "生物"], "数理化": ["数学", "物理", "化学"], "语数化": ["语文", "数学", "化学"], "数语英": ["数学", "语文", "英语"], "政史地": ["政治", "历史", "地理"] };
function extractSubjects(text: string) {
    const compact = [...text.matchAll(/(?:数语化|语数英|数英|物化生|数理化|语数化|数语英|政史地)/g)].flatMap(match => compactSubjectMap[match[0]] ?? []);
    return [...new Set([...(text.replace(/研究生(?=物理)/g, "研究生 ").match(subjects) ?? []), ...compact])];
}
const numChars: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
export function chineseNumber(value: string): number { if (/^\d/.test(value))
    return Number(value); if (value.includes("点")) {
    const [a, b] = value.split("点");
    return chineseNumber(a) + Number("0." + [...b].map(c => numChars[c] ?? c).join(""));
} if (value.includes("十")) {
    const [a, b] = value.split("十");
    return (a ? numChars[a] : 1) * 10 + (b ? numChars[b] : 0);
} return numChars[value] ?? 0; }
function cleanLine(line: string) { return line.replace(/&#x20;/gi, " ").replace(/[\u200b\ufeff]/g, "").trim(); }
function isDecorativeLine(line: string) {
    const value = cleanLine(line).replace(/[\s\p{P}\p{S}]/gu, "");
    return !value || /^(?:爱心|發|🟥)+$/u.test(value);
}
function fieldHit(line: string) {
    const clean = cleanLine(line);
    for (const label of labels) {
        const index = clean.indexOf(label);
        if (index < 0 || /[\p{L}\p{N}]/u.test(clean.slice(0, index)))
            continue;
        const key = Object.keys(aliases).find(k => aliases[k].includes(label))!;
        const value = clean.slice(index + label.length).replace(/^[\s:：|｜丨,，;；】〗〕)）\]★→\-]+/u, "").trim();
        return { key, value };
    }
    return undefined;
}
function looksLikeCode(line: string) {
    if (fieldHit(line)?.key === "code") return true;
    const value = line.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "").trim();
    // 渠道编号格式不统一（如 GZyf26091901-1、GZ-DEMO-003）；只将独立短行识别为编号，避免地址或备注里的数字被误判。
    return /^(?:广州|东莞|佛山|深圳|中山|珠海)?(?:[A-Za-z][A-Za-z0-9_-]*\d{1,}(?:-\d+)?|\d{6,10}(?:-\d+)?)(?=$|[\s/（(【#])/iu.test(value);
}
function header(line: string) { return looksLikeCode(line) || /信息编号|订单编号|订单号/.test(line); }
function looksLikeAddress(line: string) { return /(?:区|县|镇|街|路|号|苑|园|城|湾|府|村|地铁|学校|图书馆|咖啡厅|广场|小区|附近)/.test(line) && !/(?:周|星期|小时|元|课费|待遇)/.test(line); }
function inferKey(line: string) {
    const value = cleanLine(line).replace(/^[\s\d.、)）#*•·]+/, "");
    if (!value || /\[爱心\]|\[發\]/.test(value) || looksLikeCode(value)) return "";
    if (looksLikeAddress(value)) return "address";
    if (/(?:元|￥|¥|薪|课费|待遇|报酬|\/h|每小时)/i.test(value) || /(?:大学生|专职)/.test(value) && /\d/.test(value)) return "rate";
    if (/(?:周|星期|每周|每次|小时|h\b|下午|上午|晚上|早上|晚\d)/i.test(value)) return "schedule";
    if (/(?:全科|语文|数学|英语|物理|化学|生物|历史|地理|政治|音乐|美术|编程|奥数)/.test(value)) return /(?:初|高|小学|年级|班)/.test(value) ? "student" : "subject";
    if (/(?:老师|教员|大学生|专职|一本|重点高校|985|211|经验|耐心|华师|认真负责)/.test(value)) return "requirement";
    if (/(?:初|高|小学|年级|男|女|学生)/.test(value)) return "student";
    return "situation";
}
function enrichUnlabelled(result: Record<string, string>, lines: string[]) {
    const text = lines.join(" ").replace(/\s+/g, " ").trim();
    const requirementHint = text.match(/(?:重点高校|985\s*[\/／]?\s*211|211\s*[\/／]?\s*985|一本(?:及以上)?|华师大|师范类)/);
    if (requirementHint) {
        result.requirement = [result.requirement, requirementHint[0]].filter(Boolean).join("；");
        if (result.schedule) result.schedule = result.schedule.replace(requirementHint[0], "").replace(/[，,、；;\s]+$/g, "").trim();
    }
    const gradeMatch = text.match(/(?:幼儿园|小学|[一二三四五六1-6１-６]年级|初[一二三]|高[一二三])[\s，,]*[男女]?/);
    if (!result.student && gradeMatch) result.student = gradeMatch[0];
    const subjectMatches = extractSubjects(text);
    if (!result.subject && subjectMatches.length) result.subject = subjectMatches.join(" / ");
    const rateMatches = [...text.matchAll(/(?:(?:大学生|专职|研究生)\s*)?\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+(?:\.\d+)?)?\s*(?:元\s*(?:\/\s*(?:小时|h)|一个?小时|每小时|小时)?|块\s*(?:\/\s*(?:小时|h)|一个?小时|每小时|小时)?|\/\s*(?:小时|h)|一个?小时|每小时)/gi)].map(m => m[0].trim());
    if (rateMatches.length && (!result.rate || result.rate.length > 40 || /(?:一周|每周|初[一二三]|高[一二三]|年级)/.test(result.rate))) result.rate = rateMatches.join("；");
    if (!result.schedule) {
        const start = text.search(/(?:一周|每周|\d+周|[一二三四五六七八九十]+周)/i);
        if (start >= 0) {
            const tail = text.slice(start), rateStart = tail.search(/(?:男女|女|男)?\s*\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+(?:\.\d+)?)?\s*(?:元|块|一个?小时|每小时|\/\s*(?:小时|h))/i);
            result.schedule = (rateStart >= 0 ? tail.slice(0, rateStart) : tail).trim().replace(/[，,、；;]+$/, "");
        }
    }
    const primary = lines.find(line => gradeMatch && line.includes(gradeMatch[0])) ?? "";
    if (!result.situation && primary) {
        let value = primary.replace(gradeMatch?.[0] ?? "", "");
        for (const subject of subjectMatches) value = value.replace(subject, "");
        value = value.split(/(?:一周|每周|\d+周|周[一二三四五六日末])/)[0].replace(/^[男女\s，,、:：]+|[\s，,、:：]+$/g, "");
        if (value && !/^(?:男|女)$/.test(value)) result.situation = value;
    }
    if (!result.requirement) {
        const requirement = text.match(/(?:男女|女老师|男老师|女大学生|男大学生|女(?=\s*(?:老师|\d))|男(?=\s*(?:老师|\d))|研究生|专职|一本|985|211|有经验|耐心)[^，,；;。]*?(?=(?:大学生|专职|研究生)?\s*\d+(?:\.\d+)?\s*(?:元|块|\/|一个?小时|每小时)|$)/i)?.[0];
        if (requirement && !/^(?:大学生|专职|研究生)\s*\d/.test(requirement)) result.requirement = requirement.trim();
    }
    if (!result.teacherGender) {
        if (/男女(?=\s*(?:老师|研究生|物理|专业|可|[，,；;、]|$))/.test(text)) result.teacherGender = "不限";
        else if (/(?:女老师|女大学生|辅导女|周末女|长期女|晚上女)/.test(text)) result.teacherGender = "女";
        else if (/(?:男老师|男大学生|辅导男|长期男|晚上男)/.test(text)) result.teacherGender = "男";
        else if (/(?:可|均可|辅导|晚上|周末|周[一二三四五六日天])([男女])(?=\s*\d)/.test(text)) result.teacherGender = text.match(/(?:可|均可|辅导|晚上|周末|周[一二三四五六日天])([男女])(?=\s*\d)/)?.[1] ?? "";
        else if (/(?:^|[，,；;\s])([男女])(?=\s*\d)/.test(text)) result.teacherGender = text.match(/(?:^|[，,；;\s])([男女])(?=\s*\d)/)?.[1] ?? "";
        else if (/([男女])(?=\s*\d+(?:元|块|\/|一个?小时|每小时))/.test(text)) result.teacherGender = text.match(/([男女])(?=\s*\d+(?:元|块|\/|一个?小时|每小时))/)?.[1] ?? "";
    }
    // 无标签长句以语义边界切片；带标签的字段保留显式填写值。
    const explicit = new Set(lines.map(fieldHit).filter(Boolean).map(hit => hit!.key));
    const body = lines.filter(line => !fieldHit(line) && !looksLikeCode(line) && line !== result.address).join("，");
    const timeIndex = body.search(/(?:每周|一周|\d+周|[二两三四]周)/);
    if (timeIndex >= 0) {
        const beforeTime = body.slice(0, timeIndex);
        const afterTime = body.slice(timeIndex);
        const compensation = afterTime.match(/(?:(?:大学生|专职|研究生)\s*)?\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+(?:\.\d+)?)?\s*(?:元|块|一个?小时|每小时|\/\s*(?:小时|h))/i);
        const beforeRate = compensation ? afterTime.slice(0, compensation.index) : afterTime;
        const requirementIndex = beforeRate.search(/男女|[男女](?:老师|大学生)?|985|211|一本|研究生|专职/);
        if (!explicit.has("schedule")) result.schedule = (requirementIndex >= 0 ? beforeRate.slice(0, requirementIndex) : beforeRate).replace(/[\s，,；;]+$/, "");
        if (!explicit.has("requirement") && requirementIndex >= 0) {
            result.requirement = beforeRate.slice(requirementIndex).replace(/[\s，,；;]+$/, "");
            if (compensation?.[0].startsWith("研究生")) result.requirement += "，研究生";
        }
        if (!explicit.has("situation")) {
            let situation = beforeTime.replace(gradeMatch?.[0] ?? "", "").replace(/^[\s，,]+/, "");
            // 只移除开头的科目，保留后面的英文授课、成绩和学习情况。
            situation = situation.replace(/^(?:(?:语文|数学|英语|物理|化学|生物|全科|政治|数语化|语数英|物化生)[\s/、，,]*)+/, "");
            result.situation = situation.replace(/^[\s，,]+|[\s，,]+$/g, "");
        }
    }
}
function fields(text: string) {
    const result: Record<string, string> = {}, lines = text.split(/\r?\n/).map(cleanLine).filter(line => !isDecorativeLine(line));
    let key = "";
    for (const line of lines) {
        const hit = fieldHit(line);
        if (hit) { key = hit.key; result[key] = hit.value; continue; }
        const inferred = inferKey(line);
        if (key && inferred && inferred !== key) key = "";
        if (key && !/\[爱心\]|\[發\]/.test(line)) result[key] = [result[key], line].filter(Boolean).join("\n");
    }
    // 没有标签时按内容推断字段；推断结果仍会进入人工校对草稿。
    for (const line of lines) {
        if (looksLikeCode(line)) { result.code ||= line; continue; }
        if (fieldHit(line) || /\[爱心\]|\[發\]/.test(line) || isDecorativeLine(line)) continue;
        const inferred = inferKey(line);
        if (inferred && !result[inferred]) result[inferred] = line.replace(/^[\s\d.、)）#*•·]+/, "");
    }
    enrichUnlabelled(result, lines);
    return result;
}
function blocks(text: string) {
    const lines = text.replace(/\r/g, "").replace(/&#x20;/gi, " ").split("\n");
    const result: string[] = [], current: string[] = [];
    const flush = () => { const value = current.join("\n").trim(); if (value && (Object.keys(fields(value)).length > 0 || header(value))) result.push(value); current.length = 0; };
    for (const line of lines) {
        if (header(line) && current.length && (Object.keys(fields(current.join("\n"))).length > 1 || header(current[0] ?? ""))) flush();
        current.push(line);
    }
    flush();
    // 无编号文本以空行分隔时也支持批量拆单。
    if (result.length <= 1 && /\n\s*\n/.test(text)) {
        const separated = text.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean).filter(x => Object.keys(fields(x)).length > 1);
        if (separated.length > 1) return separated;
    }
    return result;
}
export function parseWeekdays(text: string) { text = text.replace(/(?:每|一)?(?:周|星期)\s*[\d.一二两三四五六七八九十]+(?:\s*[-–—~～至]\s*[\d.一二两三四五六七八九十]+)?\s*次/g, ""); const names: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }; const days = new Set<number>(); if (/工作日|周内|周中/.test(text))
    [1, 2, 3, 4, 5].forEach(x => days.add(x)); if (/周末/.test(text))
    [6, 7].forEach(x => days.add(x)); for (const m of text.matchAll(/(?:周|星期)([一二三四五六日天])\s*(?:到|至|[-—–~～])\s*(?:周|星期)?([一二三四五六日天])/g)) {
    for (let d = names[m[1]], i = 0; i < 7; i++, d = d % 7 + 1) {
        days.add(d);
        if (d === names[m[2]])
            break;
    }
} for (const m of text.matchAll(/(?:周|星期)([一二三四五六日天](?:[、/和与]?[一二三四五六日天])*)/g)) {
    for (const c of m[1])
        if (names[c])
            days.add(names[c]);
} return [...days].sort(); }
export function parseSchedule(text: string) {
    const number = "(?:\\d+(?:\\.\\d+)?|[一二两三四五六七八九十点]+)";
    const f = text.match(new RegExp(`(?:每\\s*)?(${number})?(?:周|星期)\\s*(${number})(?:\\s*[-–—~～至]\\s*(${number}))?\\s*次`));
    // 一句中可能同时包含周内和周末两种时长，不能用第一个数替代全部安排。
    const durations = [...text.matchAll(new RegExp(`(${number})\\s*(?:个)?(半)?(?:小时|h)(?:\\s*(${number})分钟)?`, "gi"))]
        .map(m => chineseNumber(m[1]) + (m[2] ? 0.5 : 0) + (m[3] ? chineseNumber(m[3]) / 60 : 0));
    const distinctDurations = [...new Set(durations.filter(n => Number.isFinite(n) && n > 0))];
    const range = text.match(/(?:晚|晚上|下午|上午|早上)?\s*([上下]?\d{1,2}(?::|：)\d{2})\s*[-~至到]\s*([上下]?\d{1,2}(?::|：)\d{2})/);
    const parseClock = (value: string) => { const normalized = value.replace(/[上下]/g, "").replace("：", ":"); const [hour, minute = "0"] = normalized.split(":"); return Number(hour) + Number(minute) / 60; };
    const rangeDuration = range ? Math.max(0, parseClock(range[2]) - parseClock(range[1])) : 0;
    const duration = distinctDurations.length > 1 ? 0 : distinctDurations[0] ?? rangeDuration;
    const timePeriods = [/上午|早上|早晨/.test(text) && "上午", /下午/.test(text) && "下午", /晚|夜/.test(text) && "晚上"].filter(Boolean) as string[];
    // 区间按下限录入，供人工复核；避免系统自动按较高频次计算费用。
    return { frequency: f ? chineseNumber(f[2]) / (f[1] ? chineseNumber(f[1]) || 1 : 1) : 0, duration, weekdays: parseWeekdays(text), timePeriods };
}
export function hourlyRateBounds(...rates: string[]) { const values: number[] = []; for (const s of rates) {
    const m = s.match(/(\d+(?:\.\d+)?)(?:\s*[-–—~～至]\s*(\d+(?:\.\d+)?))?/);
    if (!m || /\/次|每次/.test(s))
        continue;
    const divisor = Number(s.match(/\/\s*(\d+(?:\.\d+)?)\s*(?:小时|h)/i)?.[1] ?? 1);
    if (divisor > 0) {
        values.push(Number(m[1]) / divisor);
        if (m[2])
            values.push(Number(m[2]) / divisor);
    }
} return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null; }
export function compensationBounds(text: string, duration: number) { const parsed = rate(text, duration); return parsed ? { min: parsed.min, max: parsed.max } : undefined; }
function rate(text: string, duration: number) { const m = text.match(/(\d+(?:\.\d+)?)(?:\s*[-–—~～至]\s*(\d+(?:\.\d+)?))?/); if (!m)
    return null; const session = /\/\s*(次|课)|每次|一次课/.test(text); const divisor = session ? duration : Number(text.match(/\/\s*(\d+(?:\.\d+)?)\s*(h|小时)/i)?.[1] ?? 1); const range = m[1] + (m[2] ? `-${m[2]}` : ""); return { display: `${range}元/${session ? "次" : divisor !== 1 ? `${divisor}小时` : "小时"}`, session: session || divisor !== 1, min: divisor > 0 ? Number(m[1]) / divisor : undefined, max: divisor > 0 ? Number(m[2] ?? m[1]) / divisor : undefined }; }
export function parseOrders(text: string, source: OrderSource): ParsedOrder[] {
    return blocks(text).map((block, index) => {
        const v = fields(block);
        const rawCompensation = v.rate ?? "", schedule = v.schedule ?? "", timing = parseSchedule(schedule);
        const situation = v.situation ?? "", requirement = v.requirement ?? "";
        const typeText = requirement + rawCompensation;
        const teacherType: TeacherType = /专职/.test(typeText) ? (/大学生/.test(typeText) ? "both" : "professional") : "college";
        const combined = v.combined ?? v.student ?? "";
        const subjectText = v.subject ?? combined;
        const subject = extractSubjects(subjectText).join(" / ") || v.subject || "";
        let grade = combined.match(/(?:[一二三四五六1-6１-６]年级|初[一二三]|高[一二三]|[小中大]班|幼儿园|小学|初中|高中)/)?.[0] ?? combined.replace(subjects, "").replace(/[，,\/、]|可分开带/g, "").trim();
        grade = grade.replace(/[1-6１-６](?=年级)/g, x => "一二三四五六"[Number(x.normalize("NFKC")) - 1]);
        const gender = (combined + " " + (v.situation ?? "")).match(/女|男/)?.[0] ?? "";
        const student = grade + gender;
        const teacherGender = /男女|性别不限|性别不限制/.test(requirement) ? "不限" : requirement.match(/([男女])(?:老师|大学生|专职|教员)/)?.[1] ?? (/^[男女]$/.test(requirement.trim()) ? requirement.trim() : v.teacherGender ?? "");
        let college = rawCompensation.match(/大学生([^]*?)(?=专职|$)/)?.[1], professional = rawCompensation.match(/专职(?:老师)?([^]*?)(?=大学生|$)/)?.[1];
        if (!college && !professional) {
            if (teacherType !== "professional")
                college = rawCompensation;
            if (teacherType !== "college")
                professional = rawCompensation;
        }
        const c = college ? rate(college, timing.duration) : null, p = professional ? rate(professional, timing.duration) : null, all = [c?.min, c?.max, p?.min, p?.max].filter(x => x !== undefined) as number[];
        const address = v.address ?? "";
        const city = v.code?.match(/广州|佛山|东莞|深圳|中山|珠海/)?.[0] ?? address.match(/广州|佛山|东莞|深圳|中山|珠海/)?.[0] ?? (block.match(/^(广州|佛山|东莞)/)?.[1] ?? "广州");
        const district = address.match(/天河区|海珠区|番禺区|越秀区|白云区|黄埔区|荔湾区|增城区|花都区|南沙区|从化区|金湾区|香洲区|斗门区/)?.[0] ?? (/佛山|东莞/.test(city) ? city : "其他");
        const codePattern = /(?:广州|东莞|佛山|深圳|中山|珠海)?(?:[A-Za-z][A-Za-z0-9_-]*\d{1,}(?:-\d+)?|\d{6,10}(?:-\d+)?)/i;
        const code = (v.code ?? block).match(codePattern)?.[0]?.trim() ?? (source === "owned" ? `OWNED-${Date.now()}-${index + 1}` : "");
        const missing = [!code && "订单编号", !address && "地址", !grade && "学员年级", !subject && "科目", !schedule && "时间", !rawCompensation && "待遇", !!rawCompensation && all.length === 0 && "待遇折算（需确认时长）"].filter(Boolean) as string[];
        const parseWarnings = [...missing];
        if (!timing.duration) parseWarnings.push("单次时长缺失或有多种安排，请核对");
        if (!timing.frequency) parseWarnings.push("每周次数未明确，请核对");
        if (/(?:每|一)?周\s*[\d一二三四五六]+\s*[-–—~～至]\s*[\d一二三四五六]+\s*次/.test(schedule)) parseWarnings.push("每周次数为区间，暂按下限计费，请人工核对；确认试课后可调整");
        if (timing.frequency > 0 && timing.frequency < 1) parseWarnings.push("隔周上课，已折算每周次数，信息费规则需人工确认");
        if (/(?:^|[，,\s])[1-7]\s*[-~至]\s*[1-7](?=晚|早|下午|上午)/.test(schedule)) parseWarnings.push("上课日期使用数字简写，请确认具体星期");
        if (!v.address && address) parseWarnings.push("地址由内容推断，请人工核对");
        if (!v.schedule && schedule) parseWarnings.push("时间由内容推断，请人工核对");
        if (!v.rate && rawCompensation) parseWarnings.push("待遇由内容推断，请人工核对");
        const required = [code, address, grade, subject, situation, schedule, requirement, rawCompensation].filter(Boolean).length;
        const parseConfidence = Math.max(0, Math.min(100, Math.round(required / 8 * 100) - parseWarnings.length * 5));
        return { orderCode: code, address, student, subject, situation: v.situation ?? "", schedule, requirement, teacherType, ...timing, collegeRate: c?.display ?? "", professionalRate: p?.display ?? "", classRate: (c?.session ? c.display : p?.session ? p.display : "") ?? "", collegeMin: c?.min, collegeMax: c?.max, professionalMin: p?.min, professionalMax: p?.max, hourlyMin: all.length ? Math.min(...all) : undefined, hourlyMax: all.length ? Math.max(...all) : undefined, pool: pools[source] ?? "owned", rawText: block, missing, parseWarnings, parseConfidence, parsedFields: v, city, district, grade, gender, goal: v.goal ?? "", teacherGender, trialTime: v.trial ?? "", rawCompensation, rawSchedule: schedule };
    });
}

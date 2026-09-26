import type { PublicPool, TeacherType } from "@/lib/orders";

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
};

const pools: Record<OrderSource, PublicPool> = { jiang: "A", yang: "B", pengcheng: "C", owned: "owned" };
const aliases: Record<string, string[]> = {
  address: ["上课地址", "地址", "辅导地点", "地点"],
  student: ["年级性别", "学员", "年级"],
  subject: ["补习科目", "科目"],
  situation: ["情况", "基本情况", "学生情况"],
  schedule: ["上课时间", "时间", "时间次数"],
  requirement: ["要求", "老师要求"],
  rate: ["工资待遇", "待遇", "课费", "课费报酬"],
};

function splitOrderBlocks(text: string, source: OrderSource) {
  const normalized = text.replace(/\r/g, "").replace(/&#x20;/gi, " ").trim();
  if (source === "pengcheng") {
    const blocks = normalized.split(/(?=\[爱心\].*?\d+\s*\[發\])/g).map((part) => part.trim()).filter(Boolean);
    return blocks.length ? blocks : [normalized];
  }
  const match = source === "yang" ? /(?=^[🪽\s]*[A-Za-z]{2,}[A-Za-z0-9_-]*\d{6,}(?:-\d+)?\s*$)/gm : /(?=^(?:广州|东莞|佛山|深圳|中山|珠海)?\s*\d{6,}(?:-\d+)?(?:\s|$))/gm;
  const blocks = normalized.split(match).map((part) => part.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  return normalized.split(/\n\s*\n(?=\S)/g).map((part) => part.trim()).filter(Boolean);
}

function findValue(block: string, names: string[]) {
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const clean = line.replace(/^[\s〖【\[（(🆔📚📍💰🗓️⏰🧑✨]+/, "");
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const found = clean.match(new RegExp(`^(?:${escaped})(?=$|[\\s:：｜|〗】\\]])(?:[〗】\\]）)]*)?\\s*[:：｜|]?\\s*(.*)$`));
      if (found) {
        let value = found[1].trim().replace(/[】〗\]）)]+$/g, "");
        if (!value && lines[i + 1]) value = lines[i + 1].trim().replace(/[】〗\]）)]+$/g, "");
        if (name === "年级科目" && value) return value;
        if (value) return value;
      }
    }
  }
  return "";
}

function codeFrom(block: string, source: OrderSource) {
  if (source === "pengcheng") return block.match(/信息编号\s*[｜|:]\s*([A-Z0-9-]+)/i)?.[1] ?? "";
  if (source === "yang") return block.match(/[A-Z]{2,}[A-Za-z0-9_-]*\d{6,}(?:-\d+)?/i)?.[0] ?? "";
  return block.match(/(?:广州|东莞|佛山|深圳|中山|珠海)?\s*(\d{6,}(?:-\d+)?)/)?.[0]?.trim() ?? "";
}

function detectType(block: string): TeacherType {
  const college = /大学生/.test(block);
  const professional = /专职/.test(block);
  if (college && professional) return "both";
  if (professional) return "professional";
  if (college) return "college";
  return "both";
}

function parseRates(block: string) {
  const lines = block.split("\n");
  const collegeLine = lines.find((line) => /大学生/.test(line) && /\d/.test(line)) ?? "";
  const professionalLine = lines.find((line) => /专职/.test(line) && /\d/.test(line)) ?? "";
  const feeLine = findValue(block, aliases.rate);
  const ratePattern = /([\d.]+\s*(?:[-—~～至]\s*[\d.]+)?\s*(?:元\s*)?(?:\/\s*(?:\d+(?:\.\d+)?\s*)?h|每\s*小时|小时|一小时|一个小时|\/\s*(?:\d+(?:\.\d+)?\s*)?小时|\/\s*(?:次|课)|每次|一次课))/i;
  const normalizedRate = (value: string): { rate: string; kind: "hour" | "class"; duration: number } | null => {
    const match = value.match(ratePattern)?.[1]?.replace(/\s+/g, "");
    if (!match) return null;
    const numbers = match.match(/[\d.]+(?:[-—~～至][\d.]+)?/)?.[0] ?? "";
    if (!numbers) return null;
    if (/\/\s*\d+(?:\.\d+)?\s*h|\/\s*\d+(?:\.\d+)?\s*小时/i.test(match)) {
      const duration = Number(match.match(/\/\s*(\d+(?:\.\d+)?)\s*(?:h|小时)/i)?.[1] ?? 1);
      return { rate: `${numbers}元/${duration}小时`, kind: "class" as const, duration };
    }
    if (/\/\s*(?:次|课)|每次|一次课/i.test(match)) return { rate: `${numbers}元/次`, kind: "class" as const, duration: 1 };
    return { rate: `${numbers}元/小时`, kind: "hour" as const, duration: 1 };
  };
  const rateAfterTeacherType = (type: "大学生" | "专职") => {
    for (const line of lines) {
      const start = line.lastIndexOf(type);
      if (start < 0) continue;
      let tail = line.slice(start + type.length);
      const otherTypeIndex = tail.search(type === "大学生" ? /专职/ : /大学生/);
      if (otherTypeIndex >= 0) tail = tail.slice(0, otherTypeIndex);
      const parsed = normalizedRate(tail);
      if (parsed) return parsed;
    }
    return null;
  };
  const college = rateAfterTeacherType("大学生") ?? normalizedRate(collegeLine);
  const professional = rateAfterTeacherType("专职") ?? normalizedRate(professionalLine);
  const fee = normalizedRate(feeLine);

  // Channels use different wage labels. Keep per-session fees separate; hourly
  // rates from an untyped channel apply to both teacher types until reviewed.
  let collegeRate = college?.kind === "hour" ? college.rate : "";
  let professionalRate = professional?.kind === "hour" ? professional.rate : "";
  let classRate = [college, professional, fee].find((rate) => rate?.kind === "class")?.rate ?? "";
  if (fee?.kind === "hour" && !collegeRate && !professionalRate) {
    const type = detectType(block);
    if (type === "college" || type === "both") collegeRate = fee.rate;
    if (type === "professional" || type === "both") professionalRate = fee.rate;
  }
  return { collegeRate, professionalRate, classRate };
}

/** Extract an hourly range for salary filters, converting fees such as 140-160元/2小时. */
export function hourlyRateBounds(...rates: string[]) {
  const values: number[] = [];
  for (const rate of rates.filter(Boolean)) {
    const match = rate.match(/([\d.]+)(?:\s*[-—~～至]\s*([\d.]+))?/);
    if (!match) continue;
    const duration = Number(rate.match(/\/\s*(\d+(?:\.\d+)?)\s*小时/i)?.[1] ?? 1);
    values.push(Number(match[1]) / duration);
    if (match[2]) values.push(Number(match[2]) / duration);
  }
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

function parseWeekdays(text: string) {
  const labels: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
  const found = new Set<number>();
  if (/周末/.test(text)) { found.add(6); found.add(7); }
  if (/周六日|周六、周日|周六和周日/.test(text)) { found.add(6); found.add(7); }
  const range = /(?:周|星期)([一二三四五六日天])\s*(?:至|到|—|–|-|~|～)\s*(?:周|星期)?([一二三四五六日天])/g;
  for (const match of text.matchAll(range)) {
    const start = labels[match[1]]; const end = labels[match[2]];
    for (let day = start; ; day = day % 7 + 1) { found.add(day); if (day === end) break; }
  }
  for (const match of text.matchAll(/(?:周|星期)([一二三四五六日天])/g)) found.add(labels[match[1]]);
  return [...found].sort((a, b) => a - b);
}

function parseBlock(block: string, source: OrderSource): ParsedOrder {
  let subject = findValue(block, aliases.subject);
  let student = findValue(block, aliases.student);
  const gradeSubject = findValue(block, ["年级科目"]);
  if (gradeSubject) {
    const subjectPattern = /(?:语文|数学|英语|物理|化学|生物|历史|地理|政治|全科)(?:\s*[\/、,，]\s*(?:语文|数学|英语|物理|化学|生物|历史|地理|政治|全科))*/;
    const hit = gradeSubject.match(subjectPattern);
    if (!subject && hit) subject = hit[0].replace(/\s/g, "");
    if (!student && hit) student = gradeSubject.slice(0, hit.index).trim();
  }
  if (!subject && student) {
    const subjectPattern = /(?:语文|数学|英语|物理|化学|生物|历史|地理|政治|全科)(?:\s*[\/、,，]\s*(?:语文|数学|英语|物理|化学|生物|历史|地理|政治|全科))*/;
    const hit = student.match(subjectPattern);
    if (hit) {
      subject = hit[0].replace(/\s/g, "");
      student = student.replace(hit[0], "").replace(/[，,、\s]+$/g, "").trim();
    }
  }
  const address = findValue(block, aliases.address);
  const situation = findValue(block, aliases.situation);
  if (!/[男女]/.test(student)) {
    const studentGender = situation.match(/女孩|女生|女学生|男孩|男生|男学生/)?.[0];
    if (studentGender) student += studentGender.startsWith("女") ? "女生" : "男生";
  }
  const schedule = findValue(block, aliases.schedule);
  const requirement = findValue(block, aliases.requirement);
  const rates = parseRates(block);
  const missing = [!codeFrom(block, source) && source !== "owned" && "订单编号", !address && "地址", !student && "学员/年级", !subject && "科目", !schedule && "时间", !rates.collegeRate && !rates.professionalRate && !rates.classRate && "待遇"].filter(Boolean) as string[];
  return { orderCode: codeFrom(block, source), address, student, subject, situation, schedule, requirement, teacherType: detectType(block), weekdays: parseWeekdays(schedule), ...rates, pool: pools[source], rawText: block, missing };
}

export function parseOrders(text: string, source: OrderSource) {
  return splitOrderBlocks(text, source).map((block, index) => {
    const order = parseBlock(block, source);
    return source === "owned" && !order.orderCode ? { ...order, orderCode: `OWNED-${Date.now()}-${index + 1}` } : order;
  });
}

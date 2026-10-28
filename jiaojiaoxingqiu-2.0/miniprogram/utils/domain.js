// 领域工具：与 src/lib/v1/domain.ts 保持一致的公开端逻辑
const GRADES = ["幼儿园", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三", "其他"];
const FW_DIGITS = { "０": "0", "１": "1", "２": "2", "３": "3", "４": "4", "５": "5", "６": "6", "７": "7", "８": "8", "９": "9" };
const GRADE_CN = "一二三四五六";
const TIME_OPTIONS = ["工作日", "周末", "周一", "周二", "周三", "周四", "周五", "周六", "周日", "上午", "下午", "晚上"];
const DATE_OPTIONS = ["", "今天", "昨天", "近3天", "近7天"];

function chinaDay(value) {
  const t = value === undefined ? Date.now() : (typeof value === "number" ? value : new Date(value).getTime());
  return new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

// 日期标签：刚刚 / n分钟前 / n小时前 / M月D日
function dateLabel(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + "分钟前";
  if (chinaDay(value) === chinaDay()) return Math.floor(minutes / 60) + "小时前";
  const d = new Date(new Date(value).getTime() + 8 * 3600e3);
  return (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日";
}

function poolLabel(p) {
  if (p === "owned") return "高性价比急出单";
  if (/^[ABC]$/.test(p)) return p + "池";
  return p;
}

// 待遇文案：大学生 / 专职 / 单次
function compensation(order) {
  const parts = [];
  if (order.collegeRate) parts.push("大学生 " + order.collegeRate);
  if (order.professionalRate) parts.push("专职 " + order.professionalRate);
  if (!order.collegeRate && !order.professionalRate && order.perClassRate) parts.push(order.perClassRate);
  return parts.join("；") || "待遇待确认";
}

// 复制用的完整公开文案，与 publicCopy 一致
function publicCopy(o) {
  const gender = o.gender && o.grade.indexOf(o.gender) === -1 ? o.gender : "";
  const rate = [
    o.collegeRate && "大学生 " + o.collegeRate,
    o.professionalRate && "专职 " + o.professionalRate,
    o.perClassRate
  ].filter(Boolean).join("；") || "面议";
  return [
    "【" + o.publicPoolLabel + "｜" + o.orderCode + "】",
    "地址：" + o.address,
    "学员：" + o.grade + gender,
    "科目：" + o.subjects.join(" / "),
    "情况：" + o.situation,
    "目标：" + (o.goal || "未注明"),
    "时间：" + o.schedule,
    "要求：" + o.requirement,
    "待遇：" + rate
  ].join("\n");
}

function gradeKey(value) {
  let s = String(value).replace(/[０-９]/g, ch => FW_DIGITS[ch] || ch);
  s = s.replace(/([1-6])(?=年级)/g, d => GRADE_CN[Number(d) - 1]);
  s = s.replace(/小学|女生|男生|学生|[男女]/g, "");
  return s.trim();
}

function gradeMatches(actual, wanted) {
  const key = gradeKey(actual);
  if (key === wanted) return true;
  if (wanted.indexOf("初") === 0 && key === "初中") return true;
  if (wanted.indexOf("高") === 0 && key === "高中") return true;
  if (wanted.slice(-2) === "年级" && key === "小学") return true;
  if (wanted === "幼儿园" && /小班|中班|大班|幼儿/.test(key)) return true;
  return false;
}

// 老师类型选项：无字典时回退到默认两项
function teacherTypeOptions(dictionaries) {
  let items = dictionaries && dictionaries.length
    ? dictionaries.filter(d => d.kind === "teacherType" && d.active !== false && !d.deletedAt)
    : [{ id: "teacherType-0", name: "大学生" }, { id: "teacherType-1", name: "专职老师" }];
  return items.map(d => ({
    value: d.id === "teacherType-0" ? "college" : d.id === "teacherType-1" ? "professional" : d.id,
    label: d.name
  }));
}

module.exports = {
  GRADES, TIME_OPTIONS, DATE_OPTIONS,
  chinaDay, dateLabel, poolLabel, compensation, publicCopy,
  gradeKey, gradeMatches, teacherTypeOptions
};

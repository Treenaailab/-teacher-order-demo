// 组合筛选：与 src/lib/v1/filters.ts 的 filterOrders 保持一致
const { chinaDay, gradeMatches } = require("./domain.js");

const EMPTY_FILTERS = {
  query: "",
  pools: [],
  districts: [],
  subjects: [],
  grades: [],
  type: "",
  min: "",
  max: "",
  times: [],
  date: ""
};

function makeEmptyFilters() {
  return {
    query: "", pools: [], districts: [], subjects: [], grades: [],
    type: "", min: "", max: "", times: [], date: ""
  };
}

function filterOrders(orders, f, now) {
  const nowMs = now === undefined ? Date.now() : now;
  const today = chinaDay(nowMs);
  const days = n => chinaDay(nowMs - n * 86400e3);
  const KNOWN_DISTRICTS = /天河|海珠|番禺|越秀|白云|黄埔|荔湾|增城|花都|佛山|东莞/;
  return orders.filter(o => {
    if (f.query) {
      const hay = (o.orderCode + " " + o.address + " " + o.grade + " " + o.subjects.join() + " " + o.situation + " " + o.requirement).toLowerCase();
      if (hay.indexOf(f.query.trim().toLowerCase()) === -1) return false;
    }
    if (f.pools.length && f.pools.indexOf(o.pool) === -1) return false;
    if (f.districts.length) {
      const ok = f.districts.some(x => x === o.district || (x === "其他" && !KNOWN_DISTRICTS.test(o.district)));
      if (!ok) return false;
    }
    if (f.subjects.length && !f.subjects.some(x => o.subjects.indexOf(x) !== -1)) return false;
    if (f.grades.length && !f.grades.some(x => gradeMatches(o.grade, x))) return false;
    if (f.type && o.teacherType !== f.type && o.teacherType !== "both") return false;
    const low = f.type === "college" ? o.collegeMin : f.type === "professional" ? o.professionalMin : o.hourlyMin;
    const high = f.type === "college" ? o.collegeMax : f.type === "professional" ? o.professionalMax : o.hourlyMax;
    if (f.min && (high === undefined || high === null || high < Number(f.min))) return false;
    if (f.max && (low === undefined || low === null || low > Number(f.max))) return false;
    if (f.times.length) {
      const ok = f.times.some(t => {
        if (t === "工作日") return o.weekdays.some(d => d <= 5);
        if (t === "周末") return o.weekdays.some(d => d >= 6);
        if (t.indexOf("周") === 0) return o.weekdays.indexOf("一二三四五六日".indexOf(t[1]) + 1) !== -1;
        return (o.timePeriods || []).indexOf(t) !== -1;
      });
      if (!ok) return false;
    }
    const day = chinaDay(o.publishedAt);
    if (f.date === "今天" && day !== today) return false;
    if (f.date === "昨天" && day !== days(1)) return false;
    if (f.date === "近3天" && (day < days(2) || day > today)) return false;
    if (f.date === "近7天" && (day < days(6) || day > today)) return false;
    return true;
  });
}

module.exports = { EMPTY_FILTERS, makeEmptyFilters, filterOrders };

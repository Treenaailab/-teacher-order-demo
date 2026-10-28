import { chinaDay, gradeMatches, type PublicOrder } from "./domain";
export type Filters = {
    query: string;
    pools: string[];
    districts: string[];
    subjects: string[];
    grades: string[];
    type: string;
    min: string;
    max: string;
    times: string[];
    date: string;
};
export const emptyFilters: Filters = { query: "", pools: [], districts: [], subjects: [], grades: [], type: "", min: "", max: "", times: [], date: "" };
export function filterOrders(orders: PublicOrder[], f: Filters, now = new Date()) {
    const today = chinaDay(now);
    const days = (n: number) => chinaDay(now.getTime() - n * 86400e3);
    return orders.filter(o => {
        if (f.query && !`${o.orderCode} ${o.address} ${o.grade} ${o.subjects.join()} ${o.situation} ${o.requirement}`.toLowerCase().includes(f.query.trim().toLowerCase()))
            return false;
        if (f.pools.length && !f.pools.includes(o.pool))
            return false;
        if (f.districts.length && !f.districts.some(x => x === o.district || (x === "其他" && !/天河|海珠|番禺|越秀|白云|黄埔|荔湾|增城|花都|佛山|东莞/.test(o.district))))
            return false;
        if (f.subjects.length && !f.subjects.some(x => o.subjects.includes(x)))
            return false;
        if (f.grades.length && !f.grades.some(x => gradeMatches(o.grade, x)))
            return false;
        if (f.type && o.teacherType !== f.type && o.teacherType !== "both")
            return false;
        const low = f.type === "college" ? o.collegeMin : f.type === "professional" ? o.professionalMin : o.hourlyMin, high = f.type === "college" ? o.collegeMax : f.type === "professional" ? o.professionalMax : o.hourlyMax;
        if (f.min && (high === undefined || high < Number(f.min)))
            return false;
        if (f.max && (low === undefined || low > Number(f.max)))
            return false;
        if (f.times.length && !f.times.some(t => t === "工作日" ? o.weekdays.some(d => d <= 5) : t === "周末" ? o.weekdays.some(d => d >= 6) : t.startsWith("周") ? o.weekdays.includes("一二三四五六日".indexOf(t[1]) + 1) : o.timePeriods.includes(t)))
            return false;
        const day = chinaDay(o.publishedAt);
        if (f.date === "今天" && day !== today)
            return false;
        if (f.date === "昨天" && day !== days(1))
            return false;
        if (f.date === "近3天" && (day < days(2) || day > today))
            return false;
        if (f.date === "近7天" && (day < days(6) || day > today))
            return false;
        return true;
    });
}

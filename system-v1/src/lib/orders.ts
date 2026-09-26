export type PublicPool = "A" | "B" | "C" | "owned";
export type TeacherType = "college" | "professional" | "both";

export type TutorOrder = {
  id: string;
  orderCode: string;
  city: string;
  district: string;
  address: string;
  grade: string;
  gender: string;
  subjects: string[];
  situation: string;
  schedule: string;
  weekdays: number[];
  requirement: string;
  teacherType: TeacherType;
  collegeRate?: string;
  professionalRate?: string;
  perClassRate?: string;
  hourlyMin?: number;
  hourlyMax?: number;
  pool: PublicPool;
  publishedAt: string;
};

// Synthetic, non-identifying fixtures for local and public product review.
export const sampleOrders: TutorOrder[] = [
  {
    id: "demo-a-001",
    orderCode: "DEMO-A-001",
    city: "广州",
    district: "天河区",
    address: "天河区（演示区域）",
    grade: "初二女生",
    gender: "女",
    subjects: ["全科"],
    situation: "需要巩固基础、辅导作业并培养学习习惯。",
    schedule: "一周2次；工作日晚上，每次2小时",
    weekdays: [1, 2, 3, 4, 5],
    requirement: "女大学生，有耐心，沟通清晰，认真负责。",
    teacherType: "college",
    collegeRate: "90元/小时",
    hourlyMin: 90,
    hourlyMax: 90,
    pool: "A",
    publishedAt: "2026-09-26T08:30:00+08:00",
  },
  {
    id: "demo-b-001",
    orderCode: "DEMO-B-001",
    city: "广州",
    district: "越秀区",
    address: "越秀区（演示区域）",
    grade: "一年级",
    gender: "未注明",
    subjects: ["英语"],
    situation: "希望提升英语阅读和口语表达。",
    schedule: "一周2次；周末下午，每次1小时",
    weekdays: [1, 2, 3, 4],
    requirement: "大学生或专职老师，英语基础扎实，有耐心。",
    teacherType: "college",
    perClassRate: "140–160元/2小时",
    hourlyMin: 70,
    hourlyMax: 80,
    pool: "B",
    publishedAt: "2026-09-26T07:50:00+08:00",
  },
  {
    id: "demo-c-001",
    orderCode: "DEMO-C-001",
    city: "广州",
    district: "越秀区",
    address: "越秀区（演示区域）",
    grade: "高一女生",
    gender: "女",
    subjects: ["数学"],
    situation: "希望巩固数学基础并提升解题方法。",
    schedule: "每周六，每次2小时",
    weekdays: [6],
    requirement: "老师性别不限，有经验，善于沟通。",
    teacherType: "both",
    collegeRate: "120–140元/小时",
    professionalRate: "120–140元/小时",
    hourlyMin: 120,
    hourlyMax: 140,
    pool: "C",
    publishedAt: "2026-09-25T18:10:00+08:00",
  },
  {
    id: "demo-a-002", orderCode: "DEMO-A-002", city: "广州", district: "增城区", address: "增城区（演示区域）", grade: "初三学生", gender: "未注明", subjects: ["数学"], situation: "需要梳理重点知识并查漏补缺。", schedule: "每周1–2次；周末，每次2小时", weekdays: [6, 7], requirement: "大学生，数学基础扎实，认真负责。", teacherType: "college", collegeRate: "120元/小时", hourlyMin: 120, hourlyMax: 120, pool: "A", publishedAt: "2026-09-26T06:40:00+08:00",
  },
  {
    id: "demo-a-003", orderCode: "DEMO-A-003", city: "广州", district: "越秀区", address: "越秀区（演示区域）", grade: "初一学生", gender: "未注明", subjects: ["数学", "英语"], situation: "需要巩固基础和提升解题能力。", schedule: "一周2次；工作日晚上", weekdays: [3, 5], requirement: "大学生，表达清楚，有责任心。", teacherType: "college", collegeRate: "100元/小时", hourlyMin: 100, hourlyMax: 100, pool: "A", publishedAt: "2026-09-25T16:00:00+08:00",
  },
  {
    id: "demo-a-004", orderCode: "DEMO-A-004", city: "广州", district: "海珠区", address: "海珠区（演示区域）", grade: "六年级学生", gender: "未注明", subjects: ["英语", "语文", "数学"], situation: "综合辅导作业，巩固小升初基础。", schedule: "一周2次；工作日晚上", weekdays: [1, 3], requirement: "男女不限，相关科目熟悉，耐心负责。", teacherType: "college", collegeRate: "80元/小时", hourlyMin: 80, hourlyMax: 80, pool: "A", publishedAt: "2026-09-25T13:30:00+08:00",
  },
  {
    id: "demo-a-005", orderCode: "DEMO-A-005", city: "广州", district: "番禺区", address: "番禺区（演示区域）", grade: "三年级学生", gender: "未注明", subjects: ["英语"], situation: "英语入门学习。", schedule: "一周一次；周末，每次1小时", weekdays: [6, 7], requirement: "大学生，英语基础好，有耐心。", teacherType: "college", collegeRate: "60元/小时", hourlyMin: 60, hourlyMax: 60, pool: "A", publishedAt: "2026-09-25T11:20:00+08:00",
  },
  {
    id: "demo-a-006", orderCode: "DEMO-A-006", city: "广州", district: "花都区", address: "花都区（演示区域）", grade: "四年级学生", gender: "未注明", subjects: ["全科"], situation: "查漏补缺和作业辅导。", schedule: "一周3次；工作日傍晚", weekdays: [1, 3, 5], requirement: "大学生，认真负责，有耐心。", teacherType: "college", collegeRate: "80元/小时", hourlyMin: 80, hourlyMax: 80, pool: "A", publishedAt: "2026-09-24T17:00:00+08:00",
  },
  {
    id: "demo-c-002", orderCode: "DEMO-C-002", city: "广州", district: "黄埔区", address: "黄埔区（演示区域）", grade: "高三学生", gender: "未注明", subjects: ["数学", "物理"], situation: "巩固数学和物理基础，提升解题方法。", schedule: "一周2次；工作日晚上", weekdays: [1, 3], requirement: "大学生或专职老师，讲解有条理，擅长基础辅导。", teacherType: "both", collegeRate: "120–150元/小时", professionalRate: "120–150元/小时", hourlyMin: 120, hourlyMax: 150, pool: "C", publishedAt: "2026-09-24T09:30:00+08:00",
  },
  {
    id: "demo-c-003", orderCode: "DEMO-C-003", city: "广州", district: "荔湾区", address: "荔湾区（演示区域）", grade: "高二学生", gender: "未注明", subjects: ["化学"], situation: "复习重点知识并提升化学解题能力。", schedule: "一周一次；周末，每次2小时", weekdays: [6, 7], requirement: "大学生或专职老师，化学基础扎实，有经验。", teacherType: "both", collegeRate: "140元/小时", professionalRate: "140元/小时", hourlyMin: 140, hourlyMax: 140, pool: "C", publishedAt: "2026-09-23T18:00:00+08:00",
  },
  {
    id: "demo-owned-001", orderCode: "DEMO-OWNED-001", city: "广州", district: "天河区", address: "天河区（演示区域）", grade: "初二女生", gender: "女", subjects: ["英语"], situation: "希望加强英语阅读与表达，查漏补缺。", schedule: "每周2次；周末下午，每次1.5小时", weekdays: [6, 7], requirement: "大学生或专职老师，英语基础扎实，善于沟通。", teacherType: "both", collegeRate: "150元/小时", professionalRate: "180元/小时", hourlyMin: 150, hourlyMax: 180, pool: "owned", publishedAt: "2026-09-26T09:00:00+08:00",
  },
  {
    id: "demo-b-002", orderCode: "DEMO-B-002", city: "广州", district: "白云区", address: "白云区（演示区域）", grade: "五年级学生", gender: "未注明", subjects: ["语文"], situation: "提升阅读理解和作文表达。", schedule: "每周1次；周六上午，每次2小时", weekdays: [6], requirement: "大学生或专职老师，语文功底扎实。", teacherType: "both", collegeRate: "100元/小时", professionalRate: "160元/小时", hourlyMin: 100, hourlyMax: 160, pool: "B", publishedAt: "2026-09-26T08:40:00+08:00",
  },
  {
    id: "demo-c-004", orderCode: "DEMO-C-004", city: "广州", district: "海珠区", address: "海珠区（演示区域）", grade: "高一学生", gender: "未注明", subjects: ["物理"], situation: "梳理力学知识，提升解题步骤。", schedule: "每周2次；周三、周日晚上", weekdays: [3,7], requirement: "有高中物理教学经验，讲解清晰。", teacherType: "professional", professionalRate: "200元/小时", hourlyMin: 200, hourlyMax: 200, pool: "C", publishedAt: "2026-09-26T08:10:00+08:00",
  },
];

export const poolLabel: Record<PublicPool, string> = {
  A: "A 池",
  B: "B 池",
  C: "C 池",
  owned: "高性价比急出单",
};

export const teacherTypeLabel: Record<TeacherType, string> = {
  college: "大学生",
  professional: "专职老师",
  both: "大学生 / 专职均可",
};

export function orderMatchesQuery(order: TutorOrder, query: string) {
  const text = [order.orderCode, order.city, order.district, order.address, order.grade,
    order.subjects.join(" "), order.situation, order.schedule, order.requirement].join(" ").toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

export function copyOrderText(order: TutorOrder) {
  const rate = [
    order.collegeRate ? `大学生：${order.collegeRate}` : "",
    order.professionalRate ? `专职：${order.professionalRate}` : "",
    order.perClassRate ? `课费：${order.perClassRate}` : "",
  ].filter(Boolean).join("；") || "详询";
  return `【${poolLabel[order.pool]}｜${order.orderCode}】\n地址：${order.address}\n学员：${order.grade}\n科目：${order.subjects.join("、")}\n情况：${order.situation}\n时间：${order.schedule}\n要求：${order.requirement}\n待遇：${rate}`;
}

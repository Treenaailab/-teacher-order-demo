import { sampleOrders, type PublicPool, type TutorOrder } from "@/lib/orders";

export type DemoOrder = TutorOrder & {
  sourceChannel: "jiang" | "yang" | "pengcheng" | "owned";
  state: "draft" | "published" | "delisted" | "placed" | "invalid";
  validity: "unverified" | "confirmed" | "unavailable";
  createdAt: string;
};

export type DemoTeacher = { id: string; display_name: string; school: string | null; preferred_districts: string[]; created_at: string };
const ordersKey = "tutor-order-demo-v1";
const sourceByPool: Record<PublicPool, DemoOrder["sourceChannel"]> = { A: "jiang", B: "yang", C: "pengcheng", owned: "owned" };

export const initialDemoOrders: DemoOrder[] = sampleOrders.map((order) => ({
  ...order,
  sourceChannel: sourceByPool[order.pool],
  state: "published",
  validity: "unverified",
  createdAt: order.publishedAt,
}));

export const demoTeachers: DemoTeacher[] = [
  { id: "demo-teacher-1", display_name: "演示老师甲", school: "演示高校", preferred_districts: ["天河区", "越秀区"], created_at: "2026-09-24T09:00:00+08:00" },
  { id: "demo-teacher-2", display_name: "演示老师乙", school: "演示高校", preferred_districts: ["番禺区", "海珠区"], created_at: "2026-09-23T15:20:00+08:00" },
  { id: "demo-teacher-3", display_name: "演示老师丙", school: null, preferred_districts: ["越秀区"], created_at: "2026-09-21T11:30:00+08:00" },
  { id: "demo-teacher-4", display_name: "演示老师丁", school: "演示高校", preferred_districts: ["天河区", "黄埔区"], created_at: "2026-09-18T17:10:00+08:00" },
];

export function readDemoOrders(): DemoOrder[] {
  if (typeof window === "undefined") return initialDemoOrders;
  try {
    const saved = window.localStorage.getItem(ordersKey);
    return saved ? JSON.parse(saved) as DemoOrder[] : initialDemoOrders;
  } catch {
    return initialDemoOrders;
  }
}

export function writeDemoOrders(orders: DemoOrder[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(ordersKey, JSON.stringify(orders));
}

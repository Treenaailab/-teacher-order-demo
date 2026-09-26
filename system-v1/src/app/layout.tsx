import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家教星球｜找到合适的家教机会",
  description: "家教星球家教订单浏览与内部运营管理系统",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

import { NextResponse } from "next/server";

const demoAccounts = [
  {
    username: process.env.TUTOR_ADMIN_USERNAME ?? "",
    password: process.env.TUTOR_ADMIN_PASSWORD ?? "",
    role: "operator",
    displayName: "普通管理员",
  },
  {
    username: process.env.TUTOR_SUPERADMIN_USERNAME ?? "",
    password: process.env.TUTOR_SUPERADMIN_PASSWORD ?? "",
    role: "admin",
    displayName: "超级管理员",
  },
];

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写账号和密码。" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;
  const account = demoAccounts.find((item) => item.username === username && item.password === password);
  if (!account) return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });

  return NextResponse.json({ role: account.role, displayName: account.displayName });
}

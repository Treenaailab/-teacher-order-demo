"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "./admin";
import { Alert, Field, api } from "./shared";

type PublishResult = {
  total: number;
  unique: number;
  published: number;
  updated: number;
  unchanged: number;
  protected: number;
  deduplicated: number;
  skipped: { code: string; reason: string }[];
};

export default function FastIntake() {
  const { data, reload } = useAdmin();
  const channels = data.settings.channels.filter(channel => channel.active && !channel.deletedAt);
  const [source, setSource] = useState(channels[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);

  async function publish() {
    if (!source || !raw.trim()) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const next = await api<PublishResult>("parse.publish", { source, text: raw });
      setResult(next);
      await reload();
      if (next.published || next.updated || next.unchanged || next.protected) setRaw("");
      setMessage(next.published || next.updated ? "解析完成，订单已直接同步到老师端。" : "解析完成，没有需要新增上架的订单。");
    } catch (error) {
      setMessage(error instanceof TypeError ? "连接本地服务失败。请确认服务正在运行，再重试；原文仍保留在输入框中。" : (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="v-intake">
    <h1>快速录单</h1>
    <p className="v-subtitle">选择来源并粘贴订单，点击一次即可解析并上架。</p>
    <section className="v-panel">
      <h2>订单来自哪个渠道？</h2>
      <div className="v-source-grid">{channels.map(channel => <button key={channel.id} className={source === channel.id ? "selected" : ""} onClick={() => setSource(channel.id)}><b>{channel.name}</b><small>对外展示：{channel.pool === "owned" ? "高性价比急出单" : /^[ABC]$/.test(channel.pool) ? `${channel.pool}池` : channel.pool}</small></button>)}</div>
      <div className="v-raw-input"><Field label="订单原文（支持批量）" type="textarea" wide value={raw} onChange={setRaw}/></div>
      <div className="v-row" style={{ marginTop: 14 }}><button className="v-primary" disabled={busy || !source || !raw.trim()} onClick={() => void publish()}>{busy ? "正在解析和上架…" : "解析并直接上架"}</button></div>
      <p className="v-note">同编号订单只保留最新内容；已成交或有财务记录的订单保留原业务数据。缺少编号、地址、年级、科目或时间的内容会列在下方，不会生成公开订单。</p>
    </section>
    <Alert>{message}</Alert>
    {result && <section className="v-panel" role="status"><h2>本次处理结果</h2><p>识别 {result.total} 条，新增上架 {result.published} 条，更新已有 {result.updated} 条，内容未变 {result.unchanged} 条，成交或有财务记录而保留原单 {result.protected} 条，旧重复记录移入回收站 {result.deduplicated} 条，未上架 {result.skipped.length} 条。</p>{result.total > result.unique && <p>本批有 {result.total - result.unique} 条同编号旧版本，已采用本批最后出现的版本。</p>}{result.skipped.length > 0 && <details><summary>查看未上架的订单及原因</summary>{result.skipped.map((item, index) => <p key={`${item.code}-${index}`}>{item.code}：{item.reason}</p>)}</details>}</section>}
    <p><Link href="/manage/orders">查看全部订单 →</Link></p>
  </div>;
}

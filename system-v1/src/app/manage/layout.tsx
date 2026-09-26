"use client";

import { useEffect, useState } from "react";

export default function ManageLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem("tutor-admin-role");
    if (role !== "operator" && role !== "admin") {
      window.location.replace("/auth");
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return <main className="manage-shell" aria-live="polite" />;
  return children;
}

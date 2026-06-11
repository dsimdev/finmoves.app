"use client";

import { useEffect, useState } from "react";

const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION ?? "0";
const INTERVAL = 60_000;

export function useVersionCheck() {
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = await res.json();
        if (version !== CURRENT) setNewVersion(true);
      } catch {}
    };

    const id = setInterval(check, INTERVAL);
    return () => clearInterval(id);
  }, []);

  return newVersion;
}

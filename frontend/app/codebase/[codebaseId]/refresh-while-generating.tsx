"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10_000;

// Re-renders the server page periodically while an assessment is generating, so its questions,
// concepts, and contributors appear without a manual refresh once the agent finishes.
export function RefreshWhileGenerating({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, router]);
  return null;
}

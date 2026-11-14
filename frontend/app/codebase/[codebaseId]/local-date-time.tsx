"use client";

import { useSyncExternalStore } from "react";

const format = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const subscribe = () => () => {};

// The server doesn't know the viewer's time zone, so it renders nothing and the browser fills in
// the local date and time after hydration.
export function LocalDateTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(subscribe, () => format.format(new Date(iso)), () => "");
  return <time dateTime={iso}>{text}</time>;
}

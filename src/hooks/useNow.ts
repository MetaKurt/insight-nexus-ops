// Lightweight ticker that re-renders the consuming component on a fixed
// interval. Useful for relative time labels ("5s ago") that should keep
// updating even when the underlying data hasn't changed.

import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

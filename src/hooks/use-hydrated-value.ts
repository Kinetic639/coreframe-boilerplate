// src/hooks/use-hydrated-value.ts
import { useEffect, useState } from "react";

export function useHasHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

import { useEffect } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Screens leave the TV page open for weeks, so they keep running whatever
 * version they first loaded. This checks for a newer deploy every few minutes
 * and reloads the page when one is out.
 */
export function useAutoReload() {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== __BUILD_ID__) window.location.reload();
      } catch {
        /* offline or mid-deploy: try again next time */
      }
    };

    const id = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, []);
}

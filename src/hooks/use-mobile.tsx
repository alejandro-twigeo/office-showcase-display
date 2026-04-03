import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => getIsMobile());

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(getIsMobile());
    };
    mql.addEventListener("change", onChange);
    setIsMobile(getIsMobile());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

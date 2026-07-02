import { useEffect, useRef, useState } from "react";

// Oculta un elemento (botón flotante) mientras se navega con scroll y lo
// reaparece al detenerse, para no tapar la lista mientras la recorrés.
export function useHideOnScroll(delay = 700): boolean {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const hideThenShow = () => {
      setVisible(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(true), delay);
    };
    document.addEventListener("scroll", hideThenShow, { passive: true });
    document.addEventListener("touchmove", hideThenShow, { passive: true });
    return () => {
      document.removeEventListener("scroll", hideThenShow);
      document.removeEventListener("touchmove", hideThenShow);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [delay]);
  return visible;
}

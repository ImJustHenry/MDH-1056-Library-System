import { useEffect, useState } from "react";

const getViewportWidth = () => {
  const visualWidth = window.visualViewport?.width;
  if (typeof visualWidth === "number" && visualWidth > 0) {
    return visualWidth;
  }
  return window.innerWidth;
};

export default function useViewportMatch(maxWidth) {
  const [matches, setMatches] = useState(() => getViewportWidth() <= maxWidth);

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        setMatches(getViewportWidth() <= maxWidth);
      });
    };

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    update();

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [maxWidth]);

  return matches;
}

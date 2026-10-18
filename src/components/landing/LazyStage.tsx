import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Mounts 3D children only when scrolled near, with a static fallback until then or when WebGL is missing. */
export function LazyStage({ fallback, children, className }: { fallback: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!ref.current || !hasWebGL()) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {show ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}

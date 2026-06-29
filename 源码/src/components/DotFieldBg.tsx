import { useRef, useEffect, useState, useCallback } from 'react';

interface DotFieldBgProps {
  dotRadius?: number;
  dotSpacing?: number;
  activeRadius?: number;
  activeColor?: string;
}

export default function DotFieldBg({
  dotRadius = 1.2,
  dotSpacing = 18,
  activeRadius = 2.5,
  activeColor = 'var(--accent)',
}: DotFieldBgProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dots, setDots] = useState<{ cx: number; cy: number }[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const recalc = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const cols = Math.floor(w / dotSpacing);
    const rows = Math.floor(h / dotSpacing);

    const newDots: { cx: number; cy: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newDots.push({
          cx: c * dotSpacing + dotSpacing / 2,
          cy: r * dotSpacing + dotSpacing / 2,
        });
      }
    }
    setDots(newDots);
  }, [dotSpacing]);

  useEffect(() => {
    recalc();
    const observer = new ResizeObserver(recalc);
    if (svgRef.current) observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [recalc]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999 };
  }, []);

  const activeRange = 200;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Inert dots */}
      {dots.map((d, i) => {
        const dx = d.cx - mouseRef.current.x;
        const dy = d.cy - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isActive = dist < activeRange;
        const r = isActive ? activeRadius + (1 - dist / activeRange) * 1.5 : dotRadius;
        const fill = isActive ? activeColor : 'rgba(255,255,255,0.06)';

        return <circle key={i} cx={d.cx} cy={d.cy} r={r} fill={fill} />;
      })}
    </svg>
  );
}

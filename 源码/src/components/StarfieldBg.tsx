import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  opacity: number;
  baseOpacity: number;
  phase: number;
  speed: number;
}

interface StarfieldBgProps {
  starCount?: number;
  speed?: number;
  connectDistance?: number;
}

export default function StarfieldBg({
  starCount = 200,
  speed = 0.3,
  connectDistance = 120,
}: StarfieldBgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const initStars = () => {
      const stars: Star[] = [];
      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const baseOpacity = 0.1 + Math.random() * 0.5;
        stars.push({
          x,
          y,
          baseX: x,
          baseY: y,
          radius: 0.5 + Math.random() * 1.0,
          opacity: baseOpacity,
          baseOpacity,
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3,
        });
      }
      starsRef.current = stars;
    };

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      initStars();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / w - 0.5) * 2;
      mouseRef.current.y = (e.clientY / h - 0.5) * 2;
    };

    initStars();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, w, h);

      const stars = starsRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update & draw stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Vertical floating
        s.y = s.baseY + Math.sin(frameRef.current * 0.005 * s.speed + s.phase) * 8;
        // Parallax offset
        const px = s.baseX + mx * w * 0.02;
        const py = s.y + my * h * 0.02;

        // Twinkle
        const twinkle = 0.5 + 0.5 * Math.sin(frameRef.current * 0.02 + s.phase);
        s.opacity = s.baseOpacity * (0.7 + 0.3 * twinkle);

        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,240,${s.opacity.toFixed(3)})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < stars.length; i++) {
        const si = stars[i];
        const pix = si.baseX + mx * w * 0.02;
        const piy = si.y + my * h * 0.02;

        for (let j = i + 1; j < stars.length; j++) {
          const sj = stars[j];
          const pjx = sj.baseX + mx * w * 0.02;
          const pjy = sj.y + my * h * 0.02;

          const dx = pix - pjx;
          const dy = piy - pjy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectDistance) {
            const alpha = 0.03 * (1 - dist / connectDistance);
            ctx.beginPath();
            ctx.moveTo(pix, piy);
            ctx.lineTo(pjx, pjy);
            ctx.strokeStyle = `rgba(120,160,220,${alpha.toFixed(4)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [starCount, speed, connectDistance]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

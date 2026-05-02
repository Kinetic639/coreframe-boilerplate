"use client";

import { useEffect, useRef } from "react";

type HomeIntroFloorGridProps = {
  className?: string;
  lineColor?: string;
  speed?: number;
};

/**
 * A perfectly mathematical perspective floor grid composed purely of canvas
 * lines and circles. Contains no gradients or filters, mapping straight
 * Z-depth coordinates to 2D screen space.
 */
export function HomeIntroFloorGrid({
  className = "w-full h-full object-cover object-bottom bg-transparent block",
  lineColor = "#FBBF24",
  speed = 0.001,
}: HomeIntroFloorGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    let animationFrameId: number;
    let resizeObserver: ResizeObserver | null = null;
    let lastTime = performance.now();
    let zOffset = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;

    const virtualWidth = 3000;
    const virtualHeight = 600;
    const centerX = virtualWidth / 2;
    const z0 = 10;
    const dz = 2.2;
    const maxRows = 20;
    const columnsPerSide = 7;
    const columnWidthAtBottom = 150;

    const resizeCanvas = () => {
      const nextCssWidth = canvas.clientWidth || 1;
      const nextCssHeight = canvas.clientHeight || 1;
      const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);

      if (nextCssWidth === cssWidth && nextCssHeight === cssHeight && nextDpr === dpr) {
        return;
      }

      cssWidth = nextCssWidth;
      cssHeight = nextCssHeight;
      dpr = nextDpr;

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };

    resizeCanvas();
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    const renderLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      zOffset -= speed * deltaTime;
      if (zOffset <= -dz) {
        zOffset %= dz;
      }

      const coverScale = Math.max(cssWidth / virtualWidth, cssHeight / virtualHeight);
      const offsetX = (cssWidth - virtualWidth * coverScale) / 2;
      const offsetY = cssHeight - virtualHeight * coverScale;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(offsetX, offsetY);
      ctx.scale(coverScale, coverScale);
      ctx.fillStyle = lineColor;
      ctx.strokeStyle = lineColor;

      for (let rowIndex = -2; rowIndex < maxRows; rowIndex += 1) {
        const z = z0 + rowIndex * dz + zOffset;
        const zNext = z0 + (rowIndex + 1) * dz + zOffset;

        if (z <= 0 || zNext <= 0) continue;

        const y = (virtualHeight * z0) / z;
        const yNext = (virtualHeight * z0) / zNext;
        const fadeRatio = y / virtualHeight;
        const opacity = Math.min(1, Math.max(0, (fadeRatio - 0.18) * 1.5));

        if (opacity <= 0) break;

        const horizontalStroke = Math.max(0.5, fadeRatio * 1.5);
        const verticalStroke = Math.max(0.3, fadeRatio * 1.2);
        const dotRadius = Math.max(1.5, fadeRatio * 4);

        const xStart = centerX + -columnsPerSide * columnWidthAtBottom * fadeRatio;
        const xEnd = centerX + columnsPerSide * columnWidthAtBottom * fadeRatio;

        ctx.globalAlpha = opacity;

        ctx.lineWidth = horizontalStroke;
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();

        for (let column = -columnsPerSide; column <= columnsPerSide; column += 1) {
          const x = centerX + column * columnWidthAtBottom * fadeRatio;
          const xNext = centerX + column * columnWidthAtBottom * (yNext / virtualHeight);

          if (Math.abs(column) !== columnsPerSide) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          if (rowIndex < maxRows - 1) {
            ctx.lineWidth = verticalStroke;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(xNext, yNext);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
    };
  }, [speed, lineColor]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function QRCodeComponent({ value, size = 100, className, style }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    // Ensure size is a valid number
    const validSize = Math.max(10, Math.floor(Number(size) || 100));

    QRCode.toCanvas(
      canvas,
      value,
      {
        width: validSize,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      },
      (error) => {
        if (error) {
          console.error("QR Code generation error:", error);
        }
      }
    );
  }, [value, size]);

  // Ensure size is valid for canvas attributes
  const validSize = Math.max(10, Math.floor(Number(size) || 100));

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      width={validSize}
      height={validSize}
    />
  );
}

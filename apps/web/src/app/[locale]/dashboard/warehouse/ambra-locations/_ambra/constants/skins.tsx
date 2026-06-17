import React from "react";
import { Inbox, Layers, Archive, Grid3X3, Container, LayoutGrid } from "lucide-react";

export interface SectionSkin {
  id: string;
  name: string;
  icon: React.ElementType;
  render: (color: string, strokeWidthMultiplier?: number) => React.ReactNode;
  labelPosition?: {
    x: number; // 0-100 %
    y: number; // 0-100 %
    width: number;
    height: number;
  };
}

export const SECTION_SKINS: SectionSkin[] = [
  {
    id: "wall-bin",
    name: "Open Bin",
    icon: Container,
    labelPosition: { x: 35, y: 72, width: 30, height: 12 },
    render: (color, swm = 1) => (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Main Body - Flush to edges */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke={color}
          strokeWidth={2 * swm}
        />
        {/* Symbolic Front Cutout - More realistic bin look */}
        <path
          d="M0,35 L30,35 L35,65 L65,65 L70,35 L100,35"
          fill="none"
          stroke={color}
          strokeWidth={2.5 * swm}
          strokeLinejoin="round"
        />
        {/* Reinforced rim */}
        <path
          d="M0,10 L100,10"
          fill="none"
          stroke={color}
          strokeWidth={1.5 * swm}
          className="opacity-50"
        />
        {/* Label Holder Indicator */}
        <rect x="35" y="72" width="30" height="12" fill={color} className="opacity-10" />
        <rect
          x="35"
          y="72"
          width="30"
          height="12"
          fill="none"
          stroke={color}
          strokeWidth={1 * swm}
          rx="1"
        />
      </svg>
    ),
  },
  {
    id: "shelf-unit",
    name: "Shelf Unit",
    icon: Archive,
    labelPosition: { x: 5, y: 5, width: 25, height: 10 },
    render: (color, swm = 1) => (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Outer Frame */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke={color}
          strokeWidth={3 * swm}
        />
        {/* Structural vertical lines */}
        <line
          x1="2"
          y1="0"
          x2="2"
          y2="100"
          stroke={color}
          strokeWidth={4 * swm}
          className="opacity-80"
        />
        <line
          x1="98"
          y1="0"
          x2="98"
          y2="100"
          stroke={color}
          strokeWidth={4 * swm}
          className="opacity-80"
        />
        {/* Top lip */}
        <line x1="0" y1="12" x2="100" y2="12" stroke={color} strokeWidth={2 * swm} />
        {/* Label placement typical for shelves (corner or rim) */}
        <rect x="5" y="5" width="25" height="10" fill={color} className="opacity-10" />
        <rect
          x="5"
          y="5"
          width="25"
          height="10"
          fill="none"
          stroke={color}
          strokeWidth={1 * swm}
          rx="1"
        />
      </svg>
    ),
  },
  {
    id: "drawer",
    name: "Drawer",
    icon: Inbox,
    labelPosition: { x: 30, y: 65, width: 40, height: 12 },
    render: (color, swm = 1) => (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke={color}
          strokeWidth={4 * swm}
        />
        {/* Clean Handle Outline */}
        <rect
          x="30"
          y="40"
          width="40"
          height="10"
          fill="none"
          stroke={color}
          strokeWidth={2.5 * swm}
          rx="2"
          className="opacity-100"
        />
        {/* Label strip area */}
        <rect x="30" y="65" width="40" height="12" fill={color} className="opacity-20" />
        <rect
          x="30"
          y="65"
          width="40"
          height="12"
          fill="none"
          stroke={color}
          strokeWidth={1.5 * swm}
          className="opacity-60"
          rx="1"
        />
        {/* Bottom panel line */}
        <line
          x1="0"
          y1="85"
          x2="100"
          y2="85"
          stroke={color}
          strokeWidth={1.5 * swm}
          strokeDasharray="4 4"
          className="opacity-50"
        />
      </svg>
    ),
  },
  {
    id: "shelf-item",
    name: "Box/Item",
    icon: Layers,
    labelPosition: { x: 30, y: 55, width: 40, height: 12 },
    render: (color, swm = 1) => (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Box outline fills the area */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke={color}
          strokeWidth={3 * swm}
        />
        {/* Internal detail for Box look */}
        <rect
          x="15"
          y="15"
          width="70"
          height="70"
          fill="none"
          stroke={color}
          strokeWidth={1.5 * swm}
          rx="1"
          className="opacity-60"
        />
        {/* Label area */}
        <rect x="30" y="55" width="40" height="12" fill="white" className="opacity-20" />
        <rect
          x="30"
          y="55"
          width="40"
          height="12"
          fill="none"
          stroke={color}
          strokeWidth={1.5 * swm}
          className="opacity-60"
          rx="1"
        />
      </svg>
    ),
  },
  {
    id: "vented",
    name: "Vented/Mesh",
    icon: LayoutGrid,
    labelPosition: { x: 30, y: 44, width: 40, height: 12 },
    render: (color, swm = 1) => (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke={color}
          strokeWidth={4 * swm}
        />
        {/* Simple vertical vent lines */}
        <line
          x1="16"
          y1="5"
          x2="16"
          y2="95"
          stroke={color}
          strokeWidth={2.5 * swm}
          className="opacity-60"
        />
        <line
          x1="33"
          y1="5"
          x2="33"
          y2="95"
          stroke={color}
          strokeWidth={2.5 * swm}
          className="opacity-60"
        />
        <line
          x1="50"
          y1="5"
          x2="50"
          y2="95"
          stroke={color}
          strokeWidth={2.5 * swm}
          className="opacity-60"
        />
        <line
          x1="66"
          y1="5"
          x2="66"
          y2="95"
          stroke={color}
          strokeWidth={2.5 * swm}
          className="opacity-60"
        />
        <line
          x1="83"
          y1="5"
          x2="83"
          y2="95"
          stroke={color}
          strokeWidth={2.5 * swm}
          className="opacity-60"
        />
        {/* Solid Label Area on top of vents */}
        <rect x="30" y="44" width="40" height="12" fill="white" className="opacity-30" rx="1" />
        <rect
          x="30"
          y="44"
          width="40"
          height="12"
          fill="none"
          stroke={color}
          strokeWidth={1.5 * swm}
        />
      </svg>
    ),
  },
];

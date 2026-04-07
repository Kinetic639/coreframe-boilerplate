import React from "react";
import { Box, AlertTriangle } from "lucide-react";
import { LocationType } from "../types";

interface ToolboxItemProps {
  type: LocationType;
  label: string;
  icon: React.ReactNode;
}

const ToolboxItem: React.FC<ToolboxItemProps> = ({ type, label, icon }) => {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("locationType", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 bg-slate-50 rounded-md flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors mb-2">
        {icon}
      </div>
      <span className="text-[10px] font-medium text-slate-600 group-hover:text-blue-700">
        {label}
      </span>
    </div>
  );
};

export const Toolbox: React.FC = () => {
  return (
    <div className="w-64 h-full border-r bg-white flex flex-col border-t">
      <div className="p-4 border-b bg-slate-50">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Components
        </h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
        <ToolboxItem type="storage" label="Storage" icon={<Box className="w-5 h-5" />} />
        <ToolboxItem
          type="obstacle"
          label="Obstacle"
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        />
      </div>
      <div className="mt-auto p-4 bg-blue-50 border-t border-blue-100">
        <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
          Drag and drop components onto the canvas to place them in your warehouse.
        </p>
      </div>
    </div>
  );
};

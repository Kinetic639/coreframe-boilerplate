import React from "react";
import {
  Layout,
  Plus,
  Save,
  Undo,
  Redo,
  Search,
  Settings,
  ChevronRight,
  Grid3X3,
  Magnet,
  PanelRight,
  Eye,
  Edit3,
} from "lucide-react";
import { LocationNode } from "../types";
import { cn } from "../lib/utils";

export type ViewMode = "editor" | "preview";

interface HeaderProps {
  selectedLocation: LocationNode | null;
  onSave: () => void;
  onReset: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLocation,
  onSave,
  onReset,
  showInspector,
  onToggleInspector,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <header className="h-14 border-b bg-white flex items-center px-4 justify-between shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Layout className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-slate-800 tracking-tight hidden sm:block">
            Warehouse<span className="text-blue-600">Layout</span>
          </h1>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />

        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange("editor")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              viewMode === "editor"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Edit3 className="w-3.5 h-3.5" />
            EDITOR
          </button>
          <button
            onClick={() => onViewModeChange("preview")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              viewMode === "preview"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            PREVIEW
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="flex items-center gap-2 py-1.5 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Reset
        </button>

        <button
          onClick={onSave}
          className="flex items-center gap-2 py-1.5 px-3 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" /> Save
        </button>

        <button
          onClick={onToggleInspector}
          className={cn(
            "p-2 rounded-md transition-colors",
            showInspector
              ? "text-blue-600 bg-blue-50"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
          title={showInspector ? "Hide Inspector" : "Show Inspector"}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

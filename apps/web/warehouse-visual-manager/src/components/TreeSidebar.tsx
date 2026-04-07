import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Box,
  Layout,
  Database,
  Search,
  GitBranch,
  Plus,
} from "lucide-react";
import { LocationNode } from "../types";
import { cn } from "../lib/utils";

interface TreeItemProps {
  location: LocationNode;
  allLocations: LocationNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  level: number;
}

const TreeItem: React.FC<TreeItemProps> = ({
  location,
  allLocations,
  selectedId,
  onSelect,
  level,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const children = allLocations.filter((l) => l.parentId === location.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === location.id;

  const getIcon = () => {
    switch (location.type) {
      case "warehouse":
        return <Database className="w-4 h-4" />;
      case "storage":
        return <Box className="w-4 h-4" />;
      case "obstacle":
        return <Layout className="w-4 h-4 text-red-500" />;
      default:
        return <Folder className="w-4 h-4" />;
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center py-1 px-2 cursor-pointer hover:bg-slate-100 rounded-md text-sm transition-colors",
          isSelected &&
            "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600 rounded-l-none"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(location.id)}
      >
        <span
          className="mr-1 p-0.5 hover:bg-slate-200 rounded"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }
          }}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : (
            <div className="w-3" />
          )}
        </span>
        <span className="mr-2 opacity-70">{getIcon()}</span>
        <span className="truncate">{location.name}</span>
        <span className="ml-auto text-[10px] opacity-40 font-mono">{location.slug}</span>
      </div>
      {hasChildren && isOpen && (
        <div className="mt-0.5">
          {children.map((child) => (
            <TreeItem
              key={child.id}
              location={child}
              allLocations={allLocations}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TreeSidebarProps {
  locations: LocationNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddRoot: () => void;
}

export const TreeSidebar: React.FC<TreeSidebarProps> = ({
  locations,
  selectedId,
  onSelect,
  onAddRoot,
}) => {
  const rootLocations = locations.filter((l) => !l.parentId);

  return (
    <div className="w-64 h-full border-r bg-white flex flex-col">
      <div className="p-4 border-b bg-slate-50 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select className="bg-transparent border-none text-xs font-semibold text-slate-600 outline-none cursor-pointer hover:text-slate-900 transition-colors w-full">
            <option>Main Branch</option>
            <option>North Wing</option>
            <option>South Storage</option>
          </select>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1.5">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search locations..."
            className="bg-transparent border-none outline-none text-xs w-full"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {rootLocations.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400 italic">
            No locations created yet.
          </div>
        ) : (
          rootLocations.map((root) => (
            <TreeItem
              key={root.id}
              location={root}
              allLocations={locations}
              selectedId={selectedId}
              onSelect={onSelect}
              level={0}
            />
          ))
        )}
      </div>
      <div className="p-4 border-t bg-slate-50">
        <button
          onClick={onAddRoot}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Warehouse
        </button>
      </div>
    </div>
  );
};

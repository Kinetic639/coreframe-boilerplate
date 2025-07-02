"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { LocationForm } from "./LocationForm";
import { Tables } from "../../../../supabase/types/types";
import { loadLocations } from "../api/locations";
import { LocationTreeItem, Tree } from "./LocationTree";

interface Props {
  locations: Tables<"locations">[];
  activeOrgId: string;
  activeBranchId: string;
}

export function LocationManager({ locations: initial, activeOrgId, activeBranchId }: Props) {
  const [locations, setLocations] = useState(initial);
  const [openModal, setOpenModal] = useState<"add" | "edit" | null>(null);
  const [activeLocation, setActiveLocation] = useState<Tables<"locations"> | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const fetchLocations = async () => {
    const data = await loadLocations(activeOrgId, activeBranchId);
    setLocations(data);
  };

  const parentLocation = parentId ? (locations.find((l) => l.id === parentId) ?? null) : null;

  const buildTree = (all: Tables<"locations">[]): LocationTreeItem[] => {
    const byParent: Record<string | null, Tables<"locations">[]> = {};
    all.forEach((loc) => {
      const pid = loc.parent_id ?? null;
      byParent[pid] = [...(byParent[pid] || []), loc];
    });

    const build = (parentId: string | null): LocationTreeItem[] =>
      (byParent[parentId] || []).map((loc) => ({
        id: loc.id,
        name: loc.name,
        icon_name: loc.icon_name,
        code: loc.code,
        color: loc.color,
        raw: loc,
        children: build(loc.id),
      }));

    return build(null);
  };

  const tree = buildTree(locations);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Lokalizacje magazynowe</h2>
          <Button
            onClick={() => {
              setParentId(null);
              setOpenModal("add");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nowa lokalizacja
          </Button>
        </div>

        <Tree
          data={tree}
          onSelect={(item) => {
            setActiveLocation(item.raw);
            setOpenModal("edit");
          }}
        />
      </div>

      {/* Dodawanie */}
      <Dialog open={openModal === "add"} onOpenChange={(v) => v || setOpenModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj lokalizację</DialogTitle>
          </DialogHeader>
          <LocationForm
            mode="add"
            parentLocation={parentLocation}
            onSuccess={() => {
              fetchLocations();
              setOpenModal(null);
              setParentId(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edycja */}
      <Dialog open={openModal === "edit"} onOpenChange={(v) => v || setOpenModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj lokalizację</DialogTitle>
          </DialogHeader>
          <LocationForm
            mode="edit"
            location={activeLocation}
            onSuccess={() => {
              fetchLocations();
              setOpenModal(null);
              setActiveLocation(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

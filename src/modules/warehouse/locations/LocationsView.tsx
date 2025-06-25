"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LocationTree, { Location } from "./LocationTree";
import LocationForm, { LocationOption } from "./LocationForm";

const initialLocations: Location[] = [
  {
    id: "1",
    name: "Magazyn główny",
    children: [
      { id: "2", name: "Sekcja A" },
      { id: "3", name: "Sekcja B" },
    ],
  },
];

function collectOptions(nodes: Location[]): LocationOption[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name },
    ...(n.children ? collectOptions(n.children) : []),
  ]);
}

function insertChild(nodes: Location[], parentId: string, child: Location): Location[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, children: [...(n.children || []), child] };
    }
    return { ...n, children: n.children ? insertChild(n.children, parentId, child) : n.children };
  });
}

function updateName(nodes: Location[], id: string, name: string): Location[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name };
    return { ...n, children: n.children ? updateName(n.children, id, name) : n.children };
  });
}

function removeNode(nodes: Location[], id: string): Location[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: n.children ? removeNode(n.children, id) : n.children }));
}

export default function LocationsView() {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const parentOptions = collectOptions(locations);

  const addLocation = (values: { name: string; parentId?: string | null }) => {
    const newLoc: Location = { id: Date.now().toString(), name: values.name };
    if (values.parentId) {
      setLocations((locs) => insertChild(locs, values.parentId!, newLoc));
    } else {
      setLocations((locs) => [...locs, newLoc]);
    }
  };

  const editLocation = (loc: Location) => {
    setLocations((locs) => updateName(locs, loc.id, loc.name));
  };

  const confirmDeleteLocation = () => {
    if (deleteTarget) {
      setLocations((locs) => removeNode(locs, deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Lokalizacje</h1>
        <Button variant="themed" onClick={() => setIsEditMode((m) => !m)}>
          {isEditMode ? "Zakończ" : "Edytuj"}
        </Button>
      </div>
      {isEditMode && (
        <LocationForm parentOptions={parentOptions} onSubmit={addLocation}>
          <Button variant="themed">Dodaj lokalizację</Button>
        </LocationForm>
      )}
      <LocationTree
        locations={locations}
        isEditMode={isEditMode}
        parentOptions={parentOptions}
        onEdit={editLocation}
        onDelete={(loc) => setDeleteTarget(loc)}
      />
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Czy na pewno usunąć?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Anuluj
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDeleteLocation}>
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

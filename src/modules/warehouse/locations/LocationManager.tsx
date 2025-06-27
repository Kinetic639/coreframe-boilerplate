"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppContext } from "@/lib/hooks/us-app-context";
import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { loadLocations } from "../api/locations";
import { LocationForm } from "./LocationForm";
import { Pencil, Plus, Trash } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { deleteLocation } from "../api/locations";
import { toast } from "react-toastify";
import { Tables } from "../../../../supabase/types/types";

export function LocationManager({
  initialLocations = [],
}: {
  initialLocations?: Tables<"locations">[];
}) {
  const { activeOrgId } = useAppContext();
  const { data: locations = initialLocations, mutate } = useSWR(
    activeOrgId ? ["locations", activeOrgId] : null,
    () => loadLocations(activeOrgId!),
    { fallbackData: initialLocations }
  );
  const [openModal, setOpenModal] = useState<"add" | "edit" | null>(null);
  const [activeLocation, setActiveLocation] = useState<Tables<"locations"> | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const rootLocations = locations.filter((l) => !l.parent_id);

  const renderTree = (loc: Tables<"locations">) => {
    const children = locations.filter((l) => l.parent_id === loc.id);

    return (
      <AccordionItem key={loc.id} value={loc.id}>
        <AccordionTrigger asChild>
          <div className="flex w-full items-center justify-between pr-2">
            <div className="flex items-center gap-2">
              {loc.image_url && (
                <Image
                  src={loc.image_url}
                  alt={loc.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-sm border border-muted object-cover"
                />
              )}
              {loc.icon_name && (
                <i className={`lucide lucide-${loc.icon_name} text-muted-foreground`} />
              )}
              <Link
                href={`/dashboard/warehouse/locations/${loc.id}`}
                className="font-medium hover:underline"
              >
                {loc.name}
              </Link>
              {loc.code && <span className="ml-1 text-xs text-muted-foreground">({loc.code})</span>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" asChild>
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-8 w-8 items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLocation(loc);
                    setOpenModal("edit");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </span>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-8 w-8 items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentId(loc.id);
                    setOpenModal("add");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-8 w-8 items-center justify-center"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const ok = confirm("Usunąć lokalizację?");
                    if (!ok) return;
                    const success = await deleteLocation(loc.id);
                    if (success) {
                      toast.success("Lokalizacja usunięta");
                      await mutate();
                    } else {
                      toast.error("Nie można usunąć lokalizacji");
                    }
                  }}
                >
                  <Trash className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </div>
        </AccordionTrigger>

        {children.length > 0 && (
          <AccordionContent className="ml-1 border-l border-border pl-4">
            <Accordion type="multiple">{children.map(renderTree)}</Accordion>
          </AccordionContent>
        )}
      </AccordionItem>
    );
  };

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

        <Accordion type="multiple" className="pl-2">
          {rootLocations.map(renderTree)}
        </Accordion>
      </div>

      {/* Modal dodawania */}
      <Dialog open={openModal === "add"} onOpenChange={(v) => v || setOpenModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj lokalizację</DialogTitle>
          </DialogHeader>
          <LocationForm
            parentId={parentId}
            mode="add"
            onSuccess={async () => {
              await mutate();
              setOpenModal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal edycji */}
      <Dialog open={openModal === "edit"} onOpenChange={(v) => v || setOpenModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj lokalizację</DialogTitle>
          </DialogHeader>
          <LocationForm
            mode="edit"
            location={activeLocation}
            onSuccess={async () => {
              await mutate();
              setOpenModal(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

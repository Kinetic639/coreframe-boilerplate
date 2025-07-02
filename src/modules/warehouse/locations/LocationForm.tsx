"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/lib/hooks/us-app-context";
import { createLocation, updateLocation } from "../api/locations";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";

interface LocationFormProps {
  mode?: "add" | "edit";
  parentId?: string | null;
  location?: Tables<"locations"> | null;
  onSuccess?: () => void;
}

export function LocationForm({
  mode = "add",
  parentId = null,
  location = null,
  onSuccess,
}: LocationFormProps) {
  const { activeOrgId, activeBranchId } = useAppContext();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [icon, setIcon] = useState("map-pin");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "edit" && location) {
      setName(location.name || "");
      setCode(location.code || "");
      setColor(location.color || "#cccccc");
      setIcon(location.icon_name || "map-pin");
    }
  }, [mode, location]);

  async function uploadImage(file: File): Promise<string | null> {
    const supabase = createClient();
    const filePath = `locations/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from("location-images").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      toast.error("Nie udało się wysłać zdjęcia");
      return null;
    }

    const { data } = supabase.storage.from("location-images").getPublicUrl(filePath);

    return data.publicUrl ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activeOrgId || !activeBranchId) {
      toast.error("Brak aktywnej organizacji lub oddziału.");
      return;
    }

    setLoading(true);

    let imageUrl: string | null = location?.image_url ?? null;
    if (file) {
      const uploadedUrl = await uploadImage(file);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    if (mode === "edit" && location) {
      const payload: TablesUpdate<"locations"> = {
        name,
        code,
        color,
        icon_name: icon,
        image_url: imageUrl,
      };

      const result = await updateLocation(location.id, payload);
      if (result) {
        toast.success("Lokalizacja zaktualizowana");
        onSuccess?.();
      } else {
        toast.error("Błąd podczas aktualizacji");
      }
    } else {
      const payload: TablesInsert<"locations"> = {
        name,
        code,
        color,
        icon_name: icon,
        image_url: imageUrl,
        organization_id: activeOrgId,
        branch_id: activeBranchId,
        parent_id: parentId,
        level: parentId ? 2 : 1,
        sort_order: 0,
      };

      const result = await createLocation(payload);
      if (result) {
        toast.success("Lokalizacja dodana");
        onSuccess?.();
      } else {
        toast.error("Błąd podczas dodawania");
      }
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nazwa lokalizacji</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <Label>Kod</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="np. A1-POLE" />
      </div>

      <div>
        <Label>Kolor</Label>
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>

      <div>
        <Label>Ikona (Lucide)</Label>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="np. map-pin" />
      </div>

      <div>
        <Label>Zdjęcie lokalizacji</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Zapisuję..." : mode === "edit" ? "Zapisz zmiany" : "Dodaj lokalizację"}
      </Button>
    </form>
  );
}

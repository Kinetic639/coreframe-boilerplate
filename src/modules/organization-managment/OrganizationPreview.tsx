"use client";

import { Eye, Globe, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationFormData } from "./schema";
import { useFormContext } from "react-hook-form";

export default function OrganizationPreview({ values }: { values: Partial<OrganizationFormData> }) {
  const form = useFormContext<OrganizationFormData>();
  const watch = form?.watch?.() ?? values; // fallback, jeśli form nie jest w kontekście

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Podgląd
        </CardTitle>
        <CardDescription>Tak będzie wyglądać profil organizacji</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div className="text-center">
          {watch.logo_url ? (
            <img
              src={watch.logo_url}
              alt="Logo organizacji"
              className="mx-auto h-20 w-20 rounded-lg border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Nazwa */}
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-bold" style={{ color: watch.font_color || "#000000" }}>
            {watch.name || "Nazwa organizacji"}
          </h3>
          {watch.name_2 && <p className="text-sm text-muted-foreground">{watch.name_2}</p>}
          {watch.slug && <p className="font-mono text-xs text-muted-foreground">/{watch.slug}</p>}
        </div>

        {/* Opis */}
        {watch.bio && <div className="text-center text-sm text-muted-foreground">{watch.bio}</div>}

        {/* Strona www */}
        {watch.website && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Globe className="h-4 w-4" />
            <a
              href={watch.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {watch.website}
            </a>
          </div>
        )}

        {/* Kolory */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Kolory motywu:</div>
          <div className="flex gap-2">
            <div className="flex-1 text-center">
              <div
                className="h-8 w-full rounded border"
                style={{ backgroundColor: watch.theme_color || "#ffffff" }}
              />
              <div className="mt-1 text-xs text-muted-foreground">Motyw</div>
            </div>
            <div className="flex-1 text-center">
              <div
                className="h-8 w-full rounded border"
                style={{ backgroundColor: watch.font_color || "#000000" }}
              />
              <div className="mt-1 text-xs text-muted-foreground">Czcionka</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

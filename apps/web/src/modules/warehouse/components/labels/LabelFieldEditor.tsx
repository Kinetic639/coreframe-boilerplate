"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Type, AlignLeft, AlignCenter, AlignRight, Palette } from "lucide-react";
import { LabelTemplateField } from "@/lib/types/qr-system";
import { LexicalFieldEditor } from "./LexicalFieldEditor";

interface LabelFieldEditorProps {
  field: LabelTemplateField;
  onUpdate: (updates: Partial<LabelTemplateField>) => void;
  onRemove: () => void;
}

export function LabelFieldEditor({ field, onUpdate, onRemove }: LabelFieldEditorProps) {
  const [activeTab, setActiveTab] = useState("content");

  const handleFieldValueChange = (value: string) => {
    onUpdate({ field_value: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={field.field_type === "text" ? "default" : "outline"}>
              {field.field_type === "text" ? "Tekst" : "Puste pole"}
            </Badge>
            <span className="text-base">{field.field_name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">
              <Type className="mr-2 h-4 w-4" />
              Treść
            </TabsTrigger>
            <TabsTrigger value="style">
              <Palette className="mr-2 h-4 w-4" />
              Styl
            </TabsTrigger>
            <TabsTrigger value="position">Pozycja</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field-name">Nazwa pola</Label>
              <Input
                id="field-name"
                value={field.field_name}
                onChange={(e) => onUpdate({ field_name: e.target.value })}
                placeholder="np. Kod produktu"
              />
            </div>

            {field.field_type === "text" && (
              <div className="space-y-2">
                <Label>Treść pola</Label>
                <LexicalFieldEditor
                  value={field.field_value || ""}
                  onChange={handleFieldValueChange}
                  placeholder="Wpisz treść pola..."
                />
                <p className="text-xs text-muted-foreground">
                  Użyj edytora do sformatowania tekstu
                </p>
              </div>
            )}

            {field.field_type === "blank" && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <p>To pole zostanie pozostawione puste z linią do ręcznego wpisania.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="show-label">Pokaż etykietę pola</Label>
              <Switch
                id="show-label"
                checked={field.show_label}
                onCheckedChange={(checked) => onUpdate({ show_label: checked })}
              />
            </div>

            {field.show_label && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="label-text">Tekst etykiety</Label>
                  <Input
                    id="label-text"
                    value={field.label_text || ""}
                    onChange={(e) => onUpdate({ label_text: e.target.value })}
                    placeholder="np. Nazwa produktu:"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="label-position">Pozycja etykiety</Label>
                  <Select
                    value={field.label_position || "inside-top-left"}
                    onValueChange={(value) =>
                      onUpdate({ label_position: value as LabelTemplateField["label_position"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inside-top-left">Góra Lewo</SelectItem>
                      <SelectItem value="inside-top-center">Góra Środek</SelectItem>
                      <SelectItem value="inside-top-right">Góra Prawo</SelectItem>
                      <SelectItem value="inside-center-left">Środek Lewo</SelectItem>
                      <SelectItem value="inside-center-center">Środek Środek</SelectItem>
                      <SelectItem value="inside-center-right">Środek Prawo</SelectItem>
                      <SelectItem value="inside-bottom-left">Dół Lewo</SelectItem>
                      <SelectItem value="inside-bottom-center">Dół Środek</SelectItem>
                      <SelectItem value="inside-bottom-right">Dół Prawo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rozmiar etykiety: {field.label_font_size || 10}pt</Label>
                    <Slider
                      value={[field.label_font_size || 10]}
                      onValueChange={([value]) => onUpdate({ label_font_size: value })}
                      max={16}
                      min={6}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="label-color">Kolor etykiety</Label>
                    <Input
                      id="label-color"
                      type="color"
                      value={field.label_color || "#666666"}
                      onChange={(e) => onUpdate({ label_color: e.target.value })}
                      className="h-8 w-full"
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Style Tab */}
          <TabsContent value="style" className="space-y-4">
            {field.field_type === "text" && (
              <>
                <div className="space-y-2">
                  <Label>Rozmiar czcionki: {field.font_size}pt</Label>
                  <Slider
                    value={[field.font_size]}
                    onValueChange={([value]) => onUpdate({ font_size: value })}
                    max={24}
                    min={6}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Grubość czcionki</Label>
                  <Select
                    value={field.font_weight}
                    onValueChange={(value: "normal" | "bold" | "light") =>
                      onUpdate({ font_weight: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Cienka</SelectItem>
                      <SelectItem value="normal">Normalna</SelectItem>
                      <SelectItem value="bold">Pogrubiona</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Wyrównanie poziome</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={field.text_align === "left" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onUpdate({ text_align: "left" })}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={field.text_align === "center" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onUpdate({ text_align: "center" })}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={field.text_align === "right" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onUpdate({ text_align: "right" })}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Wyrównanie pionowe</Label>
                  <Select
                    value={field.vertical_align}
                    onValueChange={(value: "top" | "center" | "bottom") =>
                      onUpdate({ vertical_align: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Góra</SelectItem>
                      <SelectItem value="center">Środek</SelectItem>
                      <SelectItem value="bottom">Dół</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="text-color">Kolor tekstu</Label>
                <div className="flex gap-2">
                  <Input
                    id="text-color"
                    type="color"
                    value={field.text_color}
                    onChange={(e) => onUpdate({ text_color: e.target.value })}
                    className="h-10 w-12 rounded border p-1"
                  />
                  <Input
                    value={field.text_color}
                    onChange={(e) => onUpdate({ text_color: e.target.value })}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bg-color">Kolor tła</Label>
                <div className="flex gap-2">
                  <Input
                    id="bg-color"
                    type="color"
                    value={
                      field.background_color === "transparent" ? "#FFFFFF" : field.background_color
                    }
                    onChange={(e) => onUpdate({ background_color: e.target.value })}
                    className="h-10 w-12 rounded border p-1"
                  />
                  <Input
                    value={field.background_color === "transparent" ? "" : field.background_color}
                    onChange={(e) =>
                      onUpdate({ background_color: e.target.value || "transparent" })
                    }
                    placeholder="transparent"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ramka pola</Label>
              <Switch
                checked={field.border_enabled}
                onCheckedChange={(checked) => onUpdate({ border_enabled: checked })}
              />
            </div>

            {field.border_enabled && (
              <>
                <div className="space-y-2">
                  <Label>Grubość ramki: {field.border_width}px</Label>
                  <Slider
                    value={[field.border_width]}
                    onValueChange={([value]) => onUpdate({ border_width: value })}
                    max={5}
                    min={0.5}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="border-color">Kolor ramki</Label>
                  <div className="flex gap-2">
                    <Input
                      id="border-color"
                      type="color"
                      value={field.border_color}
                      onChange={(e) => onUpdate({ border_color: e.target.value })}
                      className="h-10 w-12 rounded border p-1"
                    />
                    <Input
                      value={field.border_color}
                      onChange={(e) => onUpdate({ border_color: e.target.value })}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Marginesy wewnętrzne (mm)</Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Góra</Label>
                  <Input
                    type="number"
                    value={field.padding_top || 2}
                    onChange={(e) => onUpdate({ padding_top: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="10"
                    step="0.5"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dół</Label>
                  <Input
                    type="number"
                    value={field.padding_bottom || 2}
                    onChange={(e) => onUpdate({ padding_bottom: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="10"
                    step="0.5"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lewo</Label>
                  <Input
                    type="number"
                    value={field.padding_left || 2}
                    onChange={(e) => onUpdate({ padding_left: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="10"
                    step="0.5"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prawo</Label>
                  <Input
                    type="number"
                    value={field.padding_right || 2}
                    onChange={(e) => onUpdate({ padding_right: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="10"
                    step="0.5"
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Position Tab */}
          <TabsContent value="position" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pozycja X (mm): {field.position_x.toFixed(1)}</Label>
                <Slider
                  value={[field.position_x]}
                  onValueChange={([value]) => onUpdate({ position_x: value })}
                  max={50}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Pozycja Y (mm): {field.position_y.toFixed(1)}</Label>
                <Slider
                  value={[field.position_y]}
                  onValueChange={([value]) => onUpdate({ position_y: value })}
                  max={50}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Szerokość (mm): {field.width_mm.toFixed(1)}</Label>
                <Slider
                  value={[field.width_mm]}
                  onValueChange={([value]) => onUpdate({ width_mm: value })}
                  max={70}
                  min={5}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Wysokość (mm): {field.height_mm.toFixed(1)}</Label>
                <Slider
                  value={[field.height_mm]}
                  onValueChange={([value]) => onUpdate({ height_mm: value })}
                  max={40}
                  min={2}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

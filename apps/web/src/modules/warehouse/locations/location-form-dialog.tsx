"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Icon } from "@/components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/utils";

const locationSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().nullable().optional(),
  icon_name: z.string().min(1, "Ikona jest wymagana"),
  image_url: z.string().url().optional().or(z.literal("")),
  image_file: z.any().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationTreeItem;
  parentLocation?: LocationTreeItem;
  onSave: (data: LocationFormData) => void;
}

const iconOptions = [
  "Warehouse",
  "Building",
  "Grid3X3",
  "Package",
  "Archive",
  "Box",
  "Container",
  "Layers",
  "MapPin",
  "Home",
  "Store",
  "Truck",
];

const colorOptions = [
  "default", // Special value for theme color
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
];

export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  parentLocation,
  onSave,
}: LocationFormDialogProps) {
  const isEditing = !!location;
  const { activeOrg } = useAppStore();
  const defaultThemeColor = activeOrg?.theme_color || "#6b7280"; // Fallback to a default gray if no theme color

  const { uploadFile, error: uploadError } = useSupabaseUpload();

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name || "",
      code: location?.code || "",
      description: location?.raw.description || "",
      color: location?.color || "default", // Set default to 'default' string
      icon_name: location?.icon_name || "MapPin",
      image_url: location?.raw.image_url || "",
      image_file: undefined,
    },
  });

  React.useEffect(() => {
    if (location) {
      form.reset({
        name: location.name,
        code: location.code || "",
        description: location.raw.description || "",
        color: location.color || "default", // Set default to 'default' string
        icon_name: location.icon_name || "MapPin",
        image_url: location.raw.image_url || "",
        image_file: undefined,
      });
    } else {
      form.reset({
        name: "",
        code: "",
        description: "",
        color: "default", // Set default to 'default' string
        icon_name: "MapPin",
        image_url: "",
        image_file: undefined,
      });
    }
  }, [location, form]);

  const onSubmit = async (data: LocationFormData) => {
    let imageUrl = data.image_url;

    if (data.image_file) {
      const file = data.image_file as File;
      const fileName = `${Date.now()}-${file.name}`;
      const publicUrl = await uploadFile("location-images", file, fileName);

      if (publicUrl) {
        imageUrl = publicUrl;
      } else if (uploadError) {
        console.error("Upload error:", uploadError);
        // Handle upload error, maybe show a toast notification
        return;
      }
    }

    // If 'default' is selected, set color to null for database
    const colorToSave = data.color === "default" ? null : data.color;

    onSave({ ...data, image_url: imageUrl, color: colorToSave });
    onOpenChange(false);
  };

  const selectedIcon = form.watch("icon_name");
  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[600px]">
        <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edytuj lokalizację" : "Dodaj nową lokalizację"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Zaktualizuj informacje o lokalizacji"
                : parentLocation
                  ? `Dodaj nową podlokalizację w: ${parentLocation.name}`
                  : "Dodaj nową lokalizację główną"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nazwa *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nazwa lokalizacji" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kod</FormLabel>
                      <FormControl>
                        <Input placeholder="np. MG-A-R1" {...field} />
                      </FormControl>
                      <FormDescription>Unikalny kod lokalizacji</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opis</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Opis lokalizacji..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="icon_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ikona *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz ikonę">
                              {field.value && (
                                <div className="flex items-center gap-2">
                                  <Icon name={field.value as any} className="h-4 w-4" />
                                  {field.value}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {iconOptions.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                <Icon name={icon as any} className="h-4 w-4" />
                                {icon}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kolor</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-8 w-8 rounded border"
                              style={{
                                backgroundColor:
                                  selectedColor === "default" ? defaultThemeColor : selectedColor,
                              }}
                            />
                            <Input
                              type="color"
                              className="h-8 w-16 rounded border p-1"
                              value={
                                selectedColor === "default"
                                  ? defaultThemeColor
                                  : selectedColor || "#000000"
                              }
                              onChange={(e) => field.onChange(e.target.value)}
                              disabled={selectedColor === "default"}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              key="default"
                              type="button"
                              className={cn(
                                "h-6 w-6 rounded border-2",
                                selectedColor === "default"
                                  ? "border-primary"
                                  : "border-transparent",
                                "hover:border-gray-300"
                              )}
                              style={{ backgroundColor: defaultThemeColor }}
                              onClick={() => field.onChange("default")}
                            >
                              <span className="sr-only">Domyślny (kolor motywu)</span>
                            </button>
                            {colorOptions
                              .filter((color) => color !== "default")
                              .map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={cn(
                                    "h-6 w-6 rounded border-2",
                                    selectedColor === color
                                      ? "border-primary"
                                      : "border-transparent",
                                    "hover:border-gray-300"
                                  )}
                                  style={{ backgroundColor: color }}
                                  onClick={() => field.onChange(color)}
                                />
                              ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL zdjęcia</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} />
                    </FormControl>
                    <FormDescription>Opcjonalne zdjęcie lokalizacji</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image_file"
                render={({ field: { value: _value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel>Prześlij zdjęcie</FormLabel>
                    <FormControl>
                      <Input
                        {...fieldProps}
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          onChange(event.target.files && event.target.files[0]);
                        }}
                      />
                    </FormControl>
                    <FormDescription>Prześlij plik zdjęcia dla lokalizacji.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("image_url") && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <h4 className="mb-2 text-sm font-medium">Podgląd zdjęcia:</h4>
                  <img
                    src={form.watch("image_url")}
                    alt="Podgląd zdjęcia"
                    className="h-32 w-32 rounded-md object-cover"
                  />
                </div>
              )}

              {/* Preview */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <h4 className="mb-2 text-sm font-medium">Podgląd:</h4>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md text-white"
                    style={{
                      backgroundColor:
                        selectedColor === "default" ? defaultThemeColor : selectedColor,
                    }}
                  >
                    <Icon name={selectedIcon as any} className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {form.watch("name") || "Nazwa lokalizacji"}
                      </span>
                      {form.watch("code") && (
                        <Badge variant="outline" className="text-xs">
                          {form.watch("code")}
                        </Badge>
                      )}
                    </div>
                    {form.watch("description") && (
                      <p className="text-xs text-muted-foreground">{form.watch("description")}</p>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Anuluj
                </Button>
                <Button type="submit">{isEditing ? "Zapisz zmiany" : "Dodaj lokalizację"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

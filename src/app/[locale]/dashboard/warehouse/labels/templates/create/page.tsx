import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FileText, Save, Eye, ArrowLeft, Palette, Ruler, QrCode, Type } from "lucide-react";
import Link from "next/link";

export default function CreateTemplatePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/warehouse/labels/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nowy Szablon Etykiety</h1>
          <p className="text-muted-foreground">
            Stwórz własny szablon etykiety QR dostosowany do Twoich potrzeb
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Podstawowe Informacje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nazwa szablonu</Label>
                  <Input id="template-name" placeholder="np. Moja Etykieta Produktu" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-type">Typ etykiety</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">Lokalizacja</SelectItem>
                      <SelectItem value="product">Produkt</SelectItem>
                      <SelectItem value="generic">Uniwersalna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Opis</Label>
                <Textarea
                  id="template-description"
                  placeholder="Krótki opis szablonu i jego przeznaczenia"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Wymiary i Format
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Szerokość (mm)</Label>
                  <Input id="width" type="number" placeholder="50" min="10" max="200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Wysokość (mm)</Label>
                  <Input id="height" type="number" placeholder="25" min="10" max="200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dpi">Rozdzielczość (DPI)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="300" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="150">150 DPI</SelectItem>
                      <SelectItem value="300">300 DPI</SelectItem>
                      <SelectItem value="600">600 DPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategoria</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Małe</SelectItem>
                      <SelectItem value="medium">Średnie</SelectItem>
                      <SelectItem value="large">Duże</SelectItem>
                      <SelectItem value="custom">Niestandardowe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Ustawienia QR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="qr-position">Pozycja QR</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz pozycję" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Środek</SelectItem>
                      <SelectItem value="left">Lewo</SelectItem>
                      <SelectItem value="right">Prawo</SelectItem>
                      <SelectItem value="top-left">Lewy górny</SelectItem>
                      <SelectItem value="top-right">Prawy górny</SelectItem>
                      <SelectItem value="bottom-left">Lewy dolny</SelectItem>
                      <SelectItem value="bottom-right">Prawy dolny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qr-size">Rozmiar QR (mm)</Label>
                  <Input id="qr-size" type="number" placeholder="20" min="5" max="50" />
                </div>
                <div className="space-y-2">
                  <Label>Margines (mm)</Label>
                  <Input type="number" placeholder="2" min="0" max="10" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Text and Content Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Tekst i Zawartość
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="show-text" />
                  <Label htmlFor="show-text">Pokazuj tekst etykiety</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="show-code" />
                  <Label htmlFor="show-code">Pokazuj kod identyfikacyjny</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="show-hierarchy" />
                  <Label htmlFor="show-hierarchy">Pokazuj hierarchię (dla lokalizacji)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="show-barcode" />
                  <Label htmlFor="show-barcode">Dodatowy kod kreskowy</Label>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="text-position">Pozycja tekstu</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz pozycję" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Góra</SelectItem>
                      <SelectItem value="bottom">Dół</SelectItem>
                      <SelectItem value="left">Lewo</SelectItem>
                      <SelectItem value="right">Prawo</SelectItem>
                      <SelectItem value="center">Środek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-size">Rozmiar tekstu</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="12" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8pt</SelectItem>
                      <SelectItem value="10">10pt</SelectItem>
                      <SelectItem value="12">12pt</SelectItem>
                      <SelectItem value="14">14pt</SelectItem>
                      <SelectItem value="16">16pt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors and Styling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Kolory i Stylizacja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bg-color">Kolor tła</Label>
                  <div className="flex gap-2">
                    <Input id="bg-color" type="color" defaultValue="#ffffff" className="w-16" />
                    <Input defaultValue="#ffffff" className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-color">Kolor tekstu</Label>
                  <div className="flex gap-2">
                    <Input id="text-color" type="color" defaultValue="#000000" className="w-16" />
                    <Input defaultValue="#000000" className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="border-color">Kolor ramki</Label>
                  <div className="flex gap-2">
                    <Input id="border-color" type="color" defaultValue="#000000" className="w-16" />
                    <Input defaultValue="#000000" className="flex-1" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="enable-border" />
                  <Label htmlFor="enable-border">Włącz ramkę</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="border-width">Grubość ramki (mm)</Label>
                  <Input
                    id="border-width"
                    type="number"
                    placeholder="0.5"
                    min="0"
                    max="5"
                    step="0.1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Podgląd na Żywo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Preview Area */}
                <div className="flex min-h-[200px] items-center justify-center rounded-lg bg-muted/30 p-8">
                  <div className="rounded border-2 border-dashed border-muted-foreground/50 bg-white p-4">
                    <div className="space-y-2 text-center">
                      <div className="mx-auto h-16 w-16 rounded bg-gray-200"></div>
                      <div className="text-xs text-gray-500">Przykładowy QR</div>
                      <div className="text-xs font-medium">Nazwa Etykiety</div>
                    </div>
                  </div>
                </div>

                {/* Preview Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wymiary:</span>
                    <span>50×25mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rozdzielczość:</span>
                    <span>300 DPI</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rozmiar pliku:</span>
                    <span>~2KB</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz Szablon
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    Pełny Podgląd
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

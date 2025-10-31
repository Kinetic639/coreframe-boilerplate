import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/server";
import { LocationProductsTable } from "@/modules/warehouse/locations/components/location-products-table";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import {
  MapPin,
  Package,
  Edit,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Building2,
  ClipboardList,
  Settings,
} from "lucide-react";
import * as Icons from "lucide-react";
import Link from "next/link";
import { LocationQrActions } from "@/modules/warehouse/locations/location-qr-actions";

interface LocationDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Add generateStaticParams for static export
export async function generateStaticParams() {
  const supabase = await createClient();
  const { data: locations } = await supabase.from("locations").select("id");
  return locations?.map(({ id }) => ({ id })) || [];
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 animate-pulse rounded bg-muted/50" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-96 animate-pulse rounded bg-muted/50" />
        <div className="h-96 animate-pulse rounded bg-muted/50" />
      </div>
    </div>
  );
}

async function LocationDetailsContent({ locationId }: { locationId: string }) {
  const supabase = await createClient();

  // Load app context to get organization_id
  const appContext = await loadAppContextServer();
  const organizationId = appContext?.activeOrg?.organization_id;

  if (!organizationId) {
    console.error("No active organization found");
    notFound();
  }

  const { data: locationData, error: locationError } = await supabase
    .from("locations")
    .select("*")
    .eq("id", locationId)
    .single();

  if (locationError || !locationData) {
    console.error("Error fetching location details:", locationError);
    notFound();
  }

  const location: LocationTreeItem = {
    id: locationData.id,
    name: locationData.name,
    icon_name: locationData.icon_name,
    code: locationData.code,
    color: locationData.color,
    raw: locationData,
    children: [], // Children will be fetched separately if needed
  };

  const branch = locationData.branch_profiles;

  // Fetch product count for the location using stock_inventory view
  const { count: productCount, error: productCountError } = await supabase
    .from("stock_inventory")
    .select("product_id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .gt("available_quantity", 0);

  if (productCountError) {
    console.error("Error fetching product count:", productCountError);
  }

  // Fetch parent location
  let parentLocation: LocationTreeItem | null = null;
  if (locationData.parent_id) {
    const { data: parentData, error: parentError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationData.parent_id)
      .single();
    if (parentError) {
      console.error("Error fetching parent location:", parentError);
    } else if (parentData) {
      parentLocation = {
        id: parentData.id,
        name: parentData.name,
        icon_name: parentData.icon_name,
        code: parentData.code,
        color: parentData.color,
        raw: parentData,
        children: [],
      };
    }
  }

  // Fetch child locations
  const { data: childLocationsData, error: childError } = await supabase
    .from("locations")
    .select("*")
    .eq("parent_id", locationId)
    .is("deleted_at", null);

  let childLocations: LocationTreeItem[] = [];
  if (childError) {
    console.error("Error fetching child locations:", childError);
  } else if (childLocationsData) {
    childLocations = childLocationsData.map((child) => ({
      id: child.id,
      name: child.name,
      icon_name: child.icon_name,
      code: child.code,
      color: child.color,
      raw: child,
      children: [],
    }));
  }

  const Icon = location.icon_name
    ? (Icons[location.icon_name as keyof typeof Icons] as React.ComponentType<{
        className?: string;
      }>)
    : Icons.MapPin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouse/locations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do lokalizacji
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: location.color || "#6b7280" }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{location.name}</h1>
              {location.code && <Badge variant="outline">{location.code}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Szczegóły lokalizacji magazynowej</p>
              {branch && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {branch.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocationQrActions locationId={locationId} locationName={location.name} />
          <Button variant="outline">
            <ClipboardList className="mr-2 h-4 w-4" />
            Przeprowadź audyt
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Korekta ilości
          </Button>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edytuj lokalizację
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="products">Produkty</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informacje podstawowe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nazwa</label>
                    <p className="text-sm">{location.name}</p>
                  </div>
                  {location.code && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Kod</label>
                      <p className="font-mono text-sm">{location.code}</p>
                    </div>
                  )}
                </div>

                {location.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Opis</label>
                    <p className="text-sm">{location.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Poziom</label>
                    <p className="text-sm">{location.level}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Kolejność</label>
                    <p className="text-sm">{location.sort_order}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ikona</label>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{location.icon_name}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Kolor</label>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded border"
                        style={{ backgroundColor: location.color || "#6b7280" }}
                      />
                      <span className="font-mono text-sm">{location.color}</span>
                    </div>
                  </div>
                </div>

                {branch && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Oddział</label>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm">{branch.name}</span>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <label className="font-medium">Utworzono</label>
                    <p>{new Date(location.raw.created_at!).toLocaleDateString("pl-PL")}</p>
                  </div>
                  <div>
                    <label className="font-medium">Zaktualizowano</label>
                    <p>{new Date(location.raw.updated_at!).toLocaleDateString("pl-PL")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics and Relations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Statystyki i relacje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/20 p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{productCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Produktów</div>
                  </div>
                  <div className="rounded-lg bg-muted/20 p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{childLocations.length}</div>
                    <div className="text-sm text-muted-foreground">Podlokalizacji</div>
                  </div>
                </div>

                {parentLocation && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Lokalizacja nadrzędna
                    </label>
                    <div className="mt-1 flex items-center gap-2 rounded bg-muted/20 p-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{parentLocation.name}</span>
                      {parentLocation.code && (
                        <Badge variant="outline" className="text-xs">
                          {parentLocation.code}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {childLocations.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Podlokalizacje
                    </label>
                    <div className="mt-1 space-y-1">
                      {childLocations.map((child) => {
                        const ChildIcon = child.icon_name
                          ? (Icons[child.icon_name as keyof typeof Icons] as React.ComponentType<{
                              className?: string;
                            }>)
                          : Icons.MapPin;

                        return (
                          <div
                            key={child.id}
                            className="flex items-center gap-2 rounded bg-muted/20 p-2"
                          >
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded text-white"
                              style={{ backgroundColor: child.color || "#6b7280" }}
                            >
                              <ChildIcon className="h-3 w-3" />
                            </div>
                            <span className="text-sm">{child.name}</span>
                            {child.code && (
                              <Badge variant="outline" className="text-xs">
                                {child.code}
                              </Badge>
                            )}
                            <div className="ml-auto text-xs text-muted-foreground">
                              {/* Product count for child location */}
                              {productCount || 0} produktów
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image */}
            {location.raw.image_url && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Zdjęcie lokalizacji
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                    <img
                      src={location.raw.image_url}
                      alt={location.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="products">
          <LocationProductsTable locationId={locationId} organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default async function LocationDetailsPage({ params }: LocationDetailsPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LocationDetailsContent locationId={id} />
    </Suspense>
  );
}

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Package, MapPin, Archive, ArrowRight, Ruler } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("modules.warehouse.items.settings");
  return {
    title: t("title"),
  };
}

export default async function WarehouseSettingsPage() {
  const t = await getTranslations("modules.warehouse.items.settings");

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            Configure warehouse module settings and preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t("general.title")}</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t("products.title")}</span>
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">{t("locations.title")}</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">{t("inventory.title")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("general.title")}</CardTitle>
              <CardDescription>{t("general.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                General warehouse module settings will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("products.title")}</CardTitle>
              <CardDescription>{t("products.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{t("products.units")}</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage units of measure for products
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/warehouse/settings/units">
                    <Button variant="outline" size="sm">
                      Manage
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardHeader>
              </Card>

              <div>
                <h3 className="mb-2 text-lg font-semibold">{t("products.variants")}</h3>
                <p className="text-sm text-muted-foreground">
                  Configure variant option groups (size, color, etc.).
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">{t("products.categories")}</h3>
                <p className="text-sm text-muted-foreground">
                  Manage product categories and hierarchies.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("locations.title")}</CardTitle>
              <CardDescription>{t("locations.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Location management settings will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("inventory.title")}</CardTitle>
              <CardDescription>{t("inventory.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-semibold">{t("inventory.adjustmentReasons")}</h3>
                <p className="text-sm text-muted-foreground">
                  Define reasons for inventory adjustments (damage, loss, etc.).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

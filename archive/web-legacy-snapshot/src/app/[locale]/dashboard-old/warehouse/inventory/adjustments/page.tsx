import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Settings, MapPin, Plus, Minus, Scan } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("modules.warehouse.items.inventory.adjustments");
  return {
    title: t("single"),
  };
}

export default async function StockAdjustmentPage() {
  const t = await getTranslations("modules.warehouse.items.inventory.adjustments");

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("single")}</h1>
            <p className="text-muted-foreground">Adjust inventory stock levels</p>
          </div>
        </div>
        <Button variant="default">
          <Plus className="mr-2 h-4 w-4" />
          Save Adjustment
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Adjustment Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Adjustment Details</CardTitle>
            <CardDescription>Configure the stock adjustment parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Select>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eastern">Eastern Warehouse</SelectItem>
                    <SelectItem value="western">Western Warehouse</SelectItem>
                    <SelectItem value="central">Central Warehouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Field */}
              <div className="space-y-2">
                <Label htmlFor="custom">Custom Field</Label>
                <Input id="custom" placeholder="Enter data" />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Reason
              </Label>
              <Select>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="found">Found</SelectItem>
                  <SelectItem value="correction">Stock Correction</SelectItem>
                  <SelectItem value="return">Customer Return</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <a href="#" className="text-primary hover:underline">
                  Manage
                </a>
              </p>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Button variant="ghost" size="sm" className="h-8">
                <Plus className="mr-2 h-3 w-3" />
                Add remarks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Table Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>Add products to adjust stock levels</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Minus className="mr-2 h-4 w-4" />
                  Remove stock
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add stock
                </Button>
                <Button variant="outline" size="sm">
                  <Scan className="mr-2 h-4 w-4" />
                  Scan products
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium">Product</th>
                    <th className="p-3 text-left text-sm font-medium">Sublocation</th>
                    <th className="p-3 text-left text-sm font-medium">Initial</th>
                    <th className="p-3 text-left text-sm font-medium">Change</th>
                    <th className="p-3 text-left text-sm font-medium">Final</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Example Row */}
                  <tr className="border-b">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-muted"></div>
                        <div>
                          <p className="font-medium">12" Wok - Non-Stick</p>
                          <p className="text-xs text-muted-foreground">3110005</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        A-02
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-muted px-3 py-1 text-sm">22</span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-green-100 px-3 py-1 text-sm text-green-700">
                        +1 ea
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-orange-100 px-3 py-1 text-sm text-orange-700">
                        23 ea
                      </span>
                    </td>
                  </tr>
                  {/* Empty State */}
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No products added yet. Click "Add stock" or "Scan products" to begin.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 border-t pt-6">
          <Button variant="outline" size="lg">
            <Minus className="mr-2 h-4 w-4" />
            Remove stock
          </Button>
          <Button variant="outline" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Add stock
          </Button>
          <Button variant="outline" size="lg">
            <Scan className="mr-2 h-4 w-4" />
            Scan products
          </Button>
          <Button variant="default" size="lg">
            Adjust stock
          </Button>
        </div>
      </div>
    </div>
  );
}

// src/app/[locale]/dashboard/warehouse/products/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";

interface ProductWithDetails {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  default_unit?: string;
  suppliers: Array<{
    id: string;
    name: string;
  }>;
  variants: Array<{
    id: string;
    name: string;
    sku?: string;
    attributes?: Record<string, any>;
    inventory_data?: {
      purchase_price?: number;
    };
    stock_locations: Array<{
      quantity: number;
      location_id: string;
    }>;
  }>;
  inventory_data?: {
    purchase_price?: number;
    vat_rate?: number;
    packaging_type?: string;
    weight?: number;
    dimensions?: Record<string, any>;
  };
  ecommerce_data?: {
    price?: number;
    discounted_price?: number;
    tags?: string[];
    category?: string;
    visibility?: boolean;
  };
  stock_locations: Array<{
    quantity: number;
    location_id: string;
    location?: {
      name: string;
    };
  }>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [product, setProduct] = React.useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  const fetchProduct = async (productId: string) => {
    try {
      const supabase = createClient();

      // Fetch product with all related data
      const { data: productData, error } = await supabase
        .from("products")
        .select(
          `
          *,
          variants:product_variants(*),
          stock_locations:product_stock_locations(
            *,
            location:locations(name)
          ),
          inventory_data:product_inventory_data(*),
          ecommerce_data:product_ecommerce_data(*),
          suppliers:product_suppliers(
            supplier:suppliers(id, name)
          )
        `
        )
        .eq("id", productId)
        .is("deleted_at", null)
        .single();

      if (error || !productData) {
        console.error("Error fetching product:", error);
        notFound();
        return;
      }

      // Transform data to match our interface
      const transformedProduct: ProductWithDetails = {
        ...productData,
        suppliers: productData.suppliers?.map((s: any) => s.supplier) || [],
        variants: productData.variants || [],
        stock_locations: productData.stock_locations || [],
        inventory_data: productData.inventory_data?.[0] || null,
        ecommerce_data: productData.ecommerce_data?.[0] || null,
      };

      setProduct(transformedProduct);
    } catch (error) {
      console.error("Error fetching product:", error);
      notFound();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  if (!product) {
    return <div>Product not found</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/warehouse/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">Szczegóły produktu i zarządzanie wariantami</p>
          </div>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Edytuj produkt
        </Button>
      </div>

      {/* Product Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informacje podstawowe</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">SKU</p>
            <p>{product.sku || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Kod kreskowy (EAN)</p>
            <p>{product.barcode || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Jednostka domyślna</p>
            <p>{product.default_unit || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dostawcy</p>
            <div className="flex flex-wrap gap-2">
              {product.suppliers.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Opis</p>
            <p>{product.description || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Variants Table or Product Stock */}
      {product.variants && product.variants.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Warianty produktu ({product.variants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa wariantu</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Atrybuty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>{variant.name}</TableCell>
                    <TableCell>{variant.sku || "-"}</TableCell>
                    <TableCell>
                      {variant.attributes
                        ? Object.entries(variant.attributes).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              <span className="font-semibold">{key}:</span>{" "}
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </span>
                          ))
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Informacje o produkcie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Ten produkt nie ma wariantów.</p>
          </CardContent>
        </Card>
      )}

      {/* Stock Information */}
      {product.stock_locations && product.stock_locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stan magazynowy</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokalizacja</TableHead>
                  <TableHead>Ilość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.stock_locations.map((stock, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {stock.location?.name || `Lokalizacja ${stock.location_id}`}
                    </TableCell>
                    <TableCell>{stock.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Additional Product Information */}
      {(product.inventory_data || product.ecommerce_data) && (
        <div className="grid gap-6 md:grid-cols-2">
          {product.inventory_data && (
            <Card>
              <CardHeader>
                <CardTitle>Dane magazynowe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.inventory_data.purchase_price && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cena zakupu</p>
                    <p>{product.inventory_data.purchase_price.toFixed(2)} PLN</p>
                  </div>
                )}
                {product.inventory_data.vat_rate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stawka VAT</p>
                    <p>{(product.inventory_data.vat_rate * 100).toFixed(0)}%</p>
                  </div>
                )}
                {product.inventory_data.packaging_type && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Typ opakowania</p>
                    <p>{product.inventory_data.packaging_type}</p>
                  </div>
                )}
                {product.inventory_data.weight && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Waga</p>
                    <p>{product.inventory_data.weight} kg</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {product.ecommerce_data && (
            <Card>
              <CardHeader>
                <CardTitle>Dane e-commerce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.ecommerce_data.price && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cena sprzedaży</p>
                    <p className="text-lg font-semibold">
                      {product.ecommerce_data.discounted_price
                        ? `${product.ecommerce_data.discounted_price.toFixed(2)} PLN`
                        : `${product.ecommerce_data.price.toFixed(2)} PLN`}
                      {product.ecommerce_data.discounted_price && (
                        <span className="ml-2 text-sm text-muted-foreground line-through">
                          {product.ecommerce_data.price.toFixed(2)} PLN
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {product.ecommerce_data.category && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Kategoria</p>
                    <p>{product.ecommerce_data.category}</p>
                  </div>
                )}
                {product.ecommerce_data.tags && product.ecommerce_data.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tagi</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.ecommerce_data.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Widoczność</p>
                  <Badge variant={product.ecommerce_data.visibility ? "default" : "secondary"}>
                    {product.ecommerce_data.visibility ? "Widoczny" : "Ukryty"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}

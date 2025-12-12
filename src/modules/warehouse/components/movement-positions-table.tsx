// =============================================
// Movement Positions Table Component
// Table for managing items in a warehouse movement
// =============================================

"use client";

import { useState, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Package } from "lucide-react";
import { toast } from "react-toastify";
import { getProductsWithStock } from "@/app/actions/warehouse/get-products-with-stock";
import { getLocations } from "@/app/actions/warehouse/get-locations";

interface MovementPosition {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  source_location_id?: string;
  destination_location_id?: string;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  available_quantity: number;
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface MovementPositionsTableProps {
  positions: MovementPosition[];
  sourceBranchId: string;
  destinationBranchId?: string;
  onAdd: (position: MovementPosition) => void;
  onRemove: (index: number) => void;
  onUpdate?: (index: number, position: MovementPosition) => void;
}

export function MovementPositionsTable({
  positions,
  sourceBranchId,
  destinationBranchId,
  onAdd,
  onRemove,
}: MovementPositionsTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceLocations, setSourceLocations] = useState<Location[]>([]);
  const [destLocations, setDestLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  // New position form
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [sourceLocation, setSourceLocation] = useState<string>("");
  const [destLocation, setDestLocation] = useState<string>("");
  const [positionNotes, setPositionNotes] = useState<string>("");

  useEffect(() => {
    if (sourceBranchId) {
      loadProducts(sourceBranchId);
      loadSourceLocations(sourceBranchId);
    }
  }, [sourceBranchId]);

  useEffect(() => {
    if (destinationBranchId) {
      loadDestLocations(destinationBranchId);
    }
  }, [destinationBranchId]);

  const loadProducts = async (branchId: string) => {
    try {
      setLoading(true);
      const result = await getProductsWithStock(branchId);
      if (result.success) {
        setProducts(result.data);
      } else {
        toast.error(result.error || "Failed to load products");
      }
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadSourceLocations = async (branchId: string) => {
    try {
      const result = await getLocations(branchId);
      if (result.success) {
        setSourceLocations(result.data);
      }
    } catch (error) {
      console.error("Error loading source locations:", error);
    }
  };

  const loadDestLocations = async (branchId: string) => {
    try {
      const result = await getLocations(branchId);
      if (result.success) {
        setDestLocations(result.data);
      }
    } catch (error) {
      console.error("Error loading destination locations:", error);
    }
  };

  const handleAddPosition = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) {
      toast.error("Please select a product");
      return;
    }

    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (qty > product.available_quantity) {
      toast.error(`Only ${product.available_quantity} units available`);
      return;
    }

    const newPosition: MovementPosition = {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity: qty,
      source_location_id: sourceLocation || undefined,
      destination_location_id: destLocation || undefined,
      notes: positionNotes || undefined,
    };

    onAdd(newPosition);

    // Reset form
    setSelectedProduct("");
    setQuantity("");
    setSourceLocation("");
    setDestLocation("");
    setPositionNotes("");
  };

  const selectedProductData = products.find((p) => p.id === selectedProduct);

  return (
    <div className="space-y-4">
      {/* Add Position Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </CardTitle>
          <CardDescription>Select a product and enter quantity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product">
                Product <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={loading}>
                <SelectTrigger id="product">
                  <SelectValue
                    placeholder={loading ? "Loading products..." : "Select product..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.sku} - {product.name} (Available: {product.available_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity..."
              />
              {selectedProductData && (
                <p className="text-sm text-muted-foreground">
                  Available: {selectedProductData.available_quantity} units
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Source Location */}
            <div className="space-y-2">
              <Label htmlFor="source-loc">Source Location</Label>
              <Select value={sourceLocation} onValueChange={setSourceLocation}>
                <SelectTrigger id="source-loc">
                  <SelectValue placeholder="Select source location..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.code} - {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destination Location */}
            {destinationBranchId && (
              <div className="space-y-2">
                <Label htmlFor="dest-loc">Destination Location</Label>
                <Select value={destLocation} onValueChange={setDestLocation}>
                  <SelectTrigger id="dest-loc">
                    <SelectValue placeholder="Select destination location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {destLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="pos-notes">Item Notes</Label>
            <Input
              id="pos-notes"
              value={positionNotes}
              onChange={(e) => setPositionNotes(e.target.value)}
              placeholder="Optional notes for this item..."
            />
          </div>

          <Button onClick={handleAddPosition} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add to List
          </Button>
        </CardContent>
      </Card>

      {/* Positions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items ({positions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No items added yet. Add items using the form above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Source Location</TableHead>
                  {destinationBranchId && <TableHead>Dest. Location</TableHead>}
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{position.product_sku}</TableCell>
                    <TableCell>{position.product_name}</TableCell>
                    <TableCell className="text-right font-medium">{position.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {position.source_location_id || "-"}
                    </TableCell>
                    {destinationBranchId && (
                      <TableCell className="text-sm text-muted-foreground">
                        {position.destination_location_id || "-"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {position.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

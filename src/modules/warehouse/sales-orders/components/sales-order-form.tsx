"use client";

/**
 * Sales Order Form Component
 * Comprehensive form for creating and editing sales orders
 * Integrates with reservations system for stock management
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, Package, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-toastify";

import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { createClient } from "@/utils/supabase/client";

import type { SalesOrderFormData } from "../../types/sales-orders";

// =============================================
// Form Schema
// =============================================

const salesOrderItemSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  product_variant_id: z.string().optional(),
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
  variant_name: z.string().optional(),
  quantity_ordered: z.number().min(1, "Quantity must be at least 1"),
  unit_of_measure: z.string().optional(),
  unit_price: z.number().min(0, "Price must be 0 or greater"),
  tax_rate: z.number().min(0).max(100).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  location_id: z.string().optional(),
  notes: z.string().optional(),
});

const salesOrderFormSchema = z.object({
  customer_id: z.string().optional(),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().optional(),
  order_date: z.date(),
  expected_delivery_date: z.date().optional(),
  delivery_address_line1: z.string().optional(),
  delivery_address_line2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_postal_code: z.string().optional(),
  delivery_country: z.string().default("PL"),
  shipping_cost: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  currency_code: z.string().default("PLN"),
  customer_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  items: z.array(salesOrderItemSchema).min(1, "At least one item is required"),
});

type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;

// =============================================
// Helper Types
// =============================================

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface AvailabilityInfo {
  available: number;
  onHand: number;
  reserved: number;
}

// =============================================
// Main Component
// =============================================

interface SalesOrderFormProps {
  orderId?: string; // For editing existing orders
  onSuccess?: (orderId: string) => void;
}

export function SalesOrderForm({ orderId: _orderId, onSuccess }: SalesOrderFormProps) {
  const router = useRouter();
  const { activeOrgId, activeBranchId, locations } = useAppStore();
  const { user } = useUserStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<Map<string, AvailabilityInfo>>(new Map());

  // Initialize form
  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      order_date: new Date(),
      delivery_country: "PL",
      currency_code: "PLN",
      shipping_cost: 0,
      discount_amount: 0,
      items: [
        {
          product_id: "",
          quantity_ordered: 1,
          unit_price: 0,
          tax_rate: 23, // Default VAT in Poland
          discount_percent: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Load products
  useEffect(() => {
    if (!activeOrgId || !activeBranchId) return;

    const loadProducts = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, sku")
          .eq("organization_id", activeOrgId)
          .is("deleted_at", null)
          .order("name");

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Failed to load products");
      }
    };

    loadProducts();
  }, [activeOrgId, activeBranchId, supabase]);

  // Load availability for a product at a location
  const loadAvailability = async (productId: string, locationId: string) => {
    if (!activeOrgId || !activeBranchId || !productId || !locationId) return;

    const key = `${productId}-${locationId}`;

    try {
      const avail = await reservationsService.getAvailableInventory(
        activeOrgId,
        activeBranchId,
        productId,
        undefined,
        locationId
      );

      // Check if avail is null or undefined
      if (!avail) {
        console.warn(
          `No availability data returned for product ${productId} at location ${locationId}`
        );
        // Set zero availability if no data returned
        setAvailability((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, {
            available: 0,
            onHand: 0,
            reserved: 0,
          });
          return newMap;
        });
        return;
      }

      setAvailability((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, {
          available: avail.availableQuantity ?? 0,
          onHand: avail.quantityOnHand ?? 0,
          reserved: avail.reservedQuantity ?? 0,
        });
        return newMap;
      });
    } catch (error) {
      console.error("Error loading availability:", error);
      // On error, set zero availability to prevent crashes
      setAvailability((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, {
          available: 0,
          onHand: 0,
          reserved: 0,
        });
        return newMap;
      });
      toast.error("Failed to load product availability");
    }
  };

  // Calculate line total
  const calculateLineTotal = (
    quantity: number,
    unitPrice: number,
    taxRate: number = 0,
    discountPercent: number = 0
  ): number => {
    const subtotal = quantity * unitPrice;
    const afterDiscount = subtotal * (1 - discountPercent / 100);
    const total = afterDiscount * (1 + taxRate / 100);
    return total;
  };

  // Calculate order totals
  const calculateTotals = () => {
    const items = form.watch("items");
    const shippingCost = form.watch("shipping_cost") || 0;
    const discountAmount = form.watch("discount_amount") || 0;

    const subtotal = items.reduce((sum, item) => {
      return sum + item.quantity_ordered * item.unit_price;
    }, 0);

    const totalDiscount =
      items.reduce((sum, item) => {
        const itemSubtotal = item.quantity_ordered * item.unit_price;
        const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
        return sum + itemDiscount;
      }, 0) + discountAmount;

    const subtotalAfterDiscount = subtotal - totalDiscount;

    const totalTax = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity_ordered * item.unit_price;
      const afterItemDiscount = itemSubtotal * (1 - (item.discount_percent || 0) / 100);
      const itemTax = afterItemDiscount * ((item.tax_rate || 0) / 100);
      return sum + itemTax;
    }, 0);

    const total = subtotalAfterDiscount + totalTax + shippingCost;

    return {
      subtotal,
      totalDiscount,
      subtotalAfterDiscount,
      totalTax,
      shippingCost,
      total,
    };
  };

  // Handle form submission
  const onSubmit = async (values: SalesOrderFormValues) => {
    if (!activeOrgId || !activeBranchId || !user?.id) {
      toast.error("Missing required context");
      return;
    }

    // Validate items have locations and quantities
    const itemsWithoutLocation = values.items.filter((item) => !item.location_id);
    if (itemsWithoutLocation.length > 0) {
      toast.error(
        `${itemsWithoutLocation.length} item(s) are missing locations. Please select a location for all items.`
      );
      return;
    }

    // Validate quantities against availability
    const itemsExceedingStock = values.items.filter((item) => {
      if (!item.location_id || !item.product_id) return false;
      const key = `${item.product_id}-${item.location_id}`;
      const avail = availability.get(key);
      return avail && item.quantity_ordered > avail.available;
    });

    if (itemsExceedingStock.length > 0) {
      toast.error(
        `${itemsExceedingStock.length} item(s) exceed available stock. Please reduce quantities.`
      );
      return;
    }

    setLoading(true);
    try {
      // Convert form values to service format
      const formData: SalesOrderFormData = {
        customer_name: values.customer_name,
        customer_email: values.customer_email,
        customer_phone: values.customer_phone,
        customer_id: values.customer_id,
        order_date: values.order_date.toISOString(),
        expected_delivery_date: values.expected_delivery_date?.toISOString(),
        delivery_address_line1: values.delivery_address_line1,
        delivery_address_line2: values.delivery_address_line2,
        delivery_city: values.delivery_city,
        delivery_state: values.delivery_state,
        delivery_postal_code: values.delivery_postal_code,
        delivery_country: values.delivery_country,
        shipping_cost: values.shipping_cost,
        discount_amount: values.discount_amount,
        currency_code: values.currency_code,
        customer_notes: values.customer_notes,
        internal_notes: values.internal_notes,
        items: values.items.map((item) => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          variant_name: item.variant_name,
          quantity_ordered: item.quantity_ordered,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          discount_percent: item.discount_percent,
          location_id: item.location_id,
          notes: item.notes,
        })),
      };

      // Create order
      const result = await salesOrdersService.createSalesOrder(
        formData,
        activeOrgId,
        activeBranchId,
        user.id
      );

      if (result.success && result.order) {
        toast.success(`Sales order ${result.order.order_number} created successfully!`);

        if (onSuccess) {
          onSuccess(result.order.id);
        } else {
          router.push(`/dashboard/warehouse/sales-orders/${result.order.id}`);
        }
      } else {
        toast.error(result.error || "Failed to create sales order");
      }
    } catch (error) {
      console.error("Error creating sales order:", error);
      toast.error("An error occurred while creating the sales order");
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const currencyCode = form.watch("currency_code") || "PLN";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Enter customer details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="customer@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+48 123 456 789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Set order dates and delivery information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Order Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
            <CardDescription>Enter shipping and delivery address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="delivery_address_line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_address_line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apartment, suite, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="delivery_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Warsaw" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="00-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Poland" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>Add products to the order</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  append({
                    product_id: "",
                    quantity_ordered: 1,
                    unit_price: 0,
                    tax_rate: 23,
                    discount_percent: 0,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              const item = form.watch(`items.${index}`);
              const availKey = `${item.product_id}-${item.location_id}`;
              const avail = availability.get(availKey);
              const lineTotal = calculateLineTotal(
                item.quantity_ordered,
                item.unit_price,
                item.tax_rate,
                item.discount_percent
              );

              return (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Item {index + 1}
                    </h4>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              const product = products.find((p) => p.id === value);
                              if (product) {
                                form.setValue(`items.${index}.product_name`, product.name);
                                form.setValue(`items.${index}.product_sku`, product.sku);
                              }
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
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
                      name={`items.${index}.location_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Location <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              if (item.product_id) {
                                loadAvailability(item.product_id, value);
                              }
                            }}
                            value={field.value}
                            disabled={!item.product_id}
                          >
                            <FormControl>
                              <SelectTrigger className={!field.value ? "border-orange-500" : ""}>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name} ({location.code || ""})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!item.product_id && (
                            <FormDescription className="text-xs">
                              Select a product first
                            </FormDescription>
                          )}
                          {item.product_id && !field.value && (
                            <FormDescription className="text-xs text-orange-600 font-medium">
                              ⚠️ Location is required for reservations
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity_ordered`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max={avail ? avail.available : undefined}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className={
                                avail && item.quantity_ordered > avail.available
                                  ? "border-red-500"
                                  : ""
                              }
                            />
                          </FormControl>
                          {avail && (
                            <FormDescription className="text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span>Available:</span>
                                <span
                                  className={`font-semibold ${
                                    avail.available === 0
                                      ? "text-red-600"
                                      : avail.available < 10
                                        ? "text-orange-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {avail.available}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>On hand:</span>
                                <span>{avail.onHand}</span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Reserved:</span>
                                <span>{avail.reserved}</span>
                              </div>
                            </FormDescription>
                          )}
                          {!item.location_id && (
                            <FormDescription className="text-xs text-orange-600">
                              Select a location to see availability
                            </FormDescription>
                          )}
                          {avail && item.quantity_ordered > avail.available && (
                            <p className="text-xs text-red-600 font-medium">
                              ⚠️ Quantity exceeds available stock! Only {avail.available} available.
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.tax_rate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.discount_percent`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Line Total:</span>
                    <span className="text-lg font-semibold">
                      {currencyCode} {lineTotal.toFixed(2)}
                    </span>
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${index}.notes`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Item notes..." {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="shipping_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PLN">PLN</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>
                  {currencyCode} {totals.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="text-red-600">
                  - {currencyCode} {totals.totalDiscount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span>
                  {currencyCode} {totals.totalTax.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping:</span>
                <span>
                  {currencyCode} {totals.shippingCost.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>
                  {currencyCode} {totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="customer_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notes visible to customer..." {...field} rows={3} />
                  </FormControl>
                  <FormDescription>These notes will be visible to the customer</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internal_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Internal notes..." {...field} rows={3} />
                  </FormControl>
                  <FormDescription>These notes are for internal use only</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Validation Summary */}
        {(() => {
          const items = form.watch("items");
          const itemsWithoutLocation = items.filter((item) => item.product_id && !item.location_id);
          const itemsExceedingStock = items.filter((item) => {
            if (!item.location_id || !item.product_id) return false;
            const key = `${item.product_id}-${item.location_id}`;
            const avail = availability.get(key);
            return avail && item.quantity_ordered > avail.available;
          });

          if (itemsWithoutLocation.length > 0 || itemsExceedingStock.length > 0) {
            return (
              <Card className="border-orange-500 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h4 className="font-semibold text-orange-900">Validation Issues</h4>
                      {itemsWithoutLocation.length > 0 && (
                        <p className="text-sm text-orange-800">
                          • {itemsWithoutLocation.length} item(s) missing location assignment
                        </p>
                      )}
                      {itemsExceedingStock.length > 0 && (
                        <p className="text-sm text-orange-800">
                          • {itemsExceedingStock.length} item(s) quantity exceeds available stock
                        </p>
                      )}
                      <p className="text-xs text-orange-700">
                        Fix these issues before creating the order. Orders without locations cannot
                        create reservations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Sales Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

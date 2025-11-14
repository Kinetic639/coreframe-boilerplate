"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdvancedDataTable, ColumnConfig } from "@/components/ui/advanced-data-table";
import type { ProductWithDetails, ProductCategory } from "@/modules/warehouse/types/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

import {
  Edit,
  Trash2,
  Package,
  ArrowRightLeft,
  MoreVertical,
  X,
  Settings,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ManageCustomFieldsDialog } from "./manage-custom-fields-dialog";
import { CustomFieldsInlineEditor } from "./custom-fields-inline-editor";
import { customFieldsService } from "@/modules/warehouse/api/custom-fields-service";
import { categoriesService } from "@/modules/warehouse/api/categories-service";
import { useAppStore } from "@/lib/stores/app-store";
import { MovementHistoryList } from "@/modules/warehouse/components/movement-history-list";
import { MovementDetailsModal } from "@/modules/warehouse/components/movement-details-modal";
import type { StockMovementWithRelations } from "@/modules/warehouse/types/stock-movements";
import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { ProductLocationBreakdown } from "./product-location-breakdown";
import type {
  CustomFieldDefinition,
  CustomFieldValue,
} from "@/modules/warehouse/types/custom-fields";
import type { CategoryTreeItem } from "@/modules/warehouse/types/categories";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  getProductSummary,
  type ProductSummary,
} from "@/app/actions/warehouse/get-product-summary";

interface ProductsAdvancedTableProps {
  products: ProductWithDetails[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (product: ProductWithDetails) => void;
  onDelete?: (product: ProductWithDetails) => void;
  onAdd?: () => void;
  onAddProductGroup?: () => void;
}

export function ProductsAdvancedTable({
  products,
  loading = false,
  error = null,
  onEdit,
  onDelete,
  onAdd,
  onAddProductGroup,
}: ProductsAdvancedTableProps) {
  const t = useTranslations("productsModule");
  const router = useRouter();
  const { activeOrgId } = useAppStore();
  const [customFieldsProduct, setCustomFieldsProduct] = React.useState<ProductWithDetails | null>(
    null
  );
  const [isCustomFieldsDialogOpen, setIsCustomFieldsDialogOpen] = React.useState(false);
  const [customFieldDefinitions, setCustomFieldDefinitions] = React.useState<
    CustomFieldDefinition[]
  >([]);
  const [customFieldValuesMap, setCustomFieldValuesMap] = React.useState<
    Record<string, CustomFieldValue[]>
  >({});
  const [categoryTree, setCategoryTree] = React.useState<CategoryTreeItem[]>([]);
  const [selectedMovement, setSelectedMovement] = React.useState<StockMovementWithRelations | null>(
    null
  );
  const [isMovementDetailsOpen, setIsMovementDetailsOpen] = React.useState(false);
  const [productStockMap, setProductStockMap] = React.useState<Record<string, number>>({});
  const [productSummaryMap, setProductSummaryMap] = React.useState<Record<string, ProductSummary>>(
    {}
  );

  // Load categories
  React.useEffect(() => {
    if (activeOrgId) {
      categoriesService.getCategories(activeOrgId).then(setCategoryTree);
    }
  }, [activeOrgId]);

  // Load custom field definitions
  React.useEffect(() => {
    if (activeOrgId) {
      customFieldsService
        .getFieldDefinitions(activeOrgId)
        .then(setCustomFieldDefinitions)
        .catch((error) => {
          console.error("Failed to load custom field definitions:", error);
        });
    }
  }, [activeOrgId]);

  // Load stock levels for all products
  React.useEffect(() => {
    if (activeOrgId && products.length > 0) {
      const loadStockLevels = async () => {
        try {
          const stockLevels = await stockMovementsService.getInventoryLevels(activeOrgId);
          const stockMap: Record<string, number> = {};

          stockLevels.forEach((stock) => {
            const key = stock.product_id;
            if (!stockMap[key]) {
              stockMap[key] = 0;
            }
            stockMap[key] += stock.available_quantity || 0;
          });

          setProductStockMap(stockMap);
        } catch (error) {
          console.error("Failed to load stock levels:", error);
        }
      };
      loadStockLevels();
    }
  }, [activeOrgId, products]);

  // Load product summaries for all products (on-demand loading)
  React.useEffect(() => {
    if (activeOrgId && products.length > 0) {
      // Load summaries for products that don't have them yet
      products.forEach((product) => {
        if (product.product_type === "goods" && product.track_inventory) {
          loadProductSummary(product.id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, products]);

  // Load custom field values for all products
  React.useEffect(() => {
    if (products.length > 0) {
      const loadAllCustomFields = async () => {
        const valuesMap: Record<string, CustomFieldValue[]> = {};
        for (const product of products) {
          try {
            const values = await customFieldsService.getProductFieldValues(product.id);
            valuesMap[product.id] = values;
          } catch (error) {
            console.error(`Failed to load custom fields for product ${product.id}:`, error);
          }
        }
        setCustomFieldValuesMap(valuesMap);
      };
      loadAllCustomFields();
    }
  }, [products]);

  const columns: ColumnConfig<ProductWithDetails>[] = [
    {
      key: "name",
      header: t("basicInfo.name"),
      sortable: true,
      filterType: "text",
      isPrimary: true,
      showInMobile: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10b981]/10">
            <Package className="h-5 w-5 text-[#10b981]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{value}</span>
              {row.product_type === "item_group" && (
                <Badge variant="secondary" className="text-xs">
                  Group
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{row.sku && `SKU: ${row.sku}`}</div>
          </div>
        </div>
      ),
      renderSidebar: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.sku && <div className="text-xs text-muted-foreground">SKU: {row.sku}</div>}
        </div>
      ),
    },
    {
      key: "product_type",
      header: t("basicInfo.productType"),
      sortable: true,
      filterType: "select",
      filterOptions: [
        { label: t("productType.goods"), value: "goods" },
        { label: t("productType.service"), value: "service" },
        { label: t("productType.itemGroup"), value: "item_group" },
      ],
      showInMobile: true,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {value === "goods"
            ? t("productType.goods")
            : value === "service"
              ? t("productType.service")
              : t("productType.itemGroup")}
        </Badge>
      ),
    },
    {
      key: "selling_price",
      header: t("salesInfo.sellingPrice"),
      sortable: true,
      filterType: "number-range",
      showInMobile: true,
      render: (value) => (
        <div className="text-sm font-medium">{value?.toFixed(2) || "0.00"} PLN</div>
      ),
    },
    {
      key: "cost_price",
      header: t("purchaseInfo.costPrice"),
      sortable: true,
      filterType: "number-range",
      render: (value) => <div className="text-sm">{value?.toFixed(2) || "0.00"} PLN</div>,
    },
    {
      key: "opening_stock",
      header: t("inventorySettings.openingStock"),
      sortable: true,
      filterType: "number-range",
      render: (value, row) =>
        row.product_type === "goods" && row.track_inventory ? (
          <div className="text-sm">
            {value || 0} {row.unit}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterType: "select",
      filterOptions: [
        { label: t("status.active"), value: "active" },
        { label: t("status.inactive"), value: "inactive" },
        { label: t("status.archived"), value: "archived" },
      ],
      showInMobile: true,
      render: (value) => (
        <Badge
          variant={
            value === "active" ? "default" : value === "inactive" ? "secondary" : "destructive"
          }
          className="text-xs"
        >
          {t(`status.${value}`)}
        </Badge>
      ),
    },
  ];

  // Load product summary data
  const loadProductSummary = React.useCallback(
    async (productId: string) => {
      if (!activeOrgId) return;

      try {
        const result = await getProductSummary(productId, activeOrgId);
        if (result.data) {
          setProductSummaryMap((prev) => ({
            ...prev,
            [productId]: result.data!,
          }));
        }
      } catch (error) {
        console.error("Failed to load product summary:", error);
      }
    },
    [activeOrgId]
  );

  const findCategoryPath = (tree: CategoryTreeItem[], categoryId: string): ProductCategory[] => {
    for (const category of tree) {
      if (category.id === categoryId) {
        return [category];
      }
      if (category.children) {
        const path = findCategoryPath(category.children, categoryId);
        if (path.length > 0) {
          return [category, ...path];
        }
      }
    }
    return [];
  };

  const renderBreadcrumbs = (category: ProductCategory | null | undefined) => {
    if (!category) {
      return <div className="text-xs text-muted-foreground">{t("noCategoryAssigned")}</div>;
    }

    const breadcrumbs = findCategoryPath(categoryTree, category.id);

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage className="text-xs">{crumb.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="text-xs"
                    href={`/dashboard/warehouse/products?category=${crumb.id}`}
                  >
                    {crumb.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  // Custom detail panel renderer - PROPER InFlow/Zoho style
  const renderDetail = (product: ProductWithDetails, onClose: () => void) => {
    const productSummary = productSummaryMap[product.id] || {
      quantity_on_hand: 0,
      reserved_quantity: 0,
      available_quantity: 0,
    };

    return (
      <div className="flex h-full flex-col">
        {/* Header - Product name with badges and actions */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#0066CC]">{product.name}</h1>
              {product.returnable_item && (
                <Badge variant="outline" className="text-xs">
                  Returnable Item
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Adjust Stock</DropdownMenuItem>
                  {onDelete && (
                    <DropdownMenuItem className="text-red-600" onClick={() => onDelete(product)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {renderBreadcrumbs(product.category)}
        </div>

        {/* Tabs - InFlow rounded pill style */}
        <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden bg-white">
          <div className="border-b px-6 py-3">
            <TabsList className="h-auto rounded-full bg-transparent p-0">
              <TabsTrigger
                value="overview"
                className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
              >
                Transactions
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-full data-[state=active]:bg-[#0066CC] data-[state=active]:text-white"
              >
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab - InFlow layout with image and 2-column grid */}
          <TabsContent value="overview" className="flex-1 overflow-auto bg-white p-6">
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {/* Left Column: Image + Brand + Manufacturer + Description */}
              <div className="space-y-4">
                {/* Product Image */}
                <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed bg-muted/30">
                  <div className="text-center">
                    <Package className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Drag image(s) here or</p>
                    <button className="mt-1 text-sm text-[#0066CC] hover:underline">
                      Browse images
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      You can add up to 15 images, each not exceeding 5 MB
                    </p>
                  </div>
                </div>

                {/* Brand */}
                {product.brand && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Brand</div>
                    <div className="text-sm">{product.brand}</div>
                  </div>
                )}

                {/* Manufacturer */}
                {product.manufacturer && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Manufacturer
                    </div>
                    <div className="text-sm">{product.manufacturer}</div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Description</div>
                  <Textarea
                    value={product.description || ""}
                    readOnly
                    className="min-h-[100px] resize-none text-sm"
                    placeholder="No description"
                  />
                </div>
              </div>

              {/* Right Column: Product Information */}
              <div className="space-y-6">
                {/* Product Information - 2 columns side by side like InFlow */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  {/* Column 1 */}
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">SKU</div>
                      <div className="text-sm">{product.sku || "—"}</div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Barcode</div>
                      {product.barcodes && product.barcodes.length > 0 ? (
                        <>
                          <div className="space-y-1">
                            {product.barcodes.map((barcode, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <code className="font-mono">{barcode.barcode}</code>
                                {barcode.is_primary && (
                                  <Badge variant="outline" className="text-xs">
                                    Primary
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          <button className="mt-1 text-xs text-[#0066CC] hover:underline">
                            Manage barcodes
                          </button>
                        </>
                      ) : (
                        <button className="mt-1 flex items-center gap-1 text-xs text-[#0066CC] hover:underline">
                          <Plus className="h-3 w-3" />
                          Add barcode
                        </button>
                      )}
                    </div>

                    {product.dimensions_length && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          Dimensions
                        </div>
                        <div className="text-sm">
                          {product.dimensions_length} × {product.dimensions_width} ×{" "}
                          {product.dimensions_height} {product.dimensions_unit}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.weight && `${product.weight} ${product.weight_unit}`}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Unit</div>
                      <div className="text-sm">{product.unit}</div>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-4">
                    {product.upc && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">UPC</div>
                        <div className="text-sm">{product.upc}</div>
                      </div>
                    )}

                    {product.ean && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">EAN</div>
                        <div className="text-sm">{product.ean}</div>
                      </div>
                    )}

                    {product.mpn && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">MPN</div>
                        <div className="text-sm">{product.mpn}</div>
                      </div>
                    )}

                    {product.isbn && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">ISBN</div>
                        <div className="text-sm">{product.isbn}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Fields - InFlow Style with Inline Editing */}
                {customFieldDefinitions.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold">{t("customFields.title")}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomFieldsProduct(product);
                          setIsCustomFieldsDialogOpen(true);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        {t("customFields.manageCustomFields")}
                      </Button>
                    </div>
                    <CustomFieldsInlineEditor
                      productId={product.id}
                      fieldDefinitions={customFieldDefinitions}
                      fieldValues={customFieldValuesMap[product.id] || []}
                      onValueChange={async (fieldId, value) => {
                        try {
                          await customFieldsService.setFieldValue({
                            product_id: product.id,
                            field_definition_id: fieldId,
                            value,
                          });
                          // Reload values
                          const values = await customFieldsService.getProductFieldValues(
                            product.id
                          );
                          setCustomFieldValuesMap((prev) => ({
                            ...prev,
                            [product.id]: values,
                          }));
                        } catch (error) {
                          console.error("Failed to save custom field value:", error);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Quantity Cards - 2x2 Grid with blue background */}
                {product.product_type === "goods" && product.track_inventory && (
                  <div className="rounded-lg bg-[#0066CC] p-6">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Quantity on hand */}
                      <div className="rounded-lg bg-white/10 p-4 text-white backdrop-blur">
                        <div className="mb-1 text-xs opacity-90">Qty</div>
                        <div className="text-sm font-medium">On Hand</div>
                        <div className="mt-2 text-3xl font-bold">
                          {productSummary.quantity_on_hand}
                        </div>
                      </div>

                      {/* Reserved */}
                      <div className="rounded-lg bg-white/10 p-4 text-white backdrop-blur">
                        <div className="mb-1 text-xs opacity-90">Qty</div>
                        <div className="text-sm font-medium">Reserved</div>
                        <div className="mt-2 text-3xl font-bold">
                          {productSummary.reserved_quantity}
                        </div>
                      </div>

                      {/* To be Invoiced */}
                      <div className="rounded-lg bg-white/10 p-4 text-white backdrop-blur">
                        <div className="mb-1 text-xs opacity-90">Qty</div>
                        <div className="text-sm font-medium">To be Invoiced</div>
                        <div className="mt-2 text-3xl font-bold">0</div>
                      </div>

                      {/* To be Billed */}
                      <div className="rounded-lg bg-white/10 p-4 text-white backdrop-blur">
                        <div className="mb-1 text-xs opacity-90">Qty</div>
                        <div className="text-sm font-medium">To be Billed</div>
                        <div className="mt-2 text-3xl font-bold">0</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stock by Location */}
                {product.product_type === "goods" && product.track_inventory && (
                  <ProductLocationBreakdown productId={product.id} organizationId={activeOrgId} />
                )}

                {/* Pricing & Cost - Clean layout like Zoho */}
                <div>
                  <h3 className="mb-4 text-base font-semibold">Pricing & Cost</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Selling Price</div>
                      <div className="text-2xl font-semibold text-green-600">
                        {product.selling_price?.toFixed(2) || "0.00"} PLN
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Cost Price</div>
                      <div className="text-2xl font-semibold">
                        {product.cost_price?.toFixed(2) || "0.00"} PLN
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reorder Settings */}
                {product.product_type === "goods" && product.track_inventory && (
                  <div>
                    <h3 className="mb-4 text-base font-semibold">Reorder Settings</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Reorder Point</span>
                        <span className="text-sm font-medium">
                          {product.reorder_point || 0} {product.unit}
                        </span>
                      </div>
                      {product.reorder_point && (
                        <div className="rounded-lg bg-amber-50 p-3">
                          <div className="text-sm text-amber-900">
                            {(productStockMap[product.id] || 0) < product.reorder_point ? (
                              <>
                                <span className="font-semibold">Reorder needed:</span> Order at
                                least {product.reorder_point - (productStockMap[product.id] || 0)}{" "}
                                {product.unit} to reach reorder point
                              </>
                            ) : (
                              <>
                                <span className="font-semibold">Stock level OK:</span> Current stock
                                is above reorder point
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="flex-1 overflow-auto p-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowRightLeft className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-1 text-sm font-medium">No transactions yet</h3>
              <p className="text-xs text-muted-foreground">
                Product transactions will appear here once you start managing inventory
              </p>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-auto">
            <MovementHistoryList
              filters={{ product_id: product.id }}
              maxHeight="600px"
              onMovementClick={(movement) => {
                setSelectedMovement(movement);
                setIsMovementDetailsOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <>
      {/* {onAddProductGroup && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onAddProductGroup}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createProductGroup")}
          </Button>
        </div>
      )} */}
      <AdvancedDataTable
        data={products}
        columns={columns}
        loading={loading}
        error={error}
        emptyMessage={t("noProductsFound")}
        getRowId={(row) => row.id}
        renderDetail={renderDetail}
        selectable={false}
        showSearch={true}
        searchPlaceholder={t("filters.search")}
        responsive={true}
        onAdd={onAdd}
        onAddProductGroup={onAddProductGroup}
        onRowClick={(product) => {
          // If it's an item_group, navigate to the product group detail page
          if (product.product_type === "item_group") {
            router.push(`/dashboard/warehouse/products/groups/${product.id}`);
          }
          // Otherwise, the default detail panel will open
        }}
      />

      {customFieldsProduct && (
        <ManageCustomFieldsDialog
          open={isCustomFieldsDialogOpen}
          onOpenChange={setIsCustomFieldsDialogOpen}
          product={customFieldsProduct}
          onSave={async () => {
            // Reload custom field definitions for the organization
            try {
              const definitions = await customFieldsService.getFieldDefinitions(activeOrgId);
              setCustomFieldDefinitions(definitions);
            } catch (error) {
              console.error("Failed to reload custom field definitions:", error);
            }

            // Reload custom field values for this product
            try {
              const values = await customFieldsService.getProductFieldValues(
                customFieldsProduct.id
              );
              setCustomFieldValuesMap((prev) => ({
                ...prev,
                [customFieldsProduct.id]: values,
              }));
            } catch (error) {
              console.error("Failed to reload custom field values:", error);
            }
          }}
        />
      )}

      {selectedMovement && (
        <MovementDetailsModal
          movement={selectedMovement}
          open={isMovementDetailsOpen}
          onOpenChange={setIsMovementDetailsOpen}
        />
      )}
    </>
  );
}

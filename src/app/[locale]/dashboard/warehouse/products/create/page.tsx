// src/app/[locale]/dashboard/warehouse/products/create/page.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { TemplateBasedProductForm } from "@/modules/warehouse/products/components/template-based-product-form";

export default function CreateProductPage() {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = React.useState(true);

  const handleSuccess = () => {
    router.push("/dashboard/warehouse/products");
  };

  const handleClose = () => {
    router.push("/dashboard/warehouse/products");
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Utwórz nowy produkt</h1>
            <p className="text-muted-foreground">
              Wybierz szablon i utwórz produkt z predefiniowanymi atrybutami
            </p>
          </div>
        </div>
      </div>

      {/* Template-based Product Form */}
      <TemplateBasedProductForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) handleClose();
        }}
        onSuccess={handleSuccess}
      />

      {/* Fallback content */}
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Formularz tworzenia produktu zostanie wyświetlony w oknie dialogowym.
        </p>
        <Button onClick={() => setIsFormOpen(true)} className="mt-4">
          Otwórz formularz ponownie
        </Button>
      </div>
    </motion.div>
  );
}

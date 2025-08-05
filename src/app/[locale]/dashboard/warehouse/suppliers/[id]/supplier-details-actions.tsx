"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Package, Edit } from "lucide-react";
import { SupplierWithContacts } from "@/modules/warehouse/suppliers/api";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import { useRouter } from "next/navigation";

interface SupplierDetailsActionsProps {
  supplier: SupplierWithContacts;
}

export function SupplierDetailsActions({ supplier }: SupplierDetailsActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline">
          <Package className="mr-2 h-4 w-4" />
          Produkty dostawcy
        </Button>
        <Button onClick={() => setEditDialogOpen(true)}>
          <Edit className="mr-2 h-4 w-4" />
          Edytuj dostawcę
        </Button>
      </div>

      <NewSupplierFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={supplier}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}

"use client";

import { useRouter, useParams } from "next/navigation";
import { WYSIWYGLabelCreator } from "@/modules/warehouse/components/labels/WYSIWYGLabelCreator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const handleTemplateSaved = () => {
    router.push("/dashboard/warehouse/labels/templates");
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Edytuj Szablon Etykiety</h1>
          <p className="text-muted-foreground">Dostosuj szablon etykiety QR do swoich potrzeb</p>
        </div>
      </div>

      {/* WYSIWYG Label Creator */}
      <WYSIWYGLabelCreator templateId={templateId} onSaved={handleTemplateSaved} />
    </div>
  );
}

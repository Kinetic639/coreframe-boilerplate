import React from "react";
import { generatePublicMetadata, MetadataProps } from "@/lib/metadata";
import FeaturesClient from "./features-client";

export async function generateMetadata({ params }: MetadataProps) {
  return generatePublicMetadata(params, "metadata.public.features", [
    "features",
    "SaaS features",
    "warehouse management features",
    "inventory tracking",
    "business management tools",
    "enterprise features",
    "QR codes",
    "audit system",
    "user management",
    "funkcje",
    "zarządzanie magazynem",
    "śledzenie zapasów",
  ]);
}

export default function FeaturesPage() {
  return <FeaturesClient />;
}

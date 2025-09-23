import React from "react";
import Pricing from "./pricing";
import { generatePublicMetadata, MetadataProps } from "@/lib/metadata";

export async function generateMetadata({ params }: MetadataProps) {
  return generatePublicMetadata(params, "metadata.public.pricing", [
    "pricing",
    "SaaS pricing",
    "enterprise plans",
    "warehouse management pricing",
    "business software cost",
    "CoreFrame pricing",
    "cennik",
    "opłaty SaaS",
    "plany enterprise",
  ]);
}

const page = () => {
  return <Pricing />;
};

export default page;

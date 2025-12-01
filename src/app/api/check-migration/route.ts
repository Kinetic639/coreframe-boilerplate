import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const tablesToCheck = [
    "products",
    "product_barcodes",
    "product_custom_field_definitions",
    "product_custom_field_values",
    "product_variants",
    "product_categories",
    "variant_option_groups",
    "variant_option_values",
    "product_images",
  ];

  const results: Record<string, boolean> = {};

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase.from(table).select("*").limit(1);

      results[table] = !error || error.code !== "42P01";
    } catch {
      results[table] = false;
    }
  }

  const allTablesExist = Object.values(results).every((exists) => exists);

  return NextResponse.json({
    success: allTablesExist,
    tables: results,
    message: allTablesExist
      ? "Migration applied successfully - all tables exist"
      : "Migration not yet applied - some tables missing",
  });
}

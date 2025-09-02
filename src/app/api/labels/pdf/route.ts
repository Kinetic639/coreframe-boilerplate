import { NextRequest, NextResponse } from "next/server";

// WAŻNE: wymuszamy Node.js runtime dla Puppeteer
export const runtime = "nodejs";
export const maxDuration = 60; // 60 sekund timeout dla generowania PDF

import { renderLabelsHtml } from "@/lib/labels/html";
import { htmlToPdfBuffer, validatePDFEnvironment } from "@/lib/labels/pdf";
import { GeneratePdfPayload, PAGE_PRESETS } from "@/lib/labels/types";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GeneratePdfPayload;

    // Walidacja payload
    if (!payload.template || !payload.data || !payload.pagePreset) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: template, data, pagePreset",
        },
        { status: 400 }
      );
    }

    if (payload.data.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No label data provided",
        },
        { status: 400 }
      );
    }

    // Konwertuj na PDF template z zachowaniem wszystkich opcji
    const pdfTemplate = {
      ...payload.template,
      // Domyślne wartości dla PDF jeśli nie podane
      bleedMm: payload.template.bleedMm || 0,
      safeAreaMm: payload.template.safeAreaMm || 2,
      font_family: payload.fontFamily || payload.template.font_family || "Inter",
      embed_fonts: payload.embedFonts !== undefined ? payload.embedFonts : true,
      debug_grid: payload.debug || false,
    };

    // Logowanie dla debugowania
    console.log(`Generating PDF for template: ${pdfTemplate.name}`);
    console.log(`Labels count: ${payload.data.length}`);
    console.log(`Page preset: ${payload.pagePreset.kind}`);
    console.log(`Template fields count: ${pdfTemplate.fields?.length || 0}`);
    console.log(`Template fields:`, pdfTemplate.fields);

    // Generuj HTML z pełną kompatybilnością z kreatorem
    const html = await renderLabelsHtml({
      ...payload,
      template: pdfTemplate,
    });

    // Określ rozmiar strony dla PDF
    const pageSizeMm =
      payload.pagePreset.kind === "roll"
        ? { w: pdfTemplate.width_mm, h: pdfTemplate.height_mm }
        : undefined;

    // Generuj PDF
    const pdfBuffer = await htmlToPdfBuffer(html, {
      pageSizeMm,
      debug: payload.debug,
    });

    // Nazwa pliku z informacjami o template
    const filename = `${pdfTemplate.name || "etykiety"}_${payload.data.length}_${Date.now()}.pdf`;

    // Opcjonalnie: zapisz batch do bazy danych dla przyszłego użytku
    if (payload.template.organization_id) {
      await saveLabelBatch(pdfTemplate, payload, filename);
    }

    // Zwróć PDF jako response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Labels-Generated": payload.data.length.toString(),
        "X-Template-ID": pdfTemplate.id,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    // Szczegółowe logowanie błędów
    const errorMessage = error instanceof Error ? error.message : "Unknown PDF generation error";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("Error details:", { errorMessage, stack });

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === "development" && { stack }),
      },
      { status: 500 }
    );
  }
}

// Endpoint diagnostyczny
export async function GET() {
  try {
    const validation = await validatePDFEnvironment();
    const presets = Object.keys(PAGE_PRESETS);

    return NextResponse.json({
      ok: true,
      environment: {
        runtime: "nodejs",
        canGeneratePDF: validation.canGenerate,
        chromiumPath: validation.chromiumPath,
        errors: validation.errors,
      },
      availablePresets: presets,
      supportedFormats: ["A4", "Roll", "Custom"],
      maxLabelsPerBatch: 1000,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Environment check failed",
      },
      { status: 500 }
    );
  }
}

// Zapisz batch do bazy danych (opcjonalne)
async function saveLabelBatch(template: any, payload: GeneratePdfPayload, filename: string) {
  try {
    const supabase = createClient();

    const batchData = {
      batch_name: `${template.name}_${new Date().toISOString().split("T")[0]}`,
      template_id: template.id,
      labels_count: payload.data.length,
      page_preset: payload.pagePreset,
      pdf_template: template, // Zapisz użyty template
      labels_data: payload.data.slice(0, 10), // Pierwsze 10 dla przykładu
      generated_filename: filename,
      organization_id: template.organization_id,
      branch_id: template.branch_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("label_batches_extended").insert(batchData);

    if (error) {
      console.warn("Failed to save label batch:", error);
    } else {
      console.log("Label batch saved successfully");
    }
  } catch (error) {
    console.warn("Label batch save error:", error);
    // Nie przerywamy generowania PDF z powodu błędu zapisu
  }
}

// Endpoint do testowania z przykładowymi danymi
export async function PUT(request: NextRequest) {
  try {
    const { templateId } = await request.json();

    // Przykładowe dane testowe
    const testPayload: GeneratePdfPayload = {
      template: {
        id: templateId || "test-template",
        name: "Test Template",
        width_mm: 100,
        height_mm: 50,
        background_color: "#FFFFFF",
        text_color: "#000000",
        border_enabled: true,
        border_width: 0.5,
        border_color: "#000000",
        qr_position: "left",
        qr_size_mm: 20,
        show_additional_info: true,
        label_padding_top: 2,
        label_padding_right: 2,
        label_padding_bottom: 2,
        label_padding_left: 2,
        label_type: "product",
        fields: [
          {
            id: "field1",
            label_template_id: templateId || "test-template",
            field_type: "text",
            field_name: "Nazwa produktu",
            field_value: "{name}",
            position_x: 25,
            position_y: 10,
            width_mm: 70,
            height_mm: 8,
            font_size: 12,
            font_weight: "bold",
            text_align: "left",
            vertical_align: "center",
            text_color: "#000000",
            background_color: "transparent",
            sort_order: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "field2",
            label_template_id: templateId || "test-template",
            field_type: "text",
            field_name: "SKU",
            field_value: "SKU: {sku}",
            position_x: 25,
            position_y: 25,
            width_mm: 70,
            height_mm: 6,
            font_size: 10,
            text_align: "left",
            vertical_align: "center",
            text_color: "#666666",
            background_color: "transparent",
            sort_order: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
      data: [
        { name: "Test Product 1", sku: "TST001", qr: "https://example.com/product/1" },
        { name: "Test Product 2", sku: "TST002", qr: "https://example.com/product/2" },
        { name: "Test Product 3", sku: "TST003", qr: "https://example.com/product/3" },
      ],
      pagePreset: PAGE_PRESETS.ROLL_100x50,
      fontFamily: "Inter",
      embedFonts: true,
      debug: true,
    };

    // Przekieruj na POST
    const response = await POST(
      new NextRequest(request.url, {
        method: "POST",
        body: JSON.stringify(testPayload),
        headers: { "Content-Type": "application/json" },
      })
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Test PDF generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

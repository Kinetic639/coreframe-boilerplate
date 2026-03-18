// PDF generation using Puppeteer with precise mm dimensions

interface PDFOptions {
  pageSizeMm?: { w: number; h: number };
  debug?: boolean;
}

export async function htmlToPdfBuffer(html: string, options: PDFOptions = {}): Promise<Buffer> {
  const isProduction = process.env.NODE_ENV === "production";

  // Dynamic imports dla serverless compatibility
  const chromium = isProduction ? await import("@sparticuz/chromium") : null;
  const puppeteer = isProduction ? await import("puppeteer-core") : await import("puppeteer");

  let browser;

  try {
    // Configure browser launch based on environment
    if (isProduction && chromium) {
      // Production/serverless environment
      const execPath = await (chromium as any).executablePath();
      browser = await puppeteer.default.launch({
        args: [
          ...(chromium as any).args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--hide-scrollbars",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        defaultViewport: (chromium as any).defaultViewport,
        executablePath: execPath,
        headless: (chromium as any).headless,
        // ignoreHTTPSErrors: true,
      });
    } else {
      // Development environment - use full puppeteer
      browser = await puppeteer.default.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
        // ignoreHTTPSErrors: true,
      });
    }

    const page = await browser.newPage();

    // Ustawienia strony dla dokładnego renderowania
    await page.setContent(html, {
      waitUntil: ["networkidle0", "load", "domcontentloaded"],
      timeout: 30000,
    });

    // Poczekaj na załadowanie wszystkich obrazów (QR kody, kody kreskowe)
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                // Timeout dla obrazów
                setTimeout(reject, 5000);
              })
          )
      );
    });

    // Opcje PDF z dokładnymi wymiarami
    const pdfOptions: any = {
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      preferCSSPageSize: true, // Używa @page z CSS
      omitBackground: false,
      tagged: false, // Wyłącz accessibility tags dla mniejszego rozmiaru
    };

    // Dla trybu „roll" (1 etykieta = 1 strona) ustaw jawny rozmiar
    if (options.pageSizeMm) {
      const { w, h } = options.pageSizeMm;
      // Konwersja mm na cale (1 cal = 25.4mm)
      pdfOptions.width = `${(w / 25.4).toFixed(3)}in`;
      pdfOptions.height = `${(h / 25.4).toFixed(3)}in`;

      // Wyłącz preferCSSPageSize gdy ustawiamy jawny rozmiar
      pdfOptions.preferCSSPageSize = false;
    }

    // Debug: zrób screenshot przed generowaniem PDF
    if (options.debug) {
      try {
        await page.screenshot({
          path: `/tmp/label-debug-${Date.now()}.png`,
          fullPage: true,
          omitBackground: false,
        });
      } catch (error) {
        console.warn("Debug screenshot failed:", error);
      }
    }

    // Generuj PDF
    const pdf = await page.pdf(pdfOptions);

    return pdf;
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn("Browser close error:", closeError);
      }
    }
  }
}

// Wrapper dla różnych formatów wyjściowych
export async function generateLabelsPDF(
  html: string,
  options: PDFOptions & {
    filename?: string;
    returnType?: "buffer" | "base64" | "stream";
  } = {}
): Promise<Buffer | string> {
  const { returnType = "buffer", ...pdfOptions } = options;

  const pdfBuffer = await htmlToPdfBuffer(html, pdfOptions);

  switch (returnType) {
    case "base64":
      return pdfBuffer.toString("base64");
    case "buffer":
    default:
      return pdfBuffer;
  }
}

// Helpery do testowania i debugowania
export async function generateTestPDF(
  template: any,
  testData: any[] = [{ name: "Test Label", qr: "https://example.com/test" }]
): Promise<Buffer> {
  // Najprostszy możliwy HTML dla testów
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: ${template.width_mm}mm ${template.height_mm}mm; margin: 0; }
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .label { 
      width: ${template.width_mm}mm; 
      height: ${template.height_mm}mm; 
      border: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
    }
  </style>
</head>
<body>
  <div class="label">
    <div>
      <h3>Test Label</h3>
      <p>Size: ${template.width_mm}×${template.height_mm}mm</p>
      <p>Data: ${JSON.stringify(testData[0])}</p>
    </div>
  </div>
</body>
</html>
  `;

  return await htmlToPdfBuffer(testHtml, {
    pageSizeMm: { w: template.width_mm, h: template.height_mm },
    debug: true,
  });
}

// Validate PDF generation environment
export async function validatePDFEnvironment(): Promise<{
  canGenerate: boolean;
  errors: string[];
  chromiumPath?: string;
}> {
  const errors: string[] = [];
  let canGenerate = true;
  let chromiumPath: string | undefined;

  try {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      // Production validation
      const chromium = await import("@sparticuz/chromium");
      chromiumPath = await (chromium as any).executablePath();

      const puppeteer = await import("puppeteer-core");
      const browser = await puppeteer.default.launch({
        args: (chromium as any).args,
        executablePath: chromiumPath,
        headless: true,
      });
      await browser.close();
    } else {
      // Development validation
      chromiumPath = "system";
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        args: ["--no-sandbox"],
        headless: true,
      });
      await browser.close();
    }
  } catch (error) {
    canGenerate = false;
    errors.push(
      `Chromium/Puppeteer error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // Check required dependencies
  try {
    await import("@sparticuz/chromium");
  } catch {
    errors.push("@sparticuz/chromium not installed");
    canGenerate = false;
  }

  try {
    await import("puppeteer-core");
  } catch {
    errors.push("puppeteer-core not installed");
    canGenerate = false;
  }

  return {
    canGenerate,
    errors,
    chromiumPath,
  };
}

// Optymalizacje dla różnych środowisk
export function getOptimizedPDFOptions(environment: "local" | "vercel" | "serverless" = "local") {
  const baseOptions = {
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  };

  switch (environment) {
    case "vercel":
    case "serverless":
      return {
        ...baseOptions,
        // Optymalizacje dla serverless
        omitBackground: false,
        tagged: false, // Mniejszy rozmiar pliku
      };
    case "local":
    default:
      return {
        ...baseOptions,
        // Pełna jakość dla developmentu
        tagged: true,
      };
  }
}

// Memory management dla długich sesji
export async function generateMultiPagePDF(
  htmlPages: string[],
  options: PDFOptions = {}
): Promise<Buffer> {
  if (htmlPages.length === 0) {
    throw new Error("No HTML pages provided");
  }

  if (htmlPages.length === 1) {
    return await htmlToPdfBuffer(htmlPages[0], options);
  }

  // Dla wielu stron - połącz HTML i generuj jeden PDF
  const combinedHtml = htmlPages.join('<div style="page-break-before: always;"></div>');
  return await htmlToPdfBuffer(combinedHtml, options);
}

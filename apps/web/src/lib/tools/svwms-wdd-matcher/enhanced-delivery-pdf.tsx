import { Document, Page, Text, View, StyleSheet, Font, Svg, Path, pdf } from "@react-pdf/renderer";
import type { PdfBlockData } from "@/server/services/wdd-matcher.service";

let _fontsRegistered = false;
function ensureFonts() {
  if (_fontsRegistered) return;
  const base = `${window.location.origin}/api/fonts`;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${base}?name=Roboto-Regular.ttf`, fontWeight: 400 },
      { src: `${base}?name=Roboto-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  _fontsRegistered = true;
}

const S = StyleSheet.create({
  page: {
    position: "relative",
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 8,
    paddingTop: 18,
    paddingBottom: 40,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    color: "#000000",
  },

  documentTitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 20,
    textAlign: "center",
    marginBottom: 4,
  },
  documentSubtitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 18,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#808080",
    paddingTop: 6,
    marginBottom: 12,
  },

  block: {
    marginBottom: 9,
  },

  header: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#9a9a9a",
  },
  headerOrderTitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 2,
    borderWidth: 1,
    borderBottomStyle: "solid",
    borderColor: "#9a9a9a",
    marginBottom: 4,
  },
  headerGrid: {
    flexDirection: "row",
    minHeight: 62,
  },
  headerGridLeft: {
    width: "23.5%",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  headerGridMiddle: {
    width: "47.5%",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
  },
  headerGridRight: {
    width: "29%",
  },
  headerGridTop: {
    minHeight: 40,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#9a9a9a",
  },
  headerGridBottom: {
    minHeight: 20,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  headerSplitRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#9a9a9a",
  },
  headerSplitCell: {
    width: "50%",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
  },
  headerSplitCellLast: {
    width: "50%",
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  transferIcon: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    backgroundColor: "#000000",
  },
  transferIconSlash: {
    position: "absolute",
    top: 3,
    left: 1,
    width: 20,
    height: 3,
    backgroundColor: "#ffffff",
    transform: "rotate(35deg)",
  },
  headerLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  headerBottomLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#9a9a9a",
    minHeight: 16,
  },
  headerTitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 8.5,
    textAlign: "center",
  },
  headerText: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7.2,
  },
  headerRight: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7.2,
    textAlign: "right",
  },
  headerStrong: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 10,
  },
  primaryIdBox: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingTop: 8,
  },
  primaryIdRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  primaryIdPrefix: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    marginBottom: 4,
  },
  primaryIdNumber: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 26,
    lineHeight: 1,
  },
  primaryIdSuffix: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    marginBottom: 4,
  },
  primaryIdFallback: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 19,
    lineHeight: 1.1,
    textAlign: "center",
  },
  primaryIdNote: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    marginTop: 3,
    textAlign: "center",
  },
  headerClient: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 14,
  },
  headerOrderNumber: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  headerLeftCol: {
    width: "24%",
  },
  headerMidCol: {
    width: "48%",
    textAlign: "center",
  },
  headerRightCol: {
    width: "28%",
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    gap: 2,
  },
  metaLabel: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 8,
  },
  metaValue: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 8,
  },
  tableHead: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "#9a9a9a",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#9a9a9a",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#9a9a9a",
    marginTop: 3,
    backgroundColor: "#f0f0f0",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "#9a9a9a",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#9a9a9a",
  },
  tableCell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
  },
  tableCellCenter: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
    textAlign: "center",
  },
  tableCellRight: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#9a9a9a",
    textAlign: "right",
  },
  headText: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 6.3,
  },
  cellText: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 6.8,
  },
  cellTextRight: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 6.8,
    textAlign: "right",
  },
  noLines: {
    fontFamily: "Roboto",
    fontWeight: 400,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 8,
  },

  checkbox: {
    width: 7,
    height: 7,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#000000",
    marginTop: 1,
  },
  filledCheckbox: {
    width: 9,
    height: 9,
    backgroundColor: "#000000",
  },

  colCheck: { width: "3.5%" },
  colLp: { width: "4.5%" },
  colCat: { width: "17.5%" },
  colName: { width: "30%" },
  colIz: { width: "6.5%" },
  colIw: { width: "6.5%" },
  colIr: { width: "6.5%" },
  colInz: { width: "6.5%" },
  colLocation: { width: "15%" },
  colIdp: { width: "8%" },
  colOp: { width: "3%" },

  pageNumber: {
    fontFamily: "Roboto",
    fontWeight: 400,
    position: "absolute",
    bottom: 14,
    right: 20,
    width: 70,
    height: 12,
    fontSize: 7,
    lineHeight: 1.2,
    textAlign: "right",
  },
  blockFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "#000000",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#000000",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#000000",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#000000",
  },
  footerMatch: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7,
    textAlign: "right",
  },
  footerLink: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    color: "#111111",
    textAlign: "center",
  },
  footerStamp: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerStampText: {
    marginLeft: 5,
  },
  footerStampBrand: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.2,
  },
  footerStampSystem: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 4.5,
    letterSpacing: 1.6,
    marginTop: -1,
    color: "#444444",
  },
});

const MATCH_LABELS: Record<string, string> = {
  exact: "Dokładne",
  subset: "Podzbiór",
  partial: "Częściowe",
  ambiguous: "Niejednoznaczne",
  unmatched_bc: "Brak dopasowania",
  unmatched_brand: "Brak WDD",
};

function formatGeneratedAt(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatDecimal(value: number | null): string {
  if (value === null) return "";
  return value.toFixed(2).replace(".", ",");
}

function bodyShopCode(block: PdfBlockData): string | null {
  const source = block.zwNumber ?? block.zlNumber ?? block.wddNumber;
  const code = source?.match(/\/(\d{3,5})(?:\/[^/]*)?$/)?.[1] ?? source?.split("/").at(-1);
  return code && /^\d{3,5}$/.test(code) ? `D${code}` : null;
}

function documentLabel(block: PdfBlockData): string {
  if (block.documentBrand === "BC") return "Body Center";
  if (block.documentBrand) return `Dealer ${block.documentBrand}`;
  return block.isDirect ? "Body Center" : "Dealer";
}

function documentSubtitle(block: PdfBlockData | undefined): string {
  if (!block) return "";
  const warehouseLabel =
    [block.warehouseCode, block.warehouseLabel ? `(${block.warehouseLabel})` : null]
      .filter(Boolean)
      .join(" ") || null;
  const suffix = block.documentBrand === "BC" ? "\n31 Audi_BC" : "";
  return `${documentLabel(block)}${warehouseLabel ? `; Magazyn ${warehouseLabel}` : ""}${suffix}`;
}

function splitPrimaryId(value: string | null): {
  prefix: string;
  number: string;
  suffix: string;
} | null {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length < 2) return { prefix: "", number: value, suffix: "" };
  return {
    prefix: `${parts[0]}/`,
    number: parts[1] ?? "",
    suffix: parts.length > 2 ? `/${parts.slice(2).join("/")}` : "",
  };
}

function PrimaryIdentifier({ value, note }: { value: string | null; note: string | null }) {
  const split = splitPrimaryId(value);
  if (!split) return null;

  return (
    <View style={S.primaryIdBox}>
      {split.prefix || split.suffix ? (
        <View style={S.primaryIdRow}>
          <Text style={S.primaryIdPrefix}>{split.prefix}</Text>
          <Text style={S.primaryIdNumber}>{split.number}</Text>
          <Text style={S.primaryIdSuffix}>{split.suffix}</Text>
        </View>
      ) : (
        <Text style={S.primaryIdFallback}>{split.number}</Text>
      )}
      {note ? <Text style={S.primaryIdNote}>{note}</Text> : null}
    </View>
  );
}

function PdfFooterStamp() {
  return (
    <View style={S.footerStamp}>
      <Svg width={18} height={18} viewBox="0 0 56 56">
        <Path d="M28 5 L5 53 L16 53 L28 29 Z" fill="#000000" />
        <Path d="M28 5 L51 53 L40 53 L28 29 Z" fill="#000000" />
        <Path d="M28 7.5 L22 20 L28 29 L34 20 Z" fill="#ffffff" />
        <Path
          d="M10.3 29.6 L13.1 33 M42.9 33 L45.7 29.6"
          stroke="#000000"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M14 34 L28 51 L42 34"
          stroke="#000000"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M14.4 34.5 L20.9 42.2 M35.1 42.2 L41.6 34.5"
          stroke="#ffffff"
          strokeWidth={1.45}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={S.footerStampText}>
        <Text style={S.footerStampBrand}>AMBRA</Text>
        <Text style={S.footerStampSystem}>SYSTEM</Text>
      </View>
    </View>
  );
}

function BlockFooter({ block, matchLabel }: { block: PdfBlockData; matchLabel: string }) {
  return (
    <View style={S.blockFooter}>
      <PdfFooterStamp />
      <Text style={S.footerLink}>www.ambra-system.com</Text>
      {!block.isDirect ? (
        <Text style={S.footerMatch}>
          Dopasowanie: {matchLabel} ({block.confidence}%)
        </Text>
      ) : (
        <Text style={S.footerMatch}>Zamówienie bezpośrednie</Text>
      )}
    </View>
  );
}

function BlockCard({ block, generatedAtLabel }: { block: PdfBlockData; generatedAtLabel: string }) {
  const matchLabel = MATCH_LABELS[block.matchType] ?? block.matchType;
  const sectionTitle = block.isDirect
    ? "2. Zamówienie klienta na czesci"
    : "99. Zamówienie WDD KOM_BC";
  const warehouseLabel =
    [block.warehouseCode, block.warehouseLabel ? `(${block.warehouseLabel})` : null]
      .filter(Boolean)
      .join(" ") || null;
  const shopCode = bodyShopCode(block);
  const dealerLine = `${documentLabel(block)}${warehouseLabel ? `; Magazyn ${warehouseLabel}` : ""}`;
  const rightTitle = `${sectionTitle}${shopCode ? ` - Blacharnia ${shopCode}` : ""}`;
  const primaryId = block.zlNumber ?? block.orderNumber ?? block.manualNote;
  const movedBlwk = block.zlNumber ? block.orderNumber : null;
  const primaryNote = block.zlNumber ? block.manualNote : null;

  return (
    <View style={S.block} wrap={false}>
      <Text style={S.headerOrderTitle}>{rightTitle}</Text>

      <View style={S.header}>
        <View style={S.headerGrid}>
          <View style={S.headerGridLeft}>
            <View style={S.transferIcon}>
              <View style={S.transferIconSlash} />
            </View>
            <PrimaryIdentifier value={primaryId} note={primaryNote} />
          </View>

          <View style={S.headerGridMiddle}>
            <View style={S.headerGridTop}>
              <Text style={S.headerClient}>{block.clientName ?? ""}</Text>
            </View>
            <View style={S.headerSplitRow}>
              <View style={S.headerSplitCell}>
                <Text style={S.headerText}>{block.vin ?? ""}</Text>
              </View>
              <View style={S.headerSplitCellLast}>
                <Text style={S.headerText}>{movedBlwk ?? ""}</Text>
              </View>
            </View>
          </View>

          <View style={S.headerGridRight}>
            <View style={S.headerGridTop}>
              <Text style={[S.headerText, { textAlign: "right" }]}>{generatedAtLabel}</Text>
              <Text style={[S.headerStrong, { textAlign: "center", marginTop: 8 }]}>
                {rightTitle}
              </Text>
            </View>
            <View style={S.headerGridBottom}>
              <Text style={S.headerOrderNumber}>{block.zwNumber ?? block.wddNumber ?? ""}</Text>
            </View>
          </View>
        </View>

        <View style={S.headerBottomLine}>
          <Text style={[S.headerText, { marginLeft: "47.5%", width: "52.5%", textAlign: "right" }]}>
            {dealerLine}
            {block.documentBrand ? ` ${block.documentBrand === "BC" ? "31 Audi_BC" : ""}` : ""}
          </Text>
        </View>
      </View>

      {block.lines.length === 0 ? (
        <Text style={S.noLines}>Brak pozycji.</Text>
      ) : (
        <>
          <View style={S.tableHead}>
            <Text style={[S.colCheck, S.tableCellCenter, S.headText]}>L</Text>
            <Text style={[S.colLp, S.tableCellCenter, S.headText]}>Lp</Text>
            <Text style={[S.colCat, S.tableCellCenter, S.headText]}>Nr katalogowy</Text>
            <Text style={[S.colName, S.tableCellCenter, S.headText]}>Nazwa towaru</Text>
            <Text style={[S.colIz, S.tableCellCenter, S.headText]}>IZ</Text>
            <Text style={[S.colIw, S.tableCellCenter, S.headText]}>IW</Text>
            <Text style={[S.colIr, S.tableCellCenter, S.headText]}>IR / ILI</Text>
            <Text style={[S.colInz, S.tableCellCenter, S.headText]}>INZ</Text>
            <Text style={[S.colLocation, S.tableCellCenter, S.headText]}>Lokalizacja</Text>
            <Text style={[S.colIdp, S.tableCellCenter, S.headText]}>IDP</Text>
            <Text style={[S.colOp, S.tableCellCenter, S.headText]}>O</Text>
          </View>
          {block.lines.map((line, i) => (
            <View key={i} style={S.tableRow}>
              <View style={[S.colCheck, S.tableCellCenter]}>
                <View style={S.filledCheckbox} />
              </View>
              <Text style={[S.colLp, S.tableCellCenter, S.cellText]}>{line.lp ?? i + 1}</Text>
              <Text style={[S.colCat, S.tableCell, S.cellText]}>{line.productCode ?? "-"}</Text>
              <Text style={[S.colName, S.tableCell, S.cellText]}>{line.productName ?? ""}</Text>
              <Text style={[S.colIz, S.tableCellRight, S.cellTextRight]}>
                {formatDecimal(line.iz)}
              </Text>
              <Text style={[S.colIw, S.tableCellRight, S.cellTextRight]}>
                {formatDecimal(line.iw)}
              </Text>
              <Text style={[S.colIr, S.tableCellRight, S.cellTextRight]}>
                {formatDecimal(line.ir)}
              </Text>
              <Text style={[S.colInz, S.tableCellRight, S.cellTextRight]}>
                {formatDecimal(line.inz)}
              </Text>
              <Text style={[S.colLocation, S.tableCell, S.cellText]}>{line.location ?? ""}</Text>
              <Text style={[S.colIdp, S.tableCellRight, S.cellTextRight]}>
                {line.idpRaw ?? formatDecimal(line.quantity)}
              </Text>
              <Text style={[S.colOp, S.tableCellRight, S.cellTextRight]}>
                {line.operationCode ?? ""}
              </Text>
            </View>
          ))}
        </>
      )}
      <BlockFooter block={block} matchLabel={matchLabel} />
    </View>
  );
}

export function EnhancedDeliveryDocument({
  blocks,
  sessionName,
  generatedAt = new Date(),
}: {
  blocks: PdfBlockData[];
  sessionName: string;
  generatedAt?: Date;
}) {
  const generatedAtLabel = formatGeneratedAt(generatedAt);
  const subtitle = documentSubtitle(blocks[0]);

  return (
    <Document title={sessionName} author="SVWMS WDD Matcher">
      <Page size="A4" style={S.page}>
        <Text style={S.documentTitle}>DYSPOZYCJA PRZENIESIENIA TOWARÓW</Text>
        {subtitle ? <Text style={S.documentSubtitle}>{subtitle}</Text> : null}
        {blocks.length === 0 ? (
          <Text style={{ fontSize: 10 }}>Brak bloków WDD do wydruku.</Text>
        ) : (
          blocks.map((block, idx) => (
            <BlockCard key={idx} block={block} generatedAtLabel={generatedAtLabel} />
          ))
        )}
        <Text
          style={S.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function generateEnhancedPdfBlob(
  blocks: PdfBlockData[],
  sessionName: string
): Promise<Blob> {
  ensureFonts();
  return pdf(
    <EnhancedDeliveryDocument blocks={blocks} sessionName={sessionName} generatedAt={new Date()} />
  ).toBlob();
}

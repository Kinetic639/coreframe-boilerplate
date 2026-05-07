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
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#8a8a8a",
  },

  header: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#8a8a8a",
  },
  headerDateStrip: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#8a8a8a",
    paddingVertical: 1.5,
    paddingHorizontal: 8,
  },
  headerDate: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7,
    textAlign: "right",
  },
  headerIdRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: 8,
  },
  headerIdBox: {
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#8a8a8a",
  },
  headerIdBoxLast: {
    borderRightWidth: 0,
  },
  headerIdLabel: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
    lineHeight: 1,
  },
  headerIdNumber: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 36,
    lineHeight: 1,
  },
  headerIdNumberRight: {
    textAlign: "right",
  },
  headerVinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  headerVin: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 12,
  },
  headerInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#8a8a8a",
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  headerText: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7.2,
    lineHeight: 1.2,
  },
  headerRight: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7.2,
    textAlign: "right",
    lineHeight: 1.2,
  },
  headerInfoLeft: {
    width: "32%",
  },
  headerInfoMiddle: {
    width: "34%",
    textAlign: "center",
  },
  headerInfoRight: {
    width: "32%",
    textAlign: "right",
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#8a8a8a",
    backgroundColor: "#f0f0f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#8a8a8a",
  },
  tableCell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#8a8a8a",
  },
  tableCellCenter: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#8a8a8a",
    textAlign: "center",
  },
  tableCellRight: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "#8a8a8a",
    textAlign: "right",
  },
  tableCellLast: {
    borderRightWidth: 0,
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
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#8a8a8a",
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

  pageNumberWrapper: {
    position: "absolute",
    bottom: 18,
    right: 16,
    width: 90,
    minHeight: 14,
  },
  pageNumber: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 8,
    lineHeight: 1,
    textAlign: "right",
    color: "#000000",
  },
  blockFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
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

// A4 page content height in pt (841.89 - paddingTop 18 - paddingBottom 40)
const AVAILABLE_PAGE_HEIGHT_PT = 783;

// Approximate rendered heights of block sections (in pt, conservative estimates)
const BLOCK_HEADER_PT = 95; // dateStrip + idRow + vinRow + infoRow + border
const BLOCK_TABLE_HEAD_PT = 13;
const BLOCK_ROW_PT = 13; // per row; slightly over minimum to handle 2-line product names
const BLOCK_FOOTER_PT = 30;
const BLOCK_CHROME_PT = 12; // border (top+bottom) + marginBottom

function blockFitsOnPage(lineCount: number): boolean {
  const height =
    BLOCK_HEADER_PT +
    BLOCK_TABLE_HEAD_PT +
    lineCount * BLOCK_ROW_PT +
    BLOCK_FOOTER_PT +
    BLOCK_CHROME_PT;
  return height <= AVAILABLE_PAGE_HEIGHT_PT;
}

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

function mainIdentifierNumber(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length >= 2 && parts[1]) return parts[1];
  return value.match(/\d+/)?.[0] ?? value;
}

function HeaderIdBox({
  label,
  value,
  last = false,
  alignRight = false,
}: {
  label: string;
  value: string | null;
  last?: boolean;
  alignRight?: boolean;
}) {
  const number = mainIdentifierNumber(value);

  return (
    <View style={last ? [S.headerIdBox, S.headerIdBoxLast] : S.headerIdBox}>
      <Text style={alignRight ? [S.headerIdLabel, S.headerIdNumberRight] : S.headerIdLabel}>
        {label}
      </Text>
      <Text style={alignRight ? [S.headerIdNumber, S.headerIdNumberRight] : S.headerIdNumber}>
        {number ?? ""}
      </Text>
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
    <View style={S.blockFooter} wrap={false}>
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
  const primaryLabel = block.zlNumber ? "ZL/ZLEC" : block.orderNumber ? "BLWK" : "INFO";
  const secondaryLeft = [block.clientName, block.manualNote].filter(Boolean).join(" · ");
  const secondaryMiddle = [dealerLine, block.documentBrand === "BC" ? "31 Audi_BC" : null]
    .filter(Boolean)
    .join(" ");
  const secondaryRight = block.groupName ?? "";
  const idBoxes: Array<{ label: string; value: string | null; alignRight?: boolean }> = [
    { label: primaryLabel, value: primaryId },
    ...(block.zlNumber ? [{ label: "BLWK", value: block.orderNumber }] : []),
    { label: "ZW", value: block.zwNumber },
    { label: "WDD", value: block.wddNumber, alignRight: true },
  ];

  const fits = blockFitsOnPage(block.lines.length);

  return (
    <View style={S.block} wrap={!fits}>
      <View style={S.header} wrap={false}>
        <View style={S.headerDateStrip}>
          <Text style={S.headerDate}>{generatedAtLabel}</Text>
        </View>

        <View style={S.headerIdRow}>
          {idBoxes.map((item, index) => (
            <HeaderIdBox
              key={`${item.label}-${index}`}
              label={item.label}
              value={item.value}
              last={index === idBoxes.length - 1}
              alignRight={item.alignRight}
            />
          ))}
        </View>

        <View style={S.headerVinRow}>
          <Text style={[S.headerVin, { width: "48%" }]}>{block.vin ?? ""}</Text>
          <Text style={[S.headerRight, { width: "52%", paddingRight: 6 }]}>{rightTitle}</Text>
        </View>

        <View style={S.headerInfoRow}>
          <Text style={[S.headerText, S.headerInfoLeft]}>{secondaryLeft}</Text>
          <Text style={[S.headerText, S.headerInfoMiddle]}>{secondaryMiddle}</Text>
          <Text style={[S.headerText, S.headerInfoRight]}>{secondaryRight}</Text>
        </View>
      </View>

      {block.lines.length === 0 ? (
        <Text style={S.noLines}>Brak pozycji.</Text>
      ) : (
        <>
          <View style={S.tableHead} wrap={false}>
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
            <Text style={[S.colOp, S.tableCellCenter, S.tableCellLast, S.headText]}>O</Text>
          </View>
          {block.lines.map((line, i) => (
            <View key={i} style={S.tableRow} wrap={false}>
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
              <Text style={[S.colOp, S.tableCellRight, S.tableCellLast, S.cellTextRight]}>
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
        <View style={S.pageNumberWrapper} fixed>
          <Text
            style={S.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
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

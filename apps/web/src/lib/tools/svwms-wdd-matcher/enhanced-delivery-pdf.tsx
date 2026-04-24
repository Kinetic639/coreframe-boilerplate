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

// Returns { prefix: "ZLEC/", number: "168237" } from "ZLEC/168237/26/3332"
function splitId(value: string | null): { prefix: string; number: string } {
  if (!value) return { prefix: "", number: "-" };
  const slash = value.indexOf("/");
  if (slash === -1) return { prefix: "", number: value };
  const prefix = value.slice(0, slash + 1);
  const rest = value.slice(slash + 1);
  const secondSlash = rest.indexOf("/");
  const number = secondSlash === -1 ? rest : rest.slice(0, secondSlash);
  return { prefix, number };
}

const S = StyleSheet.create({
  page: {
    position: "relative",
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 9,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    color: "#000000",
  },

  block: {
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#000000",
  },

  header: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#000000",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  idPrefix: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 9,
    marginBottom: 6,
  },
  idNumber: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 42,
    lineHeight: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 3,
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
  matchStatus: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7,
    marginTop: 2,
  },

  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#000000",
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: "#f0f0f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "#cccccc",
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  headText: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 7,
  },
  cellText: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 8,
  },
  noLines: {
    fontFamily: "Roboto",
    fontWeight: 400,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 8,
  },

  colLp: { width: "5%" },
  colCat: { width: "22%" },
  colName: { width: "55%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "8%", textAlign: "right" },

  pageNumber: {
    fontFamily: "Roboto",
    fontWeight: 400,
    position: "absolute",
    bottom: 10,
    right: 20,
    fontSize: 7,
  },
  watermark: {
    position: "absolute",
    top: 140,
    left: 72,
    right: 72,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.08,
  },
  watermarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  watermarkTextWrap: {
    gap: 4,
  },
  watermarkTitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: 5,
    color: "#000000",
  },
  watermarkRule: {
    width: 148,
    height: 1,
    backgroundColor: "#000000",
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

function IdDisplay({ value }: { value: string | null }) {
  const { prefix, number } = splitId(value);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      {prefix ? <Text style={S.idPrefix}>{prefix}</Text> : null}
      <Text style={S.idNumber}>{number}</Text>
    </View>
  );
}

function PdfBrandWatermark() {
  return (
    <View style={S.watermark} fixed>
      <View style={S.watermarkRow}>
        <Svg width={64} height={64} viewBox="0 0 56 56">
          <Path d="M28 5 L5 53 L16 53 L28 29 Z" fill="#000000" />
          <Path d="M28 5 L51 53 L40 53 L28 29 Z" fill="#5f5f5f" />
          <Path d="M28 5 L22 20 L28 27 L34 20 Z" fill="#a3a3a3" />
          <Path
            d="M14 34 L28 51 L42 34"
            stroke="#000000"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <View style={S.watermarkTextWrap}>
          <Text style={S.watermarkTitle}>AMBRA SYSTEM</Text>
          <View style={S.watermarkRule} />
        </View>
      </View>
    </View>
  );
}

function BlockCard({ block }: { block: PdfBlockData }) {
  const matchLabel = MATCH_LABELS[block.matchType] ?? block.matchType;

  return (
    <View style={S.block} wrap={false}>
      <View style={S.header}>
        <View style={S.topRow}>
          <IdDisplay value={block.zlNumber ?? block.zwNumber} />
          {block.isDirect ? (
            <Text style={[S.idNumber, { fontSize: 18 }]}>BEZPOŚREDNIE</Text>
          ) : (
            <IdDisplay value={block.wddNumber} />
          )}
        </View>

        <View style={S.metaRow}>
          {block.orderNumber ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>Zamówienie: </Text>
              <Text style={S.metaValue}>{block.orderNumber}</Text>
            </View>
          ) : null}
          {block.clientName ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>Klient: </Text>
              <Text style={S.metaValue}>{block.clientName}</Text>
            </View>
          ) : null}
          {block.vin ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>VIN: </Text>
              <Text style={S.metaValue}>{block.vin}</Text>
            </View>
          ) : null}
          {block.groupName ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>Grupa: </Text>
              <Text style={S.metaValue}>{block.groupName}</Text>
            </View>
          ) : null}
          {block.zlNumber && block.zwNumber ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>ZW: </Text>
              <Text style={S.metaValue}>{block.zwNumber}</Text>
            </View>
          ) : null}
        </View>

        {!block.isDirect ? (
          <Text style={S.matchStatus}>
            Dopasowanie: {matchLabel} ({block.confidence}%)
          </Text>
        ) : null}
      </View>

      {block.lines.length === 0 ? (
        <Text style={S.noLines}>Brak pozycji.</Text>
      ) : (
        <>
          <View style={S.tableHead}>
            <Text style={[S.colLp, S.headText]}>Lp.</Text>
            <Text style={[S.colCat, S.headText]}>Nr katalogowy</Text>
            <Text style={[S.colName, S.headText]}>Nazwa części</Text>
            <Text style={[S.colQty, S.headText]}>Ilość</Text>
            <Text style={[S.colUnit, S.headText]}>J.m.</Text>
          </View>
          {block.lines.map((line, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={[S.colLp, S.cellText]}>{i + 1}.</Text>
              <Text style={[S.colCat, S.cellText]}>{line.productCode ?? "-"}</Text>
              <Text style={[S.colName, S.cellText]}>{line.productName ?? ""}</Text>
              <Text style={[S.colQty, S.cellText]}>
                {line.quantity != null ? String(line.quantity) : "-"}
              </Text>
              <Text style={[S.colUnit, S.cellText]}>{line.unit ?? ""}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export function EnhancedDeliveryDocument({
  blocks,
  sessionName,
}: {
  blocks: PdfBlockData[];
  sessionName: string;
}) {
  return (
    <Document title={sessionName} author="SVWMS WDD Matcher">
      <Page size="A4" style={S.page}>
        <PdfBrandWatermark />
        {blocks.length === 0 ? (
          <Text style={{ fontSize: 10 }}>Brak bloków WDD do wydruku.</Text>
        ) : (
          blocks.map((block, idx) => <BlockCard key={idx} block={block} />)
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
  return pdf(<EnhancedDeliveryDocument blocks={blocks} sessionName={sessionName} />).toBlob();
}

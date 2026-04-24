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
  blockFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#000000",
  },
  footerMatch: {
    fontFamily: "Roboto",
    fontWeight: 400,
    fontSize: 7,
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

function IdDisplay({ value }: { value: string | null }) {
  const { prefix, number } = splitId(value);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      {prefix ? <Text style={S.idPrefix}>{prefix}</Text> : null}
      <Text style={S.idNumber}>{number}</Text>
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
      <BlockFooter block={block} matchLabel={matchLabel} />
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

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { PdfBlockData } from "@/server/services/wdd-matcher.service";

function shortId(value: string | null): string {
  if (!value) return "-";
  const parts = value.split("/");
  return parts.slice(0, 2).join("/");
}

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
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
  idText: {
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  matchStatus: {
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
  },
  cellText: {
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  noLines: {
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica",
    position: "absolute",
    bottom: 10,
    right: 20,
    fontSize: 7,
  },
});

const MATCH_LABELS: Record<string, string> = {
  exact: "Dokladne",
  subset: "Podzbiór",
  partial: "Czesciowe",
  ambiguous: "Niejednoznaczne",
  unmatched_bc: "Brak dopasowania",
  unmatched_brand: "Brak WDD",
};

function BlockCard({ block }: { block: PdfBlockData }) {
  const zlShort = shortId(block.zlNumber ?? block.zwNumber);
  const wddShort = shortId(block.wddNumber);
  const matchLabel = MATCH_LABELS[block.matchType] ?? block.matchType;

  return (
    <View style={S.block} wrap={false}>
      <View style={S.header}>
        <View style={S.topRow}>
          <Text style={S.idText}>{zlShort}</Text>
          {block.isDirect ? (
            <Text style={[S.idText, { fontSize: 18 }]}>BEZPOSREDNIE</Text>
          ) : (
            <Text style={S.idText}>{wddShort}</Text>
          )}
        </View>

        <View style={S.metaRow}>
          {block.orderNumber ? (
            <View style={S.metaItem}>
              <Text style={S.metaLabel}>Zamowienie: </Text>
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
        <Text style={S.noLines}>Brak pozycji</Text>
      ) : (
        <>
          <View style={S.tableHead}>
            <Text style={[S.colLp, S.headText]}>Lp.</Text>
            <Text style={[S.colCat, S.headText]}>Nr katalogowy</Text>
            <Text style={[S.colName, S.headText]}>Nazwa czesci</Text>
            <Text style={[S.colQty, S.headText]}>Ilosc</Text>
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
        {blocks.length === 0 ? (
          <Text style={{ fontSize: 10 }}>Brak blokow WDD do wydruku.</Text>
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
  return pdf(<EnhancedDeliveryDocument blocks={blocks} sessionName={sessionName} />).toBlob();
}

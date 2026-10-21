import { describe, expect, it } from "vitest";
import { parserV4TestHooks, type TokenV4 } from "../parser_v4";

const {
  isInterBlockClientRow,
  isManualInterBlockNoteRow,
  findPreHeaderRows,
  extractManualNoteFromHeaderRows,
  extractClientLineFromHeaderRows,
  buildRawTableRowsV4,
} = parserV4TestHooks;

type Row = Parameters<typeof findPreHeaderRows>[0][number];

// One visual row; each cell is [text, x0]. Rows go down the page as y falls.
function row(y: number, cells: Array<[string, number]>): Row {
  const tokens: TokenV4[] = cells.map(([text, x0]) => ({
    text,
    page: 1,
    x0,
    x1: x0 + text.length * 4,
    y0: y - 6,
    y1: y,
    width: text.length * 4,
    height: 6,
  }));
  return { page: 1, y, tokens, text: cells.map(([text]) => text).join(" ") };
}
const line = (y: number, text: string) => row(y, [[text, 20]]);

// The brand document SVWMS 21.10.26 (Audi_BC): ZW/466 for WYSOG, ZW/467 for GOLEZ.
const QTY: Array<[string, number]> = [
  ["1,00", 295],
  ["0,00", 330],
  ["1,00", 360],
  ["0,00", 400],
  ["1,00", 530],
];

describe("parser_v4 inter-branch blocks", () => {
  it("recognises a client and a group recipient, with or without the branch code", () => {
    expect(isInterBlockClientRow("3642 Blacharnia Audi (83570)")).toBe(true);
    expect(isInterBlockClientRow("WYSOG 3642 Blacharnia Audi (83570)")).toBe(true);
    expect(isInterBlockClientRow("GOLEZ UNI_SKO - NIE ZMIENIAC (13)")).toBe(true);
    // A WDD header line is not a block opener.
    expect(isInterBlockClientRow("BRA_SKO - NIE ZMIENIAC (6)")).toBe(false);
    expect(isInterBlockClientRow("Wysylka/1/KOM BRA_SKO - NIE ZMIENIAC (6)")).toBe(false);
    expect(isInterBlockClientRow("Oslona dzwiekochlonna")).toBe(false);
  });

  it("treats a branch code above a group row as the block's note", () => {
    expect(isManualInterBlockNoteRow("GOLEZ", "UNI_SKO - NIE ZMIENIAC (13)")).toBe(true);
    expect(isManualInterBlockNoteRow("WYSOG", "3642 Blacharnia Audi (83570)")).toBe(true);
    expect(isManualInterBlockNoteRow("Wysylka/1/KOM", "BRA_SKO - NIE ZMIENIAC (6)")).toBe(false);
  });

  it("reads the branch code and the recipient from a same-row header", () => {
    const header = [
      line(700, "GOLEZ UNI_SKO - NIE ZMIENIAC (13)"),
      line(690, "D3110 - 21.10.2026 06:18:48"),
    ];
    expect(extractManualNoteFromHeaderRows(header)).toBe("GOLEZ");
    expect(extractClientLineFromHeaderRows(header)).toBe("UNI_SKO - NIE ZMIENIAC (13)");
  });

  it("starts the next block's header at the group row, not inside the previous table", () => {
    const rows = [
      line(800, "ZW/466/26/3142"),
      row(780, [["12", 25], ["2Q0825236G", 50], ["Oslona", 135], ["dzwiekochlonna", 165], ...QTY]),
      line(760, "GOLEZ UNI_SKO - NIE ZMIENIAC (13)"),
      line(750, "D3110 - 21.10.2026 06:18:48"),
      line(740, "ZW/467/26/3142"),
    ];
    const pre = findPreHeaderRows(rows, 4, 0);
    expect(pre[0].text).toBe("GOLEZ UNI_SKO - NIE ZMIENIAC (13)");
  });

  it("does not merge the next block's header into the last part's name", () => {
    const body = [
      row(780, [["12", 25], ["2Q0825236G", 50], ["Oslona", 135], ["dzwiekochlonna", 165], ...QTY]),
      row(760, [
        ["GOLEZ", 20],
        ["UNI_SKO", 60],
        ["-", 95],
        ["NIE", 100],
        ["ZMIENIAC", 120],
        ["(13)", 160],
      ]),
      line(750, "D3110 - 21.10.2026 06:18:48"),
    ];
    const result = buildRawTableRowsV4(body, new Map(), true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].nameFragments.join(" ")).toBe("Oslona dzwiekochlonna");
  });
});

describe("parser_v4 part names", () => {
  it("keeps upper-case words and slash sizes in the name", () => {
    const body = [
      row(780, [
        ["1", 25],
        ["5E3853767A9B9", 50],
        ["USZCZELKA", 135],
        ["POSZYCIE", 180],
        ["PRZEDNIA", 220],
        ...QTY,
      ]),
      row(770, [
        ["OPONA", 135],
        ["245/40/19", 165],
      ]),
    ];
    const result = buildRawTableRowsV4(body, new Map(), true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].codeText).toBe("5E3853767A9B9");
    expect(result.rows[0].nameFragments.join(" ")).toBe(
      "USZCZELKA POSZYCIE PRZEDNIA OPONA 245/40/19"
    );
  });
});

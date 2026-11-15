import { describe, expect, it } from "vitest";
import { csvCell, nodeText, rowsToCsv } from "../csv";

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

describe("nodeText", () => {
  it("reads strings and numbers through elements", () => {
    expect(nodeText("Abc")).toBe("Abc");
    expect(nodeText(12)).toBe("12");
    expect(nodeText(null)).toBe("");
    expect(nodeText(false)).toBe("");
    expect(
      nodeText(
        <span>
          <svg aria-hidden="true" />
          <Badge>Nowe</Badge> zlecenie {3}
        </span>
      )
    ).toBe("Nowe zlecenie 3");
  });

  it("takes a pill's label and leaves out what is hidden", () => {
    function Pill(_: { status: string; label?: string }) {
      return null;
    }
    expect(nodeText(<Pill status="new" label="Nowe" />)).toBe("Nowe");
    expect(
      nodeText(
        <>
          <span aria-hidden="true">AD</span>
          <span>Anna Demo</span>
        </>
      )
    ).toBe("Anna Demo");
  });
});

describe("rowsToCsv", () => {
  it("writes a BOM, a header and quoted cells", () => {
    const csv = rowsToCsv(
      [
        { a: "x;y", b: 'say "hi"' },
        { a: null, b: 2 },
      ],
      [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      (row, id) => row[id as "a" | "b"]
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\r\n")).toEqual(["A;B", '"x;y";"say ""hi"""', ";2"]);
  });

  it("quotes only what needs it", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "../table";

describe("Table", () => {
  it("renders all table primitives together", () => {
    const { container } = render(
      <Table className="custom-table">
        <TableCaption>Inventory table</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>Widget</TableCell>
            <TableCell>4</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>4</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    expect(screen.getByText("Inventory table")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getAllByText("4")).toHaveLength(2);
    expect(container.querySelector("table")).toHaveClass("custom-table");
    expect(container.querySelector("tfoot")).toBeInTheDocument();
  });
});

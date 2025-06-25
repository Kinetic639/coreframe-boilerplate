"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Product {
  id: string;
  name: string;
}

export default function ProductList({ products }: { products: Product[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nazwa produktu</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

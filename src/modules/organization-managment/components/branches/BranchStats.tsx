import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Building2, Users, Package, MapPin } from "lucide-react";

export default function BranchStats({ branches }: { branches: any[] }) {
  const totalUsers = branches.reduce((sum, b) => sum + b.userCount, 0);
  const totalProducts = branches.reduce((sum, b) => sum + b.productCount, 0);
  const avgProducts = branches.length ? Math.round(totalProducts / branches.length) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Liczba oddziałów</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{branches.length}</div>
          <p className="text-xs text-muted-foreground">Aktywne oddziały</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUsers}</div>
          <p className="text-xs text-muted-foreground">Łącznie</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Produkty</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground">Łącznie</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Średnio</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgProducts}</div>
          <p className="text-xs text-muted-foreground">na oddział</p>
        </CardContent>
      </Card>
    </div>
  );
}

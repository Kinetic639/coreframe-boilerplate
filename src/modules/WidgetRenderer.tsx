"use client";

import React from "react";
import { Widget } from "@/lib/types/widgets";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  BarElement,
  LineElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

import type { ChartData, ChartOptions } from "chart.js";

interface ChartProps {
  data: ChartData;
  options?: ChartOptions;
}

const chartComponentMap: Record<string, React.FC<ChartProps>> = {
  bar: Bar,
  line: Line,
  pie: Pie,
  doughnut: Doughnut,
};

export function WidgetRenderer({ widget }: { widget: Widget }) {
  const iconKey = widget.config?.icon;
  const Icon = iconKey
    ? (LucideIcons as unknown as Record<string, React.ElementType>)[iconKey]
    : null;

  if (widget.type === "metric") {
    return (
      <Card className="p-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{widget.title}</CardTitle>
          {Icon && (
            <Icon
              className={cn("h-6 w-6", widget.config?.color && `text-${widget.config.color}`)}
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{widget.data.value}</div>
          {widget.data.label && <p className="text-muted-foreground">{widget.data.label}</p>}
          {widget.data.change && (
            <p
              className={cn(
                "text-sm",
                widget.data.changeType === "positive" && "text-green-500",
                widget.data.changeType === "negative" && "text-red-500"
              )}
            >
              {widget.data.change}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "list") {
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {widget.data.items.map((item) => (
              <li key={item.id}>
                <div className="font-medium">{item.title}</div>
                {item.description && (
                  <div className="text-muted-foreground">{item.description}</div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "chart") {
    const ChartComponent = chartComponentMap[widget.config.type];
    return (
      <Card className="p-4">
        <CardHeader>
          <CardTitle>{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {ChartComponent ? (
            <ChartComponent
              data={{
                labels: widget.data.labels,
                datasets: widget.data.datasets,
              }}
              options={{ responsive: widget.config.responsive ?? true }}
            />
          ) : (
            <p>Nieobsługiwany typ wykresu</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

export type WidgetBase = {
  id: string;
  title: string;
};

export type WidgetMetric = WidgetBase & {
  type: "metric";
  data: {
    value: number;
    label?: string;
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
  };
  config?: {
    icon?: string;
    color?: string;
  };
};

export type WidgetList = WidgetBase & {
  type: "list";
  data: {
    items: {
      id: string;
      title: string;
      description?: string;
      timestamp?: string;
      user?: string;
    }[];
  };
  config?: {
    showTimestamp?: boolean;
    maxItems?: number;
  };
};

export type WidgetChart = WidgetBase & {
  type: "chart";
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }[];
  };
  config: {
    type: "bar" | "line" | "pie" | "doughnut";
    responsive?: boolean;
  };
};

export type Widget = WidgetMetric | WidgetList | WidgetChart;

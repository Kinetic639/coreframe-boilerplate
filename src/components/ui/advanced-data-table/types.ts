import { ReactNode } from "react";

/**
 * Filter types that determine the UI component for filtering
 */
export type FilterType =
  | "text"
  | "select"
  | "number-range"
  | "date-range"
  | "boolean"
  | "multi-select";

/**
 * Column configuration for the advanced data table
 */
export interface ColumnConfig<T = any> {
  /** Unique key for the column (should match data property) */
  key: string;
  /** Display header text */
  header: string;
  /** Icon to display next to header in filters */
  icon?: ReactNode;
  /** Type of filter to show for this column */
  filterType?: FilterType;
  /** Options for select/multi-select filters */
  filterOptions?: Array<{ value: string; label: string; icon?: ReactNode }>;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom render function for the cell */
  render?: (value: any, row: T) => ReactNode;
  /** Custom render for sidebar (condensed view) */
  renderSidebar?: (value: any, row: T) => ReactNode;
  /** Width of the column (CSS value) */
  width?: string;
  /** Minimum width of the column (CSS value) */
  minWidth?: string;
  /** Whether to show this column in mobile view */
  showInMobile?: boolean;
  /** Alignment of cell content */
  align?: "left" | "center" | "right";
  /** Whether this column is the primary identifier (shown in sidebar) */
  isPrimary?: boolean;
  /** Whether this column is visible by default */
  defaultVisible?: boolean;
  /** Whether this column can be hidden */
  canHide?: boolean;
}

/**
 * Filter value types
 */
export interface FilterValue {
  type: FilterType;
  value: any;
}

/**
 * Active filters map
 */
export type ActiveFilters = Record<string, FilterValue>;

/**
 * Sort configuration
 */
export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/**
 * Layout mode for the table
 */
export type LayoutMode = "full" | "sidebar-detail";

/**
 * Props for the main AdvancedDataTable component
 */
export interface AdvancedDataTableProps<T = any> {
  /** Data to display in the table */
  data: T[];
  /** Column configuration */
  columns: ColumnConfig<T>[];
  /** Custom render function for the detail panel */
  renderDetail?: (row: T) => ReactNode;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Whether to show checkboxes for row selection */
  selectable?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedRows: T[]) => void;
  /** Whether data is loading */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom empty state component */
  emptyState?: ReactNode;
  /** Row key extractor (defaults to 'id') */
  getRowId?: (row: T) => string;
  /** Enable virtual scrolling for large datasets */
  virtualScroll?: boolean;
  /** Height for virtual scroll container */
  virtualScrollHeight?: number;
  /** Custom class name for the container */
  className?: string;
  /** Whether to persist filters in URL */
  persistFiltersInUrl?: boolean;
  /** Default filters */
  defaultFilters?: ActiveFilters;
  /** Default sort */
  defaultSort?: SortConfig;
  /** Callback when filters change */
  onFiltersChange?: (filters: ActiveFilters) => void;
  /** Callback when sort changes */
  onSortChange?: (sort: SortConfig | null) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Whether to show the search bar */
  showSearch?: boolean;
  /** Actions to show in the toolbar */
  toolbarActions?: ReactNode;
  /** Whether to enable mobile responsive view */
  responsive?: boolean;
}

/**
 * Internal table state
 */
export interface TableState<T = any> {
  /** Currently selected row for detail view */
  selectedRow: T | null;
  /** Layout mode */
  layoutMode: LayoutMode;
  /** Active filters */
  filters: ActiveFilters;
  /** Current sort configuration */
  sort: SortConfig | null;
  /** Search query */
  searchQuery: string;
  /** Selected row IDs */
  selectedRowIds: Set<string>;
  /** Whether the filter panel is open */
  filterPanelOpen: boolean;
}

/**
 * Props for the table filters component
 */
export interface TableFiltersProps<T = any> {
  columns: ColumnConfig<T>[];
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

/**
 * Props for the table sidebar component
 */
export interface TableSidebarProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  selectedRow: T | null;
  onRowSelect: (row: T) => void;
  getRowId: (row: T) => string;
  searchQuery: string;
  filters: ActiveFilters;
}

/**
 * Props for the table detail panel component
 */
export interface TableDetailPanelProps<T = any> {
  row: T | null;
  onClose: () => void;
  renderDetail?: (row: T) => ReactNode;
  columns: ColumnConfig<T>[];
}

/**
 * Props for the mobile card view component
 */
export interface TableMobileViewProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  onRowClick: (row: T) => void;
  getRowId: (row: T) => string;
  selectedRowIds: Set<string>;
  selectable?: boolean;
  onSelectionChange?: (selectedRowIds: Set<string>) => void;
}

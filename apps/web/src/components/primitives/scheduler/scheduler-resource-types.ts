export interface SchedulerResource {
  id: string;
  name: string;
  description?: string;

  color?: string; // Optional color representation
  icon?: string; // Optional icon name from lucide

  parentId?: string; // For nesting hierarchically

  expanded?: boolean; // For resource tree expansion state in view

  metadata?: Record<string, any>;
}

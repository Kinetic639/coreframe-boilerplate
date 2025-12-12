import type { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

const widgets: Widget[] = [
  {
    id: "doc-search",
    title: "Documentation Search",
    type: "custom",
    componentName: "DocSearchWidget",
    config: {
      placeholder: "Search documentation...",
      className: "col-span-2",
    },
  },
  {
    id: "recent-docs",
    title: "Recently Viewed",
    type: "custom",
    componentName: "RecentDocsWidget",
    config: {
      limit: 5,
      className: "col-span-2",
    },
  },
];

export const documentationModuleConfig: ModuleConfig = {
  id: "documentation",
  slug: "documentation",
  title: "modules.documentation.title",
  icon: "BookOpen",
  color: "#0ea5e9", // sky-500
  description: "modules.documentation.description",
  items: [
    {
      id: "docs-home",
      label: "modules.documentation.items.home",
      icon: "BookOpen",
      type: "link",
      path: "/dashboard/docs",
    },
    {
      id: "docs-user",
      label: "modules.documentation.items.user",
      icon: "FileText",
      type: "link",
      path: "/dashboard/docs/user",
    },
    {
      id: "docs-dev",
      label: "modules.documentation.items.dev",
      icon: "Code",
      type: "link",
      path: "/dashboard/docs/dev",
      allowedUsers: [
        { role: "developer", scope: "org" },
        { role: "org_admin", scope: "org" },
      ],
    },
    {
      id: "docs-spec",
      label: "modules.documentation.items.spec",
      icon: "FileCode",
      type: "link",
      path: "/dashboard/docs/spec",
      allowedUsers: [
        { role: "developer", scope: "org" },
        { role: "org_admin", scope: "org" },
        { role: "branch_admin", scope: "branch" },
      ],
    },
  ],
  widgets,
};

export default documentationModuleConfig;

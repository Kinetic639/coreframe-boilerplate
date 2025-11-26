import { ModuleConfig } from "@/lib/types/module";
import { FileText, BookOpen, Code, Settings, FileCode } from "lucide-react";

export const documentationModuleConfig: ModuleConfig = {
  id: "documentation",
  name: "Documentation",
  description: "Knowledge center with user guides, developer docs, and specifications",
  icon: BookOpen,
  color: "#0ea5e9", // sky-500
  enabled: true,
  order: 100, // Show at end of modules list

  routes: [
    {
      path: "/docs",
      name: "Documentation Home",
      icon: BookOpen,
      allowedUsers: ["all"], // Public access to documentation
    },
    {
      path: "/docs/user",
      name: "User Guide",
      icon: FileText,
      allowedUsers: ["all"],
    },
    {
      path: "/docs/dev",
      name: "Developer Docs",
      icon: Code,
      allowedUsers: [
        { role: "developer", scope: "organization" },
        { role: "org_admin", scope: "organization" },
      ],
    },
    {
      path: "/docs/spec",
      name: "Specifications",
      icon: FileCode,
      allowedUsers: [
        { role: "developer", scope: "organization" },
        { role: "org_admin", scope: "organization" },
        { role: "branch_admin", scope: "branch" },
      ],
    },
    {
      path: "/docs/internal",
      name: "Internal Docs",
      icon: Settings,
      allowedUsers: [
        { role: "org_admin", scope: "organization" },
        { role: "branch_admin", scope: "branch" },
      ],
    },
  ],

  widgets: [
    {
      id: "doc-search",
      name: "Documentation Search",
      description: "Quick search across all documentation",
      component: "DocSearchWidget",
      defaultSize: { width: 2, height: 1 },
      allowedUsers: ["all"],
    },
    {
      id: "recent-docs",
      name: "Recently Viewed",
      description: "Your recently viewed documentation",
      component: "RecentDocsWidget",
      defaultSize: { width: 2, height: 2 },
      allowedUsers: ["all"],
    },
  ],

  permissions: [
    {
      code: "documentation.view",
      name: "View Documentation",
      description: "Access documentation pages",
      scope: "organization",
    },
    {
      code: "documentation.edit",
      name: "Edit Documentation",
      description: "Edit and create documentation",
      scope: "organization",
    },
    {
      code: "documentation.manage",
      name: "Manage Documentation",
      description: "Full documentation management including deletion",
      scope: "organization",
    },
  ],
};

export default documentationModuleConfig;

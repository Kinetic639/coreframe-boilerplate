// app/components/sidebar/ModuleSection.tsx
import React from "react";
import SidebarSection from "./SidebarSection";

type ModuleSectionProps = {
  module: {
    slug: string;
    label: string;
    settings: {
      sidebar: {
        key: string;
        label: string;
        icon: string;
        children?: {
          key: string;
          label: string;
          href: string;
          icon?: string;
        }[];
      }[];
    };
  };
};

export default function ModuleSection({ module }: ModuleSectionProps) {
  const { label, settings } = module;
  const sections = settings.sidebar ?? [];

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      {sections.map((section) => (
        <SidebarSection key={section.key} section={section} />
      ))}
    </div>
  );
}

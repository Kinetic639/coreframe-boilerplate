import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps } from "react";

// next/link for the public site's components, whose links arrive as data
// (navigation, CMS content, cards): a plain string href. An app with typed
// routes (typedRoutes) would otherwise reject every such link; the pages
// linked to are the app's to guarantee, not the component's.

export type PageLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function PageLink({ href, ...props }: PageLinkProps) {
  return <Link href={href as Route} {...props} />;
}

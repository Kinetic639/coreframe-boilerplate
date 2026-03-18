import { ReactNode, ReactElement } from "react";

// MDX Components type (simplified for react-markdown compatibility)
type MDXComponentsType = {
  [key: string]: (props: any) => ReactElement;
};

// Custom MDX components for documentation
export const mdxComponents: MDXComponentsType = {
  // Headings
  h1: ({ children }: { children: ReactNode }) => (
    <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }: { children: ReactNode }) => (
    <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mt-8 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }: { children: ReactNode }) => (
    <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mt-6 mb-3">{children}</h3>
  ),
  h4: ({ children }: { children: ReactNode }) => (
    <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4 mb-2">{children}</h4>
  ),
  h5: ({ children }: { children: ReactNode }) => (
    <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mt-3 mb-2">{children}</h5>
  ),
  h6: ({ children }: { children: ReactNode }) => (
    <h6 className="scroll-m-20 text-base font-semibold tracking-tight mt-2 mb-1">{children}</h6>
  ),

  // Paragraphs
  p: ({ children }: { children: ReactNode }) => (
    <p className="leading-7 [&:not(:first-child)]:mt-4">{children}</p>
  ),

  // Lists
  ul: ({ children }: { children: ReactNode }) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2">{children}</ul>
  ),
  ol: ({ children }: { children: ReactNode }) => (
    <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
  ),
  li: ({ children }: { children: ReactNode }) => <li className="leading-7">{children}</li>,

  // Blockquote
  blockquote: ({ children }: { children: ReactNode }) => (
    <blockquote className="mt-6 border-l-4 border-sky-500 pl-6 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  // Code
  code: ({ children, className }: { children: ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },

  pre: ({ children }: { children: ReactNode }) => (
    <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-black p-4">{children}</pre>
  ),

  // Links
  a: ({ href, children }: { href?: string; children: ReactNode }) => (
    <a
      href={href}
      className="font-medium text-sky-600 underline underline-offset-4 hover:text-sky-700"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),

  // Table
  table: ({ children }: { children: ReactNode }) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full border-collapse border border-border">{children}</table>
    </div>
  ),
  thead: ({ children }: { children: ReactNode }) => <thead className="bg-muted">{children}</thead>,
  tbody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children: ReactNode }) => (
    <tr className="border-b border-border">{children}</tr>
  ),
  th: ({ children }: { children: ReactNode }) => (
    <th className="px-4 py-2 text-left font-semibold [&[align=center]]:text-center [&[align=right]]:text-right">
      {children}
    </th>
  ),
  td: ({ children }: { children: ReactNode }) => (
    <td className="px-4 py-2 [&[align=center]]:text-center [&[align=right]]:text-right">
      {children}
    </td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-8 border-border" />,

  // Images
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <img src={src} alt={alt} className="rounded-lg my-6 max-w-full" />
  ),
};

// Custom components for documentation
export const Callout = ({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "success" | "danger";
  children: ReactNode;
}) => {
  const styles = {
    info: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
    warning:
      "border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
    success: "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
    danger: "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  };

  return <div className={`my-6 rounded-lg border-l-4 p-4 ${styles[type]}`}>{children}</div>;
};

export const Steps = ({ children }: { children: ReactNode }) => (
  <div className="my-6 space-y-4">{children}</div>
);

export const Step = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="relative pl-8 pb-4 border-l-2 border-sky-500 last:border-l-0">
    <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-sky-500" />
    <h4 className="font-semibold mb-2">{title}</h4>
    <div className="text-muted-foreground">{children}</div>
  </div>
);

export const Tabs = ({ children }: { children: ReactNode }) => (
  <div className="my-6">{children}</div>
);

export const Tab = ({ label, children }: { label: string; children: ReactNode }) => (
  <div data-label={label}>{children}</div>
);

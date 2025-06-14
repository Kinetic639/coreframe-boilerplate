import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export default function PageLayout({ children }: Props) {
  return <div className="relative flex grow flex-col bg-slate-800 py-36">{children}</div>;
}

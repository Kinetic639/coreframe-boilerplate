import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  title: ReactNode;
};

export default function PageLayout({ children, title }: Props) {
  console.log(title);
  return <div className="relative flex grow flex-col bg-slate-800 py-36">{children}</div>;
}

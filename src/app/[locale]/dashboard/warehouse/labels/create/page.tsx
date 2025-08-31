import { Metadata } from "next";
import { WYSIWYGLabelCreator } from "@/modules/warehouse/components/labels/WYSIWYGLabelCreator";

export const metadata: Metadata = {
  title: "Kreator etykiet - Magazyn",
  description: "Projektuj etykiety w trybie WYSIWYG z interaktywnym podglądem",
};

export default function Page() {
  return <WYSIWYGLabelCreator />;
}

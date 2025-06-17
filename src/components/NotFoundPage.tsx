import { useTranslations } from "next-intl";
import PageLayout from "./PageLayout";

export default function NotFoundPage() {
  const t = useTranslations("NotFoundPage");

  return (
    <PageLayout>
      <p className="max-w-[460px]">{t("description")}</p>
    </PageLayout>
  );
}

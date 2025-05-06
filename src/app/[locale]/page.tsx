import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("HomePage");
  return (
    <main className="flex flex-1 flex-col gap-6 px-4">
      <h2 className="mb-4 text-xl font-medium">{t("title")}</h2>
    </main>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOrganizationProfile } from "./api/updateProfile";
import { Tables } from "@/types/supabase";
import { toast } from "react-toastify";
import { ColorPicker } from "@/components/ui/color-picker";
import { useRouter } from "@/i18n/navigation";

type OrganizationProfile = Tables<"organization_profiles">;

const schema = z.object({
  name: z.string().min(1),
  name_2: z.string().optional(),
  slug: z.string().optional(),
  website: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  theme_color: z.string().optional(),
  bio: z.string().optional(),
});

export default function OrganizationProfileForm({
  defaultValues,
}: {
  defaultValues?: Partial<OrganizationProfile>;
}) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const router = useRouter();

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const { error } = await updateOrganizationProfile(values);

    if (error) {
      toast.error(`Błąd: ${error.message}`);
    } else {
      toast.success("Profil organizacji został zaktualizowany.");
      router.refresh();
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Input {...form.register("name")} placeholder="Nazwa organizacji (1)" />
      <Input {...form.register("name_2")} placeholder="Nazwa organizacji (2)" />
      <Input {...form.register("slug")} placeholder="Slug" />
      <Input {...form.register("website")} placeholder="Strona internetowa" />
      <Input {...form.register("logo_url")} placeholder="Logo URL" />
      <ColorPicker name="theme_color" control={form.control} label="Kolor główny" />
      <textarea
        {...form.register("bio")}
        placeholder="Opis organizacji"
        className="w-full rounded border p-2"
      />
      <Button type="submit">Zapisz zmiany</Button>
    </form>
  );
}

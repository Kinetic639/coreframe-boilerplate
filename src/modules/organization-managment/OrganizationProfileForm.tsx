"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOrganizationProfile } from "./api/updateProfile";
import { toast } from "react-toastify";
import { ColorPicker } from "@/components/ui/color-picker";
import { useRouter } from "@/i18n/navigation";
import { Tables } from "../../../supabase/types/types";

type OrganizationProfile = Tables<"organization_profiles">;

// ZOD schema zgodny z Partial<OrganizationProfile> i nullable values
const schema = z.object({
  name: z.string().nullable().optional(),
  name_2: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  theme_color: z.string().nullable().optional(),
  font_color: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
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
      <ColorPicker name="theme_color" control={form.control} label="Kolor główny" />
      <ColorPicker name="font_color" control={form.control} label="Kolor czcionki" />
      <textarea
        {...form.register("bio")}
        placeholder="Opis organizacji"
        className="w-full rounded border p-2"
      />
      <Button type="submit" variant="themed">
        Zapisz zmiany
      </Button>
    </form>
  );
}

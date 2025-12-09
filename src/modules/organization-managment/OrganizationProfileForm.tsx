"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateOrganizationProfile } from "@/lib/api/user-detail";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

import { organizationSchema, OrganizationFormData } from "./schema";
import LogoUploader from "./LogoUploader";
import ColorPickerField from "@/components/forms/ColorPickerField";
import { useRouter } from "@/i18n/navigation";

export default function OrganizationForm({
  defaultValues,
}: {
  defaultValues: OrganizationFormData;
}) {
  const router = useRouter();
  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues,
  });

  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: OrganizationFormData) => {
    setLoading(true);

    const { error } = await updateOrganizationProfile(data);
    if (error) {
      toast.error(`❌ Błąd: ${error.message}`);
    } else {
      toast.success("✅ Profil organizacji zaktualizowany.");
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nazwa organizacji *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="name_2"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nazwa alternatywna</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="slug"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug organizacji *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="website"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Strona internetowa</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="https://example.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="bio"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opis organizacji</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="logo_url"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo organizacji</FormLabel>
                <LogoUploader
                  organizationId={form.getValues().organization_id}
                  currentUrl={field.value ?? undefined}
                  onUpload={(url) => field.onChange(url)}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <ColorPickerField name="theme_color" label="Kolor motywu" />
            <ColorPickerField name="font_color" label="Kolor czcionki" />
          </div>

          <Button type="submit" disabled={loading} variant="themed">
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Zapisuję..." : "Zapisz zmiany"}
          </Button>
        </form>
      </Form>
    </FormProvider>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  archiveInventoryTagAction,
  archiveInventoryTaxRateAction,
  archiveInventoryUnitAction,
  archiveInventoryUnitConversionAction,
  createInventoryTagAction,
  createInventoryTaxRateAction,
  createInventoryUnitAction,
  createInventoryUnitConversionAction,
} from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InventoryCustomFieldDefinition,
  InventoryTagRow,
  InventoryTaxRateRow,
  InventoryUnitConversionRow,
} from "@/lib/warehouse/inventory-types";
import { InventoryCustomFieldsClient } from "../items/custom-fields/inventory-custom-fields-client";

type UnitOption = {
  id: string;
  code: string;
  name: string;
};

const metricUnits = [
  { code: "PCS", name: "Pieces", unit_kind: "count", precision: 0 },
  { code: "KG", name: "Kilogram", unit_kind: "weight", precision: 3 },
  { code: "G", name: "Gram", unit_kind: "weight", precision: 0 },
  { code: "M", name: "Meter", unit_kind: "length", precision: 3 },
  { code: "CM", name: "Centimeter", unit_kind: "length", precision: 2 },
  { code: "MM", name: "Millimeter", unit_kind: "length", precision: 1 },
  { code: "L", name: "Liter", unit_kind: "volume", precision: 3 },
  { code: "ML", name: "Milliliter", unit_kind: "volume", precision: 0 },
] as const;

const imperialUnits = [
  { code: "EA", name: "Each", unit_kind: "count", precision: 0 },
  { code: "LB", name: "Pound", unit_kind: "weight", precision: 3 },
  { code: "OZ", name: "Ounce", unit_kind: "weight", precision: 3 },
  { code: "FT", name: "Foot", unit_kind: "length", precision: 3 },
  { code: "IN", name: "Inch", unit_kind: "length", precision: 3 },
  { code: "GAL", name: "Gallon", unit_kind: "volume", precision: 3 },
] as const;

const taxPresets = [
  { name: "VAT 23%", code: "VAT23", rate_percent: 23, is_default: true },
  { name: "VAT 8%", code: "VAT8", rate_percent: 8, is_default: false },
  { name: "VAT 5%", code: "VAT5", rate_percent: 5, is_default: false },
  { name: "VAT 0%", code: "VAT0", rate_percent: 0, is_default: false },
] as const;

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WarehouseInventorySettingsClient({
  units,
  unitConversions,
  customFields,
  taxRates,
  tags,
  canManage,
}: {
  units: UnitOption[];
  unitConversions: InventoryUnitConversionRow[];
  customFields: InventoryCustomFieldDefinition[];
  taxRates: InventoryTaxRateRow[];
  tags: InventoryTagRow[];
  canManage: boolean;
}) {
  const [unitRows, setUnitRows] = useState(units);
  const [conversionRows, setConversionRows] = useState(unitConversions);
  const [taxRows, setTaxRows] = useState(taxRates);
  const [tagRows, setTagRows] = useState(tags);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const removeUnit = (unitId: string) => {
    startTransition(async () => {
      const result = await archiveInventoryUnitAction({ id: unitId });
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not remove unit.");
        return;
      }
      setUnitRows((current) => current.filter((unit) => unit.id !== unitId));
      setConversionRows((current) =>
        current.filter(
          (conversion) => conversion.from_unit_id !== unitId && conversion.to_unit_id !== unitId
        )
      );
      setMessage("Unit removed from presets.");
    });
  };

  const removeConversion = (conversionId: string) => {
    startTransition(async () => {
      const result = await archiveInventoryUnitConversionAction({ id: conversionId });
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not remove conversion.");
        return;
      }
      setConversionRows((current) =>
        current.filter((conversion) => conversion.id !== conversionId)
      );
      setMessage("Unit conversion removed.");
    });
  };

  const removeTaxRate = (taxRateId: string) => {
    startTransition(async () => {
      const result = await archiveInventoryTaxRateAction({ id: taxRateId });
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not remove tax preset.");
        return;
      }
      setTaxRows((current) => current.filter((tax) => tax.id !== taxRateId));
      setMessage("Tax preset removed.");
    });
  };

  const removeTag = (tagId: string) => {
    startTransition(async () => {
      const result = await archiveInventoryTagAction({ id: tagId });
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not remove tag.");
        return;
      }
      setTagRows((current) => current.filter((tag) => tag.id !== tagId));
      setMessage("Tag removed.");
    });
  };

  const seedUnits = (preset: typeof metricUnits | typeof imperialUnits) => {
    startTransition(async () => {
      let created = 0;
      for (const unit of preset) {
        if (unitRows.some((row) => row.code.toLowerCase() === unit.code.toLowerCase())) continue;
        const result = await createInventoryUnitAction(unit);
        if (result.success && "data" in result) {
          created += 1;
          setUnitRows((current) => [...current, result.data]);
        }
      }
      setMessage(created ? `Added ${created} unit presets.` : "All preset units already exist.");
    });
  };

  const addUnit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createInventoryUnitAction({
        code: String(formData.get("unit_code") ?? ""),
        name: String(formData.get("unit_name") ?? ""),
        unit_kind: String(formData.get("unit_kind") ?? "count"),
        precision: Number(formData.get("precision") ?? 0),
      });
      if (!result.success || !("data" in result)) {
        setMessage("error" in result ? result.error : "Could not create unit.");
        return;
      }
      setUnitRows((current) => [...current, result.data]);
      setMessage("Unit created.");
    });
  };

  const addConversion = (formData: FormData) => {
    const from = String(formData.get("from_unit_id") ?? "");
    const to = String(formData.get("to_unit_id") ?? "");
    const factor = Number(formData.get("factor") ?? 0);
    startTransition(async () => {
      const result = await createInventoryUnitConversionAction({
        from_unit_id: from,
        to_unit_id: to,
        factor,
      });
      if (!result.success || !("data" in result)) {
        setMessage("error" in result ? result.error : "Could not create conversion.");
        return;
      }
      setConversionRows((current) => [
        ...current,
        {
          id: result.data.id,
          from_unit_id: from,
          to_unit_id: to,
          from_unit_code: unitRows.find((unit) => unit.id === from)?.code ?? "",
          to_unit_code: unitRows.find((unit) => unit.id === to)?.code ?? "",
          factor,
        },
      ]);
      setMessage("Unit conversion created.");
    });
  };

  const addTaxRate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createInventoryTaxRateAction({
        name: String(formData.get("tax_name") ?? ""),
        code: String(formData.get("tax_code") ?? ""),
        rate_percent: Number(formData.get("tax_rate_percent") ?? 0),
        is_default: formData.get("is_default") === "on",
      });
      if (!result.success || !("data" in result)) {
        setMessage("error" in result ? result.error : "Could not create tax rate.");
        return;
      }
      setTaxRows((current) => [
        ...(result.data.is_default
          ? current.map((row) => ({ ...row, is_default: false }))
          : current),
        result.data,
      ]);
      setMessage("Tax preset created.");
    });
  };

  const seedTaxRates = () => {
    startTransition(async () => {
      let created = 0;
      for (const tax of taxPresets) {
        if (taxRows.some((row) => row.code.toLowerCase() === tax.code.toLowerCase())) continue;
        const result = await createInventoryTaxRateAction(tax);
        if (result.success && "data" in result) {
          created += 1;
          setTaxRows((current) => [
            ...(result.data.is_default
              ? current.map((row) => ({ ...row, is_default: false }))
              : current),
            result.data,
          ]);
        }
      }
      setMessage(created ? `Added ${created} tax presets.` : "All tax presets already exist.");
    });
  };

  const addTag = (formData: FormData) => {
    startTransition(async () => {
      const result = await createInventoryTagAction({
        name: String(formData.get("tag_name") ?? ""),
        color: String(formData.get("tag_color") ?? "") || null,
      });
      if (!result.success || !("data" in result)) {
        setMessage("error" in result ? result.error : "Could not create tag.");
        return;
      }
      setTagRows((current) => [...current, result.data]);
      setMessage("Tag created.");
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure product units, unit conversions, tax presets, and custom item fields.
        </p>
      </div>

      {message ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Units</h2>
            <p className="text-sm text-muted-foreground">
              Base units used by products and import files.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => seedUnits(metricUnits)}
              disabled={!canManage || isPending}
            >
              Metric presets
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => seedUnits(imperialUnits)}
              disabled={!canManage || isPending}
            >
              Imperial presets
            </Button>
          </div>
        </div>

        <form action={addUnit} className="grid gap-2 md:grid-cols-[120px_1fr_160px_120px_auto]">
          <Input name="unit_code" placeholder="Code" disabled={!canManage} />
          <Input name="unit_name" placeholder="Name" disabled={!canManage} />
          <select name="unit_kind" className={selectClass} disabled={!canManage}>
            <option value="count">Count</option>
            <option value="weight">Weight</option>
            <option value="length">Length</option>
            <option value="volume">Volume</option>
            <option value="area">Area</option>
            <option value="time">Time</option>
            <option value="other">Other</option>
          </select>
          <Input
            name="precision"
            type="number"
            min={0}
            max={9}
            placeholder="Precision"
            disabled={!canManage}
          />
          <Button type="submit" disabled={!canManage || isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {unitRows.map((unit) => (
            <span
              key={unit.id}
              className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm"
            >
              <span>
                <span className="font-medium">{unit.code}</span>{" "}
                <span className="text-muted-foreground">{unit.name}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${unit.code} unit preset`}
                title={`Remove ${unit.code} unit preset`}
                disabled={!canManage || isPending}
                onClick={() => removeUnit(unit.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div>
          <h2 className="text-lg font-medium">Unit conversions</h2>
          <p className="text-sm text-muted-foreground">
            Global conversions such as 1 KG = 1000 G or 1 M = 100 CM.
          </p>
        </div>
        <form action={addConversion} className="grid gap-2 md:grid-cols-[1fr_1fr_160px_auto]">
          <select name="from_unit_id" className={selectClass} disabled={!canManage}>
            <option value="">From unit</option>
            {unitRows.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code}
              </option>
            ))}
          </select>
          <select name="to_unit_id" className={selectClass} disabled={!canManage}>
            <option value="">To unit</option>
            {unitRows.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code}
              </option>
            ))}
          </select>
          <Input
            name="factor"
            type="number"
            step="0.0001"
            min={0}
            placeholder="Factor"
            disabled={!canManage}
          />
          <Button type="submit" disabled={!canManage || isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </form>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {conversionRows.map((conversion) => (
            <div
              key={conversion.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                1 {conversion.from_unit_code} = {conversion.factor} {conversion.to_unit_code}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${conversion.from_unit_code} to ${conversion.to_unit_code} conversion`}
                title={`Remove ${conversion.from_unit_code} to ${conversion.to_unit_code} conversion`}
                disabled={!canManage || isPending}
                onClick={() => removeConversion(conversion.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Tax rates</h2>
            <p className="text-sm text-muted-foreground">
              Presets used when creating products. The product stores both tax code and rate.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={seedTaxRates}
            disabled={!canManage || isPending}
          >
            Polish VAT presets
          </Button>
        </div>
        <form action={addTaxRate} className="grid gap-2 md:grid-cols-[1fr_120px_140px_140px_auto]">
          <Input name="tax_name" placeholder="Name, e.g. VAT 23%" disabled={!canManage} />
          <Input name="tax_code" placeholder="Code" disabled={!canManage} />
          <Input
            name="tax_rate_percent"
            type="number"
            step="0.0001"
            min={0}
            max={100}
            placeholder="Rate %"
            disabled={!canManage}
          />
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="is_default" disabled={!canManage} />
            Default
          </label>
          <Button type="submit" disabled={!canManage || isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </form>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {taxRows.map((tax) => (
            <div
              key={tax.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{tax.code}</span>{" "}
                <span className="text-muted-foreground">{tax.rate_percent}%</span>
              </span>
              <span className="inline-flex items-center gap-1">
                {tax.is_default ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${tax.code} tax preset`}
                  title={`Remove ${tax.code} tax preset`}
                  disabled={!canManage || isPending}
                  onClick={() => removeTaxRate(tax.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div>
          <h2 className="text-lg font-medium">Tags</h2>
          <p className="text-sm text-muted-foreground">
            Reusable product tags shown as suggestions in product creation and edit forms.
          </p>
        </div>
        <form action={addTag} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
          <Input name="tag_name" placeholder="Tag name" disabled={!canManage} />
          <Input name="tag_color" placeholder="#64748b" disabled={!canManage} />
          <Button type="submit" disabled={!canManage || isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {tagRows.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm"
            >
              {tag.color ? (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: tag.color }}
                />
              ) : null}
              <span className="font-medium">{tag.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${tag.name} tag`}
                title={`Remove ${tag.name} tag`}
                disabled={!canManage || isPending}
                onClick={() => removeTag(tag.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          ))}
        </div>
      </section>

      <InventoryCustomFieldsClient
        initialFields={customFields}
        title="Custom fields"
        description="Define optional fields users can add to selected products or variant rows."
        backHref="/dashboard/warehouse/settings"
        backLabel="Settings"
        framed={false}
      />
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Database,
  ChevronRight,
  ChevronDown,
  Info,
  Plus,
  Check,
  Maximize2,
  Scale,
  Tag,
  Trash2,
  Package,
  Search as SearchIcon,
  Fingerprint,
  Construction,
  Layers,
  Server,
  Layout as LayoutIcon,
  Inbox,
  Truck,
  RotateCcw,
  CheckSquare,
  ShieldAlert,
  Car,
  ShieldCheck,
  Triangle,
  Zap,
  Box,
  Monitor,
  MoreHorizontal,
  LayoutDashboard,
  Factory,
  Settings2,
  ShieldCheck as ShieldCheckIcon,
  PackageOpen,
  AlertTriangle,
  Layers3,
  Hash,
  Archive,
  Flag,
  Star,
  Heart,
  MapPin,
  Coffee,
  Briefcase,
  Key,
  Hammer,
  Move,
  History,
  Copy,
  Shield,
} from "lucide-react";
import { OPERATION_PROFILES, PHYSICAL_LOCATION_KINDS } from "../../constants/locationCategories";

const ALL_ICONS: Record<string, any> = {
  Database,
  Layers,
  MapPin,
  Box,
  Inbox,
  Truck,
  RotateCcw,
  ShieldAlert,
  CheckSquare,
  Server,
  Construction,
  Briefcase,
  Layout: LayoutIcon,
  Car,
  Flag,
  ArrowRightLeft: Move,
  Archive,
  Shield,
  Tag,
  Zap,
  Star,
  Heart,
  Coffee,
  Key,
  Hammer,
  Scale,
  Maximize2,
  AlertCircle: ShieldAlert,
  Clock: History,
  ExternalLink: MoreHorizontal,
  Copy,
  Trash2,
  Search: SearchIcon,
  Fingerprint,
  ShieldCheck,
  Triangle,
  Package,
  Circle: Triangle,
};

const IconRenderer = ({
  name,
  className,
  color,
}: {
  name: string;
  className?: string;
  color?: string;
}) => {
  const IconComponent = ALL_ICONS[name] || Box;
  return <IconComponent className={className} color={color} />;
};

const CUSTOM_COLORS = [
  { name: "Sky", value: "text-primary", bg: "bg-primary" },
  { name: "Emerald", value: "text-emerald-400", bg: "bg-emerald-500" },
  { name: "Rose", value: "text-rose-400", bg: "bg-rose-500" },
  { name: "Amber", value: "text-amber-400", bg: "bg-amber-500" },
  { name: "Violet", value: "text-violet-400", bg: "bg-violet-500" },
  { name: "Orange", value: "text-orange-400", bg: "bg-orange-500" },
  { name: "Indigo", value: "text-indigo-400", bg: "bg-indigo-500" },
  { name: "Slate", value: "text-muted-foreground", bg: "bg-muted-foreground" },
];
import { motion, AnimatePresence } from "motion/react";
import {
  LogicalLocation,
  LocationRole,
  type LocationCapabilities,
  type LocationOperationProfile,
  type LocationStockPolicy,
  type PhysicalMetadata,
  type PhysicalLocationKind,
} from "../../types";

const PHYSICAL_KIND_ROLE: Record<PhysicalLocationKind, LocationRole> = {
  warehouse: LocationRole.WAREHOUSE,
  zone: LocationRole.ZONE,
  aisle: LocationRole.AISLE,
  rack: LocationRole.RACK,
  shelf: LocationRole.SHELF,
  bin: LocationRole.BIN,
};

type LocationFormData = {
  code: string;
  name: string;
  description: string;
  parentId: string;
  role: LocationRole;
  physicalKind: PhysicalLocationKind;
  stockPolicy: LocationStockPolicy;
  operationProfile: LocationOperationProfile;
  capabilities: LocationCapabilities;
  status: "active" | "inactive" | "archived" | "locked";
  icon: string;
  color: string;
  physicalMetadata: PhysicalMetadata & { weightCapacity?: number };
  assignment: NonNullable<LogicalLocation["assignment"]>;
};

interface LocationModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<LogicalLocation>) => void;
  locations: LogicalLocation[];
  initialData?: Partial<LogicalLocation>;
}

export default function LocationModal({
  onClose,
  onSubmit,
  locations,
  initialData,
}: LocationModalProps) {
  const t = useTranslations("ambraLocations");
  const [formData, setFormData] = useState<LocationFormData>({
    code: initialData?.code || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    parentId: initialData?.parentId || "",
    role: initialData?.role || LocationRole.STORAGE,
    physicalKind: initialData?.physicalKind || "bin",
    stockPolicy: initialData?.stockPolicy || "stockable",
    operationProfile: initialData?.operationProfile || "standard",
    capabilities: initialData?.capabilities || {
      canStoreInventory: true,
      canReceive: true,
      canPick: true,
      canShip: false,
      canReserve: true,
      isVirtual: false,
      isTemporary: false,
    },
    status: initialData?.status || "active",
    icon: initialData?.icon || "",
    color: initialData?.color || "",
    physicalMetadata: initialData?.physicalMetadata || {
      width: 0,
      height: 0,
      depth: 0,
      weightCapacity: 0,
    },
    assignment: initialData?.assignment || {
      defaultSKU: "",
      allowedCategories: [],
    },
  });

  const [currentStep, setCurrentStep] = useState<"BASIC" | "TYPE" | "PHYSICAL">("BASIC");

  const handlePhysicalKindSelect = (physicalKind: PhysicalLocationKind) => {
    const definition = PHYSICAL_LOCATION_KINDS[physicalKind];
    const stockPolicy = definition.defaultStockPolicy;
    const canStoreInventory = stockPolicy === "stockable";

    setFormData((prev) => ({
      ...prev,
      physicalKind,
      stockPolicy,
      role: PHYSICAL_KIND_ROLE[physicalKind],
      icon: prev.icon || definition.iconName,
      color: prev.color || definition.color,
      capabilities: {
        ...prev.capabilities,
        canStoreInventory,
        canReceive: canStoreInventory,
        canPick: canStoreInventory,
        canShip: prev.operationProfile === "shipping",
        canReserve: canStoreInventory,
        isVirtual: false,
      },
    }));
  };

  const handleStockPolicySelect = (stockPolicy: LocationStockPolicy) => {
    const canStoreInventory = stockPolicy === "stockable";
    setFormData((prev) => ({
      ...prev,
      stockPolicy,
      capabilities: {
        ...prev.capabilities,
        canStoreInventory,
        canReceive: canStoreInventory,
        canPick: canStoreInventory,
        canReserve: canStoreInventory,
      },
    }));
  };

  const handleOperationProfileSelect = (operationProfile: LocationOperationProfile) => {
    const definition = OPERATION_PROFILES[operationProfile];
    setFormData((prev) => ({
      ...prev,
      operationProfile,
      color: prev.color || definition.color,
      capabilities: {
        ...prev.capabilities,
        canShip: operationProfile === "shipping",
      },
    }));
  };

  const getLocationPathString = (parentId: string) => {
    if (!parentId) return t("modal.root");
    const path: string[] = [];
    let current = locations.find((l) => l.id === parentId);
    while (current) {
      path.unshift(current.code);
      current = locations.find((l) => l.id === current?.parentId);
    }
    return `${t("modal.root")} / ${path.join(" / ")}`;
  };

  const getPhysicalKindLabel = (kind: PhysicalLocationKind) =>
    t(`physicalKinds.${kind}`, { fallback: kind });

  const getPhysicalKindDescription = (kind: PhysicalLocationKind) =>
    t(`physicalKindDescriptions.${kind}`, { fallback: PHYSICAL_LOCATION_KINDS[kind].description });

  const getOperationProfileLabel = (profile: LocationOperationProfile) =>
    t(`operationProfiles.${profile}`, { fallback: profile });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-3xl bg-card text-card-foreground border border-border rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[min(760px,calc(100vh-2rem))]"
      >
        <div className="flex bg-card border-b border-border shrink-0">
          <div className="flex-1 px-5 py-4 flex items-center gap-3 bg-card">
            <div className="h-9 w-9 rounded-md border bg-primary/10 text-primary border-primary/20 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground tracking-normal">
                {initialData?.code ? t("modal.editTitle") : t("modal.createTitle")}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                  {t("modal.pathPreview")}:
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {getLocationPathString(formData.parentId)}{" "}
                  {formData.code && <span className="text-primary">/ {formData.code}</span>}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-5 text-muted-foreground hover:text-foreground border-l border-border transition-colors"
            title={t("actions.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted flex flex-col">
          {/* Header Tabs/Steps */}
          <div className="flex border-b border-border bg-background px-5">
            <button
              onClick={() => setCurrentStep("BASIC")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-all ${currentStep === "BASIC" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${currentStep === "BASIC" ? "bg-primary/10 border-primary" : "border-border bg-muted"}`}
              >
                1
              </div>
              {t("modal.steps.identity")}
            </button>
            <button
              onClick={() => setCurrentStep("TYPE")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-all ${currentStep === "TYPE" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${currentStep === "TYPE" ? "bg-primary/10 border-primary" : "border-border bg-muted"}`}
              >
                2
              </div>
              {t("modal.steps.structureStock")}
            </button>
            <button
              onClick={() => setCurrentStep("PHYSICAL")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b-2 transition-all ${currentStep === "PHYSICAL" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${currentStep === "PHYSICAL" ? "bg-primary/10 border-primary" : "border-border bg-muted"}`}
              >
                3
              </div>
              {t("modal.steps.physical")}
            </button>
          </div>

          <div className="p-5 pb-6">
            <AnimatePresence mode="wait">
              {currentStep === "BASIC" && (
                <motion.div
                  key="basic"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="max-w-xl mx-auto space-y-5"
                >
                  <div className="bg-background p-5 rounded-lg border border-border space-y-5">
                    <Input
                      label={t("modal.fields.code")}
                      placeholder={t("modal.placeholders.code")}
                      value={formData.code}
                      onChange={(v) => setFormData({ ...formData, code: v })}
                    />
                    <Input
                      label={t("modal.fields.name")}
                      placeholder={t("modal.placeholders.name")}
                      value={formData.name}
                      onChange={(v) => setFormData({ ...formData, name: v })}
                    />
                    <Select
                      label={t("modal.fields.parent")}
                      options={[
                        { value: "", label: t("modal.noneRoot") },
                        ...locations
                          .filter((l) => l.id !== initialData?.id)
                          .map((l) => ({
                            value: l.id,
                            label: `${getLocationPathString(l.parentId)} / ${l.code}`,
                          })),
                      ]}
                      value={formData.parentId}
                      onChange={(v) => setFormData({ ...formData, parentId: v })}
                    />
                    <Input
                      label={t("modal.fields.description")}
                      placeholder={t("modal.placeholders.description")}
                      value={formData.description}
                      onChange={(v) => setFormData({ ...formData, description: v })}
                    />
                  </div>
                </motion.div>
              )}

              {currentStep === "TYPE" && (
                <motion.div
                  key="type"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 gap-5 lg:grid-cols-12"
                >
                  <div className="space-y-3 lg:col-span-7">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                      {t("modal.physicalKind")}
                    </label>
                    <div className="grid grid-cols-1 gap-3 max-h-[430px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted sm:grid-cols-2">
                      {Object.values(PHYSICAL_LOCATION_KINDS).map((kind) => {
                        const active = formData.physicalKind === kind.id;
                        return (
                          <div
                            key={kind.id}
                            onClick={() => handlePhysicalKindSelect(kind.id)}
                            className={`flex flex-col gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              active
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-muted/40 border-border/50 hover:border-muted-foreground/40 hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div
                                className={`p-2 rounded-md shrink-0 ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground"}`}
                              >
                                <IconRenderer name={kind.iconName} className="w-5 h-5" />
                              </div>
                              {active && <Check className="w-4 h-4 text-primary" />}
                            </div>
                            <div>
                              <span
                                className={`text-[11px] font-semibold uppercase tracking-wide block mb-0.5 ${active ? "text-foreground" : "text-foreground/80"}`}
                              >
                                {getPhysicalKindLabel(kind.id)}
                              </span>
                              <span className="text-[9.5px] text-muted-foreground font-medium leading-relaxed block h-8 overflow-hidden line-clamp-2">
                                {getPhysicalKindDescription(kind.id)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-5 lg:col-span-5">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-[10px] text-primary leading-relaxed font-semibold uppercase tracking-wide">
                        {t("modal.stockPolicyExplanation")}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                        {t("modal.stockPolicy")}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["none", "stockable"] as LocationStockPolicy[]).map((policy) => {
                          const disabled =
                            policy === "stockable" && formData.physicalKind !== "bin";
                          return (
                            <button
                              key={policy}
                              type="button"
                              disabled={disabled}
                              onClick={() => handleStockPolicySelect(policy)}
                              className={`rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                formData.stockPolicy === policy
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span className="block text-[11px] font-semibold uppercase tracking-wide">
                                {t(`stockPolicies.${policy}`)}
                              </span>
                              <span className="mt-1 block text-[10px] leading-4">
                                {t(`stockPolicyDescriptions.${policy}`)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                        {t("modal.operationProfile")}
                      </label>
                      <select
                        value={formData.operationProfile}
                        onChange={(event) =>
                          handleOperationProfileSelect(
                            event.target.value as LocationOperationProfile
                          )
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
                      >
                        {Object.values(OPERATION_PROFILES).map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {getOperationProfileLabel(profile.id)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4 pt-6 mt-6 border-t border-border">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
                        {t("modal.iconColorOverrides")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Archive",
                          "Shield",
                          "Tag",
                          "Flag",
                          "Zap",
                          "Star",
                          "Heart",
                          "MapPin",
                          "Coffee",
                          "Briefcase",
                          "Key",
                          "Hammer",
                        ].map((iconName) => (
                          <button
                            key={iconName}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                icon: formData.icon === iconName ? "" : iconName,
                              })
                            }
                            title={t(`modal.icons.${iconName}`)}
                            className={`p-2.5 rounded-md border transition-colors ${formData.icon === iconName ? "bg-primary/20 border-primary text-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                          >
                            <IconRenderer name={iconName} className="w-4 h-4" />
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {[
                          "text-primary",
                          "text-emerald-400",
                          "text-rose-400",
                          "text-amber-400",
                          "text-violet-400",
                          "text-orange-400",
                          "text-indigo-400",
                          "text-muted-foreground",
                        ].map((c) => (
                          <button
                            key={c}
                            onClick={() =>
                              setFormData({ ...formData, color: formData.color === c ? "" : c })
                            }
                            className={`w-7 h-7 rounded-full border-2 transition-all p-0.5 ${formData.color === c ? "border-primary" : "border-border hover:border-muted-foreground/40"}`}
                          >
                            <div
                              className={`w-full h-full rounded-full ${c.replace("text", "bg").replace("-400", "-500")}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              {currentStep === "PHYSICAL" && (
                <motion.div
                  key="physical"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="mx-auto max-w-xl"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Maximize2 className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                        {t("modal.physicalSpecification")}
                      </h3>
                    </div>
                    <div className="bg-background p-5 rounded-lg border border-border space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label={t("modal.fields.width")}
                          value={formData.physicalMetadata.width?.toString() || ""}
                          onChange={(v) =>
                            setFormData({
                              ...formData,
                              physicalMetadata: {
                                ...formData.physicalMetadata,
                                width: parseInt(v) || 0,
                              },
                            })
                          }
                          isNumber
                        />
                        <Input
                          label={t("modal.fields.height")}
                          value={formData.physicalMetadata.height?.toString() || ""}
                          onChange={(v) =>
                            setFormData({
                              ...formData,
                              physicalMetadata: {
                                ...formData.physicalMetadata,
                                height: parseInt(v) || 0,
                              },
                            })
                          }
                          isNumber
                        />
                        <Input
                          label={t("modal.fields.depth")}
                          value={formData.physicalMetadata.depth?.toString() || ""}
                          onChange={(v) =>
                            setFormData({
                              ...formData,
                              physicalMetadata: {
                                ...formData.physicalMetadata,
                                depth: parseInt(v) || 0,
                              },
                            })
                          }
                          isNumber
                        />
                        <Input
                          label={t("modal.fields.weightCapacity")}
                          value={formData.physicalMetadata.weightCapacity?.toString() || ""}
                          onChange={(v) =>
                            setFormData({
                              ...formData,
                              physicalMetadata: {
                                ...formData.physicalMetadata,
                                weightCapacity: parseInt(v) || 0,
                              },
                            })
                          }
                          isNumber
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-5 py-3 bg-background border-t border-border flex justify-between items-center shrink-0">
          <div className="flex gap-2">
            {currentStep !== "BASIC" && (
              <button
                onClick={() => setCurrentStep(currentStep === "PHYSICAL" ? "TYPE" : "BASIC")}
                className="px-4 py-2 rounded-md font-semibold text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors bg-muted"
              >
                {t("actions.previous")}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md font-semibold text-[10px] uppercase tracking-wide text-red-500/70 hover:text-red-500 transition-colors"
            >
              {t("actions.discard")}
            </button>
          </div>

          <div className="flex gap-2">
            {currentStep !== "PHYSICAL" ? (
              <button
                onClick={() => setCurrentStep(currentStep === "BASIC" ? "TYPE" : "PHYSICAL")}
                className="px-5 py-2.5 rounded-md bg-primary border border-primary text-primary-foreground font-semibold text-[10px] uppercase tracking-wide hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                {t("actions.continue")} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onSubmit(formData)}
                className="px-6 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-[10px] uppercase tracking-wide hover:bg-primary/90 transition-colors shadow-sm"
              >
                {initialData?.code ? t("actions.updateEntity") : t("actions.finalizeCreation")}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BehaviorToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between group ${
        checked
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-muted/20 border-border hover:border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-md ${checked ? "bg-emerald-500/10 text-emerald-400" : "bg-card text-muted-foreground"}`}
        >
          {icon}
        </div>
        <h4
          className={`text-[11px] font-semibold uppercase tracking-wide ${checked ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
        >
          {label}
        </h4>
      </div>
      <div
        className={`w-10 h-5 rounded-full p-1 transition-colors ${checked ? "bg-emerald-500" : "bg-muted"}`}
      >
        <div
          className={`w-3 h-3 bg-background rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
    </div>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChange,
  isNumber,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  isNumber?: boolean;
}) {
  return (
    <div className="space-y-2 relative">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
        {label}
      </label>
      <input
        type={isNumber ? "number" : "text"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-input rounded-md py-2.5 px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring/50 outline-none transition-colors placeholder:text-muted-foreground placeholder:font-normal"
      />
    </div>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[] | { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 relative">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ml-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-input rounded-md py-2.5 px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring/50 outline-none transition-colors appearance-none cursor-pointer"
      >
        {options.map((opt: any) => (
          <option
            key={typeof opt === "string" ? opt : opt.value}
            value={typeof opt === "string" ? opt : opt.value}
          >
            {typeof opt === "string" ? opt : opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-[35px] pointer-events-none">
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

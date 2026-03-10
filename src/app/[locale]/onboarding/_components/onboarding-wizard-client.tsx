"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, GitBranch, Sparkles, Check, Loader2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import { createOrganizationAction, type SubscriptionPlan } from "@/app/actions/onboarding";

interface Props {
  userEmail: string;
  firstName?: string;
  plans: SubscriptionPlan[];
}

type Step = "org" | "branch" | "plan" | "creating";

const STEPS: Step[] = ["org", "branch", "plan"];
const STEP_INDEX: Record<Step, number> = { org: 0, branch: 1, plan: 2, creating: 3 };

export function OnboardingWizardClient({ userEmail, firstName, plans }: Props) {
  const t = useTranslations("onboardingWizard");

  function formatPrice(cents: number): string {
    if (cents === 0) return t("priceFree");
    return t("pricePaid", { amount: (cents / 100).toFixed(0) });
  }

  function formatLimit(val: number, unitKey: "unitBranches" | "unitMembers"): string {
    const unit = t(unitKey);
    if (val === -1) return t("limitUnlimited", { unit });
    return t("limitCount", { count: val, unit });
  }
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("org");
  const [orgName, setOrgName] = React.useState(firstName ? `${firstName}'s Organization` : "");
  const [branchName, setBranchName] = React.useState("Main Branch");
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(
    plans.find((p) => p.name === "free")?.id ?? plans[0]?.id ?? null
  );
  const [orgNameError, setOrgNameError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const stepIndex = STEP_INDEX[step];

  function validateOrgName(): boolean {
    if (orgName.trim().length < 2) {
      setOrgNameError(t("orgNameTooShort"));
      return false;
    }
    setOrgNameError("");
    return true;
  }

  function handleOrgNext() {
    if (!validateOrgName()) return;
    setStep("branch");
  }

  function handleBranchNext() {
    if (!branchName.trim()) setBranchName("Main Branch");
    setStep("plan");
  }

  function handleSubmit() {
    setStep("creating");
    startTransition(async () => {
      const result = await createOrganizationAction(
        orgName,
        branchName || "Main Branch",
        selectedPlanId
      );
      if (!result.success) {
        toast.error(t("createError"));
        setStep("plan");
        return;
      }
      router.push("/dashboard/start");
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        {step !== "creating" && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    i < stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i === stepIndex
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px w-10 transition-colors ${i < stepIndex ? "bg-primary" : "bg-muted"}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Org name */}
          {step === "org" && (
            <motion.div
              key="org"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <Building2 className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>
                    {firstName ? t("titleWithName", { name: firstName }) : t("title")}
                  </CardTitle>
                  <CardDescription>{t("orgStepDescription")}</CardDescription>
                  <p className="text-xs text-muted-foreground">
                    {t("signedInAs")} <span className="font-medium">{userEmail}</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">{t("orgNameLabel")}</Label>
                    <Input
                      id="org-name"
                      value={orgName}
                      onChange={(e) => {
                        setOrgName(e.target.value);
                        if (orgNameError) setOrgNameError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleOrgNext()}
                      placeholder={t("orgNamePlaceholder")}
                      autoFocus
                    />
                    {orgNameError && <p className="text-sm text-destructive">{orgNameError}</p>}
                  </div>
                  <Button className="w-full" onClick={handleOrgNext}>
                    {t("nextButton")} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Branch name */}
          {step === "branch" && (
            <motion.div
              key="branch"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <GitBranch className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>{t("branchStepTitle")}</CardTitle>
                  <CardDescription>{t("branchStepDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">{t("branchNameLabel")}</Label>
                    <Input
                      id="branch-name"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleBranchNext()}
                      placeholder={t("branchNamePlaceholder")}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">{t("branchNameHint")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("org")}>
                      {t("backButton")}
                    </Button>
                    <Button className="flex-1" onClick={handleBranchNext}>
                      {t("nextButton")} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Plan selection */}
          {step === "plan" && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <Sparkles className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle>{t("planStepTitle")}</CardTitle>
                  <CardDescription>{t("planStepDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                          selectedPlanId === plan.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{plan.display_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatLimit(plan.max_branches, "unitBranches")} ·{" "}
                              {formatLimit(plan.max_members, "unitMembers")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">
                              {formatPrice(plan.price_monthly_cents)}
                            </span>
                            {selectedPlanId === plan.id && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("branch")}>
                      {t("backButton")}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={!selectedPlanId || isPending}
                    >
                      {t("createButton")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Creating state */}
          {step === "creating" && (
            <motion.div
              key="creating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-lg font-medium">{t("creatingTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("creatingDescription")}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

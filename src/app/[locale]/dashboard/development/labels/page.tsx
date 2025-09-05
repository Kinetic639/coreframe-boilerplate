"use client";

import { useState, useEffect } from "react";
import { useLocations } from "@/lib/hooks/use-locations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  QrCode,
  Package,
  MapPin,
  Copy,
  RefreshCw,
  Plus,
  ExternalLink,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/navigation";
import { toast } from "react-toastify";

interface QRLabel {
  id: string;
  qr_token: string;
  label_type: "location" | "product";
  entity_type: "location" | "product" | null;
  entity_id: string | null;
  assigned_at: string | null;
  is_active: boolean;
  organization_id: string;
  branch_id: string;
  created_at: string;
  entity_name?: string;
}

interface CreateLabelForm {
  label_type: "location" | "product";
  quantity: number;
  description: string;
}

export default function LabelTestingPage() {
  const [labels, setLabels] = useState<QRLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const [form, setForm] = useState<CreateLabelForm>({
    label_type: "location",
    quantity: 5,
    description: "Test labels generated from development page",
  });

  // Initialize locations loading for testing
  const { locations: storeLocations, isLoading: locationsLoading } = useLocations();

  const supabase = createClient();

  useEffect(() => {
    loadUserContext();
    loadLabels();
  }, []);

  const loadUserContext = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error("Auth error:", userError);
        toast.error("Authentication error");
        return;
      }
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      console.log("User authenticated:", user.id);

      // Get user's organization and branch context
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_role_assignments")
        .select("organization_id, branch_id")
        .eq("user_id", user.id)
        .limit(1);

      if (rolesError) {
        console.error("Error loading user roles:", rolesError);
        // Fallback: try to get organization/branch from a different approach
        const { data: orgs } = await supabase.from("organizations").select("id").limit(1);

        if (orgs && orgs.length > 0) {
          const { data: branches } = await supabase
            .from("branches")
            .select("id")
            .eq("organization_id", orgs[0].id)
            .limit(1);

          if (branches && branches.length > 0) {
            setUserContext({
              organization_id: orgs[0].id,
              branch_id: branches[0].id,
            });
            console.log("Using fallback context:", orgs[0].id, branches[0].id);
          } else {
            toast.error("No branches found");
          }
        } else {
          toast.error("No organizations found");
        }
        return;
      }

      if (userRoles && userRoles.length > 0) {
        setUserContext(userRoles[0]);
        console.log("User context loaded:", userRoles[0]);
      } else {
        console.warn("No user roles found");
        toast.warning("No user roles found - using fallback");
        // Same fallback as above
        const { data: orgs } = await supabase.from("organizations").select("id").limit(1);

        if (orgs && orgs.length > 0) {
          const { data: branches } = await supabase
            .from("branches")
            .select("id")
            .eq("organization_id", orgs[0].id)
            .limit(1);

          if (branches && branches.length > 0) {
            setUserContext({
              organization_id: orgs[0].id,
              branch_id: branches[0].id,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading user context:", error);
      toast.error("Error loading user context");
    }
  };

  const loadLabels = async () => {
    setLoading(true);
    try {
      // First get the basic labels data
      const { data: labelsData, error } = await supabase
        .from("qr_labels")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading labels:", error);
        toast.error(`Failed to load labels: ${error.message}`);
        return;
      }

      // For each label that has an entity assigned, get the entity name
      const labelsWithNames = await Promise.all(
        (labelsData || []).map(async (label) => {
          let entity_name = null;

          if (label.entity_id && label.entity_type) {
            try {
              if (label.entity_type === "location") {
                const { data: location } = await supabase
                  .from("locations")
                  .select("name")
                  .eq("id", label.entity_id)
                  .single();
                entity_name = location?.name;
              } else if (label.entity_type === "product") {
                const { data: product } = await supabase
                  .from("products")
                  .select("name")
                  .eq("id", label.entity_id)
                  .single();
                entity_name = product?.name;
              }
            } catch (entityError) {
              console.warn(
                `Could not load entity name for ${label.entity_type}:${label.entity_id}`,
                entityError
              );
            }
          }

          return {
            ...label,
            entity_name,
          };
        })
      );

      setLabels(labelsWithNames);
    } catch (error) {
      console.error("Error loading labels:", error);
      toast.error("Failed to load labels");
    } finally {
      setLoading(false);
    }
  };

  const generateQRToken = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${timestamp}-${random}`;
  };

  const createTestLabels = async () => {
    if (!userContext) {
      toast.error("User context not loaded");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const labelsToCreate = [];
      for (let i = 0; i < form.quantity; i++) {
        labelsToCreate.push({
          qr_token: generateQRToken(),
          label_type: form.label_type,
          entity_type: null,
          entity_id: null,
          assigned_at: null,
          is_active: true,
          organization_id: userContext.organization_id,
          branch_id: userContext.branch_id,
          created_by: user.id,
          metadata: {
            description: form.description,
            created_from: "development_page",
          },
        });
      }

      const { error } = await supabase.from("qr_labels").insert(labelsToCreate).select();

      if (error) {
        console.error("Error creating labels:", error);
        toast.error(`Failed to create labels: ${error.message}`);
        return;
      }

      toast.success(`Created ${form.quantity} test labels`);

      // Reload labels
      await loadLabels();
    } catch (error) {
      console.error("Error creating labels:", error);
      toast.error("Failed to create labels");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Token copied to clipboard");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const deleteLabel = async (labelId: string) => {
    try {
      const { error } = await supabase
        .from("qr_labels")
        .update({ is_active: false })
        .eq("id", labelId);

      if (error) {
        toast.error("Failed to delete label");
        return;
      }

      toast.success("Label deleted successfully");

      // Reload labels
      await loadLabels();
    } catch (error) {
      console.error("Error deleting label:", error);
      toast.error("Failed to delete label");
    }
  };

  const getQRCodeURL = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/qr/${token}`;
  };

  const getEntityIcon = (labelType: string) => {
    return labelType === "location" ? (
      <MapPin className="h-4 w-4" />
    ) : (
      <Package className="h-4 w-4" />
    );
  };

  const getEntityColor = (labelType: string) => {
    return labelType === "location" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Label Testing</h1>
          <p className="text-muted-foreground">
            Generate and manage test QR labels for development and testing purposes
          </p>
        </div>
        <Button onClick={loadLabels} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This is a development tool. Use these QR codes to test the scanning workflow. Generate QR
          codes by copying the URLs below and using a QR code generator.
        </AlertDescription>
      </Alert>

      {/* Debug Info */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-mono text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>User Context:</strong>{" "}
            {userContext ? (
              <Badge variant="secondary">
                Org: {userContext.organization_id?.slice(-8)} | Branch:{" "}
                {userContext.branch_id?.slice(-8)}
              </Badge>
            ) : (
              <Badge variant="destructive">Not loaded</Badge>
            )}
          </div>
          <div>
            <strong>Labels Loaded:</strong>{" "}
            <Badge variant={labels.length > 0 ? "secondary" : "outline"}>
              {labels.length} labels
            </Badge>
          </div>
          <div>
            <strong>Locations Loaded:</strong>{" "}
            <Badge variant={storeLocations.length > 0 ? "secondary" : "outline"}>
              {storeLocations.length} locations {locationsLoading ? "(loading...)" : ""}
            </Badge>
          </div>
          <div>
            <strong>Generate Button:</strong>{" "}
            <Badge variant={!userContext ? "destructive" : "secondary"}>
              {!userContext ? "Disabled (no context)" : "Enabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create New Labels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate Test Labels
          </CardTitle>
          <CardDescription>
            Create blank QR labels for testing the scanning workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="label_type">Label Type</Label>
              <Select
                value={form.label_type}
                onValueChange={(value: "location" | "product") =>
                  setForm((prev) => ({ ...prev, label_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="20"
                value={form.quantity}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <Button onClick={createTestLabels} disabled={creating || !userContext}>
            {creating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Generate {form.quantity} Label{form.quantity !== 1 ? "s" : ""}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Labels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generated Labels ({labels.length})
          </CardTitle>
          <CardDescription>
            Test labels available for QR code generation and scanning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : labels.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No labels found. Generate some test labels to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {labels.map((label) => (
                <div key={label.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getEntityIcon(label.label_type)}
                        <Badge className={getEntityColor(label.label_type)}>
                          {label.label_type}
                        </Badge>
                      </div>
                      {label.entity_name && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Assigned: {label.entity_name}</Badge>
                          </div>
                        </>
                      )}
                      {!label.entity_id && <Badge variant="outline">Unassigned</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(label.qr_token)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Token
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(getQRCodeURL(label.qr_token))}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        URL
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/qr/${label.qr_token}` as any} target="_blank">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Test
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteLabel(label.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      <strong>Token:</strong>
                      <code className="ml-1 rounded bg-muted px-1 text-xs">{label.qr_token}</code>
                    </div>
                    <div>
                      <strong>Created:</strong> {new Date(label.created_at).toLocaleString()}
                    </div>
                    <div className="md:col-span-2">
                      <strong>Test URL:</strong>
                      <code className="ml-1 break-all rounded bg-muted px-1 text-xs">
                        {getQRCodeURL(label.qr_token)}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 font-semibold">1. Generate QR Codes</h4>
            <p className="text-sm text-muted-foreground">
              Copy the URLs above and paste them into a QR code generator (like
              qr-code-generator.com) to create printable QR codes.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">2. Test Scanning Workflow</h4>
            <p className="text-sm text-muted-foreground">
              Scan the QR codes with your mobile device or use the "Test" button above to simulate
              the workflow:
            </p>
            <ul className="ml-4 mt-1 list-inside list-disc text-sm text-muted-foreground">
              <li>Unassigned labels will show assignment options</li>
              <li>Assigned labels will redirect to the entity's detail page</li>
              <li>Authentication flow will be tested automatically</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">3. Assignment Testing</h4>
            <p className="text-sm text-muted-foreground">
              Use the assignment links in unassigned label scans to test the label assignment
              workflow to locations and products.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

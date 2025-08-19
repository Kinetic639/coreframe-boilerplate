"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Search,
  MoreHorizontal,
  Copy,
  RefreshCw,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
  Building2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import {
  fetchOrganizationInvitations,
  fetchInvitationStatistics,
  type InvitationWithDetails,
} from "@/lib/api/invitations";
import {
  cancelInvitationAction,
  resendInvitationAction,
  cleanupExpiredInvitationsAction,
} from "@/app/actions/invitations";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";

interface InvitationManagementViewProps {
  onInviteUser?: () => void;
}

export function InvitationManagementView({ onInviteUser }: InvitationManagementViewProps) {
  const [invitations, setInvitations] = React.useState<InvitationWithDetails[]>([]);
  const [filteredInvitations, setFilteredInvitations] = React.useState<InvitationWithDetails[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  });

  const { activeOrgId } = useAppStore();

  const loadInvitations = React.useCallback(async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      setError(null);

      const [invitationsData, statsData] = await Promise.all([
        fetchOrganizationInvitations(activeOrgId),
        fetchInvitationStatistics(activeOrgId),
      ]);

      setInvitations(invitationsData);
      setStats(statsData);
    } catch (err) {
      console.error("Error loading invitations:", err);
      setError(err instanceof Error ? err.message : "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  // Load invitations on mount and when organization changes
  React.useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // Filter invitations based on search and status
  React.useEffect(() => {
    let filtered = invitations;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invitation) =>
          invitation.email.toLowerCase().includes(query) ||
          invitation.role?.display_name?.toLowerCase().includes(query) ||
          invitation.role?.name?.toLowerCase().includes(query) ||
          invitation.branch?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((invitation) => invitation.status === statusFilter);
    }

    setFilteredInvitations(filtered);
  }, [invitations, searchQuery, statusFilter]);

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    setActionLoading(invitationId);
    try {
      const result = await cancelInvitationAction(invitationId);
      if (result.success) {
        toast.success(`Zaproszenie dla ${email} zostało anulowane.`);
        await loadInvitations();
      } else {
        toast.error(result.error || "Nie udało się anulować zaproszenia");
      }
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast.error("Wystąpił nieoczekiwany błąd");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    setActionLoading(invitationId);
    try {
      const result = await resendInvitationAction(invitationId);
      if (result.success) {
        toast.success(`Nowe zaproszenie dla ${email} zostało wysłane.`);
        await loadInvitations();
      } else {
        toast.error(result.error || "Nie udało się ponownie wysłać zaproszenia");
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast.error("Wystąpił nieoczekiwany błąd");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyInvitationLink = (token: string) => {
    const invitationUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(invitationUrl);
    toast.success("Link do zaproszenia został skopiowany do schowka");
  };

  const handleCleanupExpired = async () => {
    setActionLoading("cleanup");
    try {
      const result = await cleanupExpiredInvitationsAction();
      if (result.success) {
        const expiredCount = result.data?.expiredCount || 0;
        toast.success(`Oznaczono ${expiredCount} zaproszeń jako wygasłe.`);
        await loadInvitations();
      } else {
        toast.error(result.error || "Nie udało się wyczyścić wygasłych zaproszeń");
      }
    } catch (error) {
      console.error("Error cleaning up expired invitations:", error);
      toast.error("Wystąpił nieoczekiwany błąd");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Oczekuje" },
      accepted: { variant: "default" as const, icon: CheckCircle, label: "Zaakceptowane" },
      rejected: { variant: "destructive" as const, icon: XCircle, label: "Odrzucone" },
      expired: { variant: "outline" as const, icon: AlertCircle, label: "Wygasłe" },
      cancelled: { variant: "outline" as const, icon: X, label: "Anulowane" },
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Ładowanie zaproszeń...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Zaproszenia użytkowników</h2>
          <p className="text-muted-foreground">Zarządzanie zaproszeniami do organizacji</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCleanupExpired}
            disabled={actionLoading === "cleanup"}
          >
            {actionLoading === "cleanup" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Wyczyść wygasłe
          </Button>
          {onInviteUser && (
            <Button onClick={onInviteUser}>
              <Mail className="mr-2 h-4 w-4" />
              Zaproś użytkownika
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-3 lg:grid-cols-6"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oczekujące</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zaakceptowane</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Odrzucone</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wygasłe</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anulowane</CardTitle>
            <X className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtry i wyszukiwanie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Szukaj po email, roli lub oddziale..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie statusy</SelectItem>
                    <SelectItem value="pending">Oczekujące</SelectItem>
                    <SelectItem value="accepted">Zaakceptowane</SelectItem>
                    <SelectItem value="rejected">Odrzucone</SelectItem>
                    <SelectItem value="expired">Wygasłe</SelectItem>
                    <SelectItem value="cancelled">Anulowane</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Wyczyść filtry
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Wyświetlono {filteredInvitations.length} z {invitations.length} zaproszeń
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invitations Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Zaproszenia ({filteredInvitations.length})
            </CardTitle>
            <CardDescription>Lista wszystkich zaproszeń wysłanych w organizacji</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredInvitations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Oddział</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wygasa</TableHead>
                    <TableHead>Utworzone</TableHead>
                    <TableHead className="w-[100px]">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((invitation) => (
                    <TableRow key={invitation.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invitation.role ? (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">
                              {invitation.role.display_name || invitation.role.name}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Brak roli</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation.branch ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{invitation.branch.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Brak oddziału</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div
                            className={
                              isExpired(invitation.expires_at) && invitation.status === "pending"
                                ? "text-red-500"
                                : ""
                            }
                          >
                            {invitation.expires_at
                              ? new Date(invitation.expires_at).toLocaleDateString("pl-PL")
                              : "Brak daty"}
                          </div>
                          <div className="text-muted-foreground">
                            {invitation.expires_at
                              ? formatDistanceToNow(new Date(invitation.expires_at), {
                                  addSuffix: true,
                                  locale: pl,
                                })
                              : "Brak daty"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {invitation.created_at
                              ? new Date(invitation.created_at).toLocaleDateString("pl-PL")
                              : "Brak daty"}
                          </div>
                          <div className="text-muted-foreground">
                            {invitation.created_at
                              ? formatDistanceToNow(new Date(invitation.created_at), {
                                  addSuffix: true,
                                  locale: pl,
                                })
                              : "Brak daty"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={actionLoading === invitation.id}
                            >
                              {actionLoading === invitation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleCopyInvitationLink(invitation.token)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Skopiuj link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(`/invite/${invitation.token}`, "_blank")}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Otwórz link
                            </DropdownMenuItem>
                            {invitation.status === "pending" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleResendInvitation(invitation.id, invitation.email)
                                  }
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Wyślij ponownie
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() =>
                                    handleCancelInvitation(invitation.id, invitation.email)
                                  }
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Anuluj zaproszenie
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <Mail className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery || statusFilter !== "all" ? "Brak wyników" : "Brak zaproszeń"}
                </h3>
                <p className="mb-4 text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Nie znaleziono zaproszeń pasujących do wybranych filtrów."
                    : "Nie wysłano jeszcze żadnych zaproszeń."}
                </p>
                {!(searchQuery || statusFilter !== "all") && onInviteUser && (
                  <Button onClick={onInviteUser}>
                    <Mail className="mr-2 h-4 w-4" />
                    Wyślij pierwsze zaproszenie
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

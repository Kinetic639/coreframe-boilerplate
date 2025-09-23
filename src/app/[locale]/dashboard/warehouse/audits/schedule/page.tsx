"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  Play,
  Pause,
  Edit,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuditSchedulesByBranch } from "@/lib/mock/audit";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export default function AuditSchedulesPage() {
  const schedules = getAuditSchedulesByBranch();

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      weekly: "Tygodniowo",
      monthly: "Miesięcznie",
      quarterly: "Kwartalnie",
      yearly: "Rocznie",
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const getFrequencyColor = (frequency: string) => {
    const colors = {
      weekly: "bg-blue-500",
      monthly: "bg-green-500",
      quarterly: "bg-orange-500",
      yearly: "bg-purple-500",
    };
    return colors[frequency as keyof typeof colors] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Harmonogram audytów</h1>
          <p className="text-muted-foreground">
            Zarządzanie harmonogramami cyklicznych audytów magazynowych
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nowy harmonogram
        </Button>
      </motion.div>

      {/* Schedules Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {schedules.map((schedule, index) => (
          <motion.div
            key={schedule.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="mb-2 text-lg">{schedule.name}</CardTitle>
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${getFrequencyColor(schedule.frequency)}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {getFrequencyLabel(schedule.frequency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={schedule.is_active ? "default" : "secondary"}>
                      {schedule.is_active ? "Aktywny" : "Nieaktywny"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edytuj
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          {schedule.is_active ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Dezaktywuj
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Aktywuj
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Usuń
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{schedule.location_ids.length} lokalizacji</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Następny audyt:{" "}
                    {formatDistanceToNow(new Date(schedule.next_audit_date), {
                      addSuffix: true,
                      locale: pl,
                    })}
                  </span>
                </div>

                <div className="border-t pt-2">
                  <div className="text-xs text-muted-foreground">
                    Utworzono: {new Date(schedule.created_at).toLocaleDateString("pl-PL")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {schedules.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
          <Calendar className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 text-lg font-medium">Brak harmonogramów</h3>
          <p className="mb-4 text-muted-foreground">
            Utwórz pierwszy harmonogram audytów, aby automatyzować proces kontroli magazynu.
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Utwórz harmonogram
          </Button>
        </motion.div>
      )}
    </div>
  );
}

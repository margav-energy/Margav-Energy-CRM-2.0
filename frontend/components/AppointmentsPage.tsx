import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, CalendarClock, CheckCircle2, Clock3, MapPin, Phone, XCircle } from "lucide-react";
import { getAppointments, updateAppointmentStatus } from "../lib/api";
import { toast } from "react-toastify";

type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type AppointmentItem = {
  id: string;
  status: AppointmentStatus;
  scheduledAt: string;
  notes?: string | null;
  lead?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    postcode?: string;
  };
  fieldSalesRep?: { fullName?: string } | null;
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

function statusBadgeClass(status: AppointmentStatus): string {
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-800";
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "CANCELLED") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-800";
}

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await getAppointments({ pageSize: 200 });
      const items = (res?.items as AppointmentItem[]) ?? [];
      setAppointments(items);
    } catch {
      setAppointments([]);
      toast.error("Could not load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return appointments.filter((a) => {
      const d = new Date(a.scheduledAt);
      if (period === "today") return d.toDateString() === now.toDateString();
      if (period === "week") return d.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return d.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
    });
  }, [appointments, period]);

  const scheduled = filtered.filter((a) => a.status === "SCHEDULED").length;
  const completed = filtered.filter((a) => a.status === "COMPLETED").length;
  const cancelled = filtered.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length;

  const upcoming = [...filtered]
    .filter((a) => a.status === "SCHEDULED")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const changeStatus = async (id: string, next: AppointmentStatus) => {
    setUpdatingId(id);
    try {
      await updateAppointmentStatus(id, next);
      toast.success("Appointment updated");
      await loadAppointments();
    } catch {
      toast.error("Could not update appointment");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-white via-background to-blue-50/30 p-5 sm:p-6 space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Appointments Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage scheduling, reminders, and field-visit progress in one place.
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as "today" | "week" | "month")}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile title="Total Appointments" value={String(filtered.length)} icon={CalendarClock} />
          <StatTile title="Scheduled" value={String(scheduled)} icon={Clock3} />
          <StatTile title="Completed" value={String(completed)} icon={CheckCircle2} />
          <StatTile title="Cancelled / No show" value={String(cancelled)} icon={XCircle} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-1">
            <p className="text-sm font-medium mb-3">Upcoming Appointments</p>
            <div className="space-y-2">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
              ))}
              {!loading && upcoming.slice(0, 7).map((apt) => {
                const dt = new Date(apt.scheduledAt);
                const name = `${apt.lead?.firstName ?? ""} ${apt.lead?.lastName ?? ""}`.trim() || "Lead";
                return (
                  <div key={apt.id} className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dt.toLocaleDateString("en-GB")} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
              {!loading && upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No upcoming appointments</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-2">
            <p className="text-sm font-medium mb-3">Schedule & Actions</p>
            <div className="space-y-3 max-h-[440px] overflow-auto pr-1">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/60" />
              ))}
              {!loading && filtered.map((apt) => {
                const dt = new Date(apt.scheduledAt);
                const name = `${apt.lead?.firstName ?? ""} ${apt.lead?.lastName ?? ""}`.trim() || "Lead";
                const address = [apt.lead?.addressLine1, apt.lead?.city, apt.lead?.postcode].filter(Boolean).join(", ");
                return (
                  <div key={apt.id} className="rounded-lg border border-border/70 bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{name}</p>
                          <Badge className={statusBadgeClass(apt.status)}>{STATUS_LABEL[apt.status]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {dt.toLocaleDateString("en-GB")} at {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {address ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {address}
                          </p>
                        ) : null}
                        {apt.lead?.phone ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {apt.lead.phone}
                          </p>
                        ) : null}
                        {apt.fieldSalesRep?.fullName ? (
                          <p className="text-xs text-muted-foreground">
                            Field rep: {apt.fieldSalesRep.fullName}
                          </p>
                        ) : null}
                      </div>
                      {apt.status === "SCHEDULED" ? (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => void changeStatus(apt.id, "COMPLETED")}
                            disabled={updatingId === apt.id}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void changeStatus(apt.id, "CANCELLED")}
                            disabled={updatingId === apt.id}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-10 text-center">No appointments for this window.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Calendar;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

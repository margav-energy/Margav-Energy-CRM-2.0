import { useState, useEffect } from "react";
import { LeadDetailSheet } from "./admin/LeadDetailSheet";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";
import {
  PhoneOff,
  PhoneCall,
  CalendarCheck,
  BadgeCheck,
  Wind,
  ChevronRight,
} from "lucide-react";
import type { QualifierLead } from "./qualifierLeadTypes";

export type { QualifierLead };

const JOURNEY_PAGE_SIZE = 50;

/** Left-to-right journey; backend LeadStatus keys */
const JOURNEY_STAGES = [
  { key: "NO_CONTACT", label: "No Contact", icon: PhoneOff },
  { key: "QUALIFIER_CALLBACK", label: "Callback", icon: PhoneCall },
  { key: "APPOINTMENT_SET", label: "Appointment Set", icon: CalendarCheck },
  { key: "SOLD", label: "Sold", icon: BadgeCheck },
  { key: "NOT_INTERESTED", label: "Blowout", icon: Wind },
] as const;

const STAGE_STYLES: Record<
  string,
  { column: string; header: string; card: string; cardHover: string }
> = {
  NO_CONTACT: {
    column:
      "bg-gradient-to-b from-slate-100 via-gray-50 to-slate-100 border-slate-300/80 shadow-xl",
    header:
      "bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600 text-white shadow-lg",
    card: "bg-gradient-to-br from-white via-slate-50/90 to-gray-50/70 border-slate-200/90 shadow-md",
    cardHover: "hover:shadow-lg hover:border-slate-300",
  },
  QUALIFIER_CALLBACK: {
    column:
      "bg-gradient-to-b from-violet-100 via-purple-50 to-fuchsia-100 border-violet-300/80 shadow-xl",
    header:
      "bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-600 text-white shadow-lg",
    card: "bg-gradient-to-br from-white via-violet-50/90 to-purple-50/70 border-violet-200/90 shadow-md",
    cardHover: "hover:shadow-lg hover:border-violet-300",
  },
  APPOINTMENT_SET: {
    column:
      "bg-gradient-to-b from-blue-100 via-indigo-50 to-violet-100 border-blue-300/80 shadow-xl",
    header:
      "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 text-white shadow-lg",
    card: "bg-gradient-to-br from-white via-blue-50/90 to-indigo-50/70 border-blue-200/90 shadow-md",
    cardHover: "hover:shadow-lg hover:border-blue-300",
  },
  SOLD: {
    column:
      "bg-gradient-to-b from-emerald-100 via-green-50 to-teal-100 border-emerald-300/80 shadow-xl",
    header:
      "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 text-white shadow-lg",
    card: "bg-gradient-to-br from-white via-emerald-50/90 to-green-50/70 border-emerald-200/90 shadow-md",
    cardHover: "hover:shadow-lg hover:border-emerald-300",
  },
  NOT_INTERESTED: {
    column:
      "bg-gradient-to-b from-rose-100 via-red-50 to-pink-100 border-rose-300/80 shadow-xl",
    header:
      "bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white shadow-lg",
    card: "bg-gradient-to-br from-white via-rose-50/90 to-red-50/70 border-rose-200/90 shadow-md",
    cardHover: "hover:shadow-lg hover:border-rose-300",
  },
};

function JourneyLeadCard({
  lead,
  onClick,
  stageKey,
}: {
  lead: QualifierLead;
  onClick: () => void;
  stageKey: string;
}) {
  const name = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();
  const styles = STAGE_STYLES[stageKey] ?? STAGE_STYLES.NO_CONTACT;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3.5 transition-all duration-200 overflow-hidden relative",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400",
        styles.card,
        styles.cardHover,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl" />
      <div className="relative">
        <div className="font-semibold text-sm text-gray-900 truncate">
          {name || "Unknown"}
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {lead.phone || lead.email || "—"}
        </div>
      </div>
    </button>
  );
}

function JourneyColumn({
  title,
  leads,
  totalInStage,
  hasMore,
  onLoadMore,
  onCardClick,
  stageKey,
  icon: Icon,
  showConnector,
}: {
  title: string;
  leads: QualifierLead[];
  totalInStage: number;
  hasMore: boolean;
  onLoadMore?: () => void;
  onCardClick: (lead: QualifierLead) => void;
  stageKey: string;
  icon: React.ComponentType<{ className?: string }>;
  showConnector: boolean;
}) {
  const styles = STAGE_STYLES[stageKey] ?? STAGE_STYLES.NO_CONTACT;

  return (
    <div className="flex items-stretch gap-0 shrink-0">
      <div
        className={cn(
          "min-w-[260px] max-w-[280px] rounded-2xl border-2 transition-all duration-200 overflow-hidden",
          styles.column,
        )}
      >
        <div
          className={cn(
            "relative px-3 py-3 border-b border-white/30 overflow-hidden",
            styles.header,
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0 opacity-90 drop-shadow-sm" />
            <span className="font-semibold text-sm tracking-wide drop-shadow-sm leading-tight">
              {title}
            </span>
          </div>
          <div className="relative text-white/90 text-xs mt-1 font-medium">
            {totalInStage} lead{totalInStage !== 1 ? "s" : ""}
            {totalInStage > leads.length ? (
              <span className="opacity-90"> · showing {leads.length}</span>
            ) : null}
          </div>
        </div>
        <ScrollArea className="h-[380px]">
          <div className="p-3 space-y-3">
            {leads.map((lead) => (
              <JourneyLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onCardClick(lead)}
                stageKey={stageKey}
              />
            ))}
            {hasMore && onLoadMore ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={onLoadMore}
              >
                Load more ({totalInStage - leads.length} more)
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </div>
      {showConnector ? (
        <div className="flex items-center justify-center px-1 text-muted-foreground/50 self-center py-20">
          <ChevronRight className="h-8 w-8 shrink-0" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

interface QualifierLeadJourneyProps {
  leads?: QualifierLead[];
  loading?: boolean;
  onUpdated?: () => void;
}

export function QualifierLeadJourney({
  leads: leadsProp = [],
  loading = false,
  onUpdated,
}: QualifierLeadJourneyProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [stagePages, setStagePages] = useState<Record<string, number>>({});

  const leadsByStatus = (status: string) =>
    leadsProp.filter((l) => l.status === status);

  const visibleForStage = (stageKey: string) => {
    const all = leadsByStatus(stageKey);
    const pages = stagePages[stageKey] ?? 1;
    const limit = pages * JOURNEY_PAGE_SIZE;
    const visible = all.slice(0, limit);
    return { all, visible, hasMore: all.length > visible.length };
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-xl">
        <CardHeader className="border-b bg-gradient-to-r from-slate-100/80 to-slate-50/80">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Lead journey
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            No Contact → Callback → Appointment Set → Sold → Blowout. Click a
            lead to open details; update stage from the qualifier sheet or lead
            record.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex gap-2 overflow-x-auto py-4">
              {JOURNEY_STAGES.map((s) => (
                <div
                  key={s.key}
                  className="min-w-[260px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 animate-pulse h-80"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-0 overflow-x-auto pb-6 px-1 items-start">
              {JOURNEY_STAGES.map((stage, index) => {
                const { all, visible, hasMore } = visibleForStage(stage.key);
                return (
                  <JourneyColumn
                    key={stage.key}
                    title={stage.label}
                    leads={visible}
                    totalInStage={all.length}
                    hasMore={hasMore}
                    onLoadMore={() =>
                      setStagePages((p) => ({
                        ...p,
                        [stage.key]: (p[stage.key] ?? 1) + 1,
                      }))
                    }
                    onCardClick={(l) => setSelectedLeadId(l.id)}
                    stageKey={stage.key}
                    icon={stage.icon}
                    showConnector={index < JOURNEY_STAGES.length - 1}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDetailSheet
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => {
          onUpdated?.();
        }}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { updateLeadStatus } from '../lib/api';
import { LeadDetailSheet } from './admin/LeadDetailSheet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { cn } from './ui/utils';
import { Send, CalendarCheck, PhoneCall, PhoneOff, Wind, GripVertical } from 'lucide-react';

const QUALIFIER_STAGES = [
  { key: 'QUALIFYING', label: 'Sent to Qualify', icon: Send },
  { key: 'APPOINTMENT_SET', label: 'Appointment Set', icon: CalendarCheck },
  { key: 'QUALIFIER_CALLBACK', label: 'Call Back', icon: PhoneCall },
  { key: 'NO_CONTACT', label: 'No Contact', icon: PhoneOff },
  { key: 'NOT_INTERESTED', label: 'Blowout', icon: Wind },
];

const STAGE_STYLES: Record<string, { column: string; header: string; card: string; cardHover: string }> = {
  QUALIFYING: {
    column: 'bg-gradient-to-b from-amber-100 via-orange-50 to-amber-100 border-amber-300/80 shadow-xl',
    header: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg',
    card: 'bg-gradient-to-br from-white via-amber-50/90 to-orange-50/70 border-amber-200/90 shadow-md',
    cardHover: 'hover:shadow-lg hover:border-amber-300',
  },
  APPOINTMENT_SET: {
    column: 'bg-gradient-to-b from-blue-100 via-indigo-50 to-violet-100 border-blue-300/80 shadow-xl',
    header: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 text-white shadow-lg',
    card: 'bg-gradient-to-br from-white via-blue-50/90 to-indigo-50/70 border-blue-200/90 shadow-md',
    cardHover: 'hover:shadow-lg hover:border-blue-300',
  },
  QUALIFIER_CALLBACK: {
    column: 'bg-gradient-to-b from-violet-100 via-purple-50 to-fuchsia-100 border-violet-300/80 shadow-xl',
    header: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-600 text-white shadow-lg',
    card: 'bg-gradient-to-br from-white via-violet-50/90 to-purple-50/70 border-violet-200/90 shadow-md',
    cardHover: 'hover:shadow-lg hover:border-violet-300',
  },
  NO_CONTACT: {
    column: 'bg-gradient-to-b from-slate-100 via-gray-50 to-slate-100 border-slate-300/80 shadow-xl',
    header: 'bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600 text-white shadow-lg',
    card: 'bg-gradient-to-br from-white via-slate-50/90 to-gray-50/70 border-slate-200/90 shadow-md',
    cardHover: 'hover:shadow-lg hover:border-slate-300',
  },
  NOT_INTERESTED: {
    column: 'bg-gradient-to-b from-rose-100 via-red-50 to-pink-100 border-rose-300/80 shadow-xl',
    header: 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white shadow-lg',
    card: 'bg-gradient-to-br from-white via-rose-50/90 to-red-50/70 border-rose-200/90 shadow-md',
    cardHover: 'hover:shadow-lg hover:border-rose-300',
  },
};

export interface QualifierLead {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  status: string;
  assignedAgent?: { fullName?: string };
  assignedQualifier?: { fullName?: string };
  createdAt?: string;
}

function QualifierLeadCardInner({
  lead,
  onClick,
  isDragging,
  stageKey,
}: {
  lead: QualifierLead;
  onClick?: () => void;
  isDragging?: boolean;
  stageKey?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging: dndDragging } = useDraggable({
    id: lead.id,
  });
  const dragging = isDragging ?? dndDragging;
  const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
  const styles = stageKey ? STAGE_STYLES[stageKey] : STAGE_STYLES.QUALIFYING;
  const cardStyle = styles?.card ?? STAGE_STYLES.QUALIFYING.card;
  const cardHover = styles?.cardHover ?? STAGE_STYLES.QUALIFYING.cardHover;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border-2 p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200',
        'overflow-hidden',
        cardStyle,
        !dragging && onClick && cardHover,
        dragging && 'opacity-95 shadow-2xl scale-105 ring-2 ring-white/80 ring-offset-2'
      )}
    >
      {/* Glossy top highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl" />
      <div className="relative flex items-start gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-gray-900 truncate">{name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {lead.phone || lead.email || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function QualifierColumnInner({
  id,
  title,
  leads,
  onCardClick,
  stageKey,
  icon: Icon,
}: {
  id: string;
  title: string;
  leads: QualifierLead[];
  onCardClick: (lead: QualifierLead) => void;
  stageKey: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const styles = STAGE_STYLES[stageKey] ?? STAGE_STYLES.QUALIFYING;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-[280px] flex-shrink-0 rounded-2xl border-2 transition-all duration-200 overflow-hidden',
        styles.column,
        isOver && 'ring-2 ring-offset-2 ring-white/80 scale-[1.02]'
      )}
    >
      <div className={cn('relative px-4 py-3.5 border-b border-white/30 overflow-hidden', styles.header)}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0 opacity-90 drop-shadow-sm" />
          <span className="font-semibold text-sm tracking-wide drop-shadow-sm">{title}</span>
        </div>
        <div className="relative text-white/90 text-xs mt-1 font-medium">{leads.length} lead{leads.length !== 1 ? 's' : ''}</div>
      </div>
      <ScrollArea className="h-[380px]">
        <div className="p-3 space-y-3">
          {leads.map((lead) => (
            <QualifierLeadCardInner
              key={lead.id}
              lead={lead}
              onClick={() => onCardClick(lead)}
              stageKey={stageKey}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface QualifierKanbanProps {
  leads?: QualifierLead[];
  loading?: boolean;
  onUpdated?: () => void;
}

export function QualifierKanban({ leads: leadsProp = [], loading = false, onUpdated }: QualifierKanbanProps = {}) {
  const [leads, setLeads] = useState<QualifierLead[]>(leadsProp);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    setLeads(leadsProp);
  }, [leadsProp]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over?.id) return;
    const leadId = active.id as string;
    const newStatus = over.id as string;
    if (!QUALIFIER_STAGES.some((s) => s.key === newStatus)) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    try {
      await updateLeadStatus(leadId, newStatus);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );
      onUpdated?.();
    } catch {
      onUpdated?.();
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;
  const leadsByStatus = (status: string) => leads.filter((l) => l.status === status);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-xl">
        <CardHeader className="border-b bg-gradient-to-r from-slate-100/80 to-slate-50/80">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Qualification Pipeline
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag cards between columns to update status. Click a card to view details and qualify.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex gap-5 overflow-x-auto py-4">
              {QUALIFIER_STAGES.map((s) => (
                <div
                  key={s.key}
                  className="min-w-[280px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 animate-pulse h-80"
                />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToHorizontalAxis]}
            >
              <div className="flex gap-5 overflow-x-auto pb-6 px-1">
                {QUALIFIER_STAGES.map((stage) => (
                  <QualifierColumnInner
                    key={stage.key}
                    id={stage.key}
                    title={stage.label}
                    leads={leadsByStatus(stage.key)}
                    onCardClick={(l) => setSelectedLeadId(l.id)}
                    stageKey={stage.key}
                    icon={stage.icon}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeLead ? (
                  <QualifierLeadCardInner
                    lead={activeLead}
                    isDragging
                    stageKey={activeLead.status}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
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

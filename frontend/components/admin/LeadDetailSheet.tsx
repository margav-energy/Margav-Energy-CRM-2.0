import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { getLeadById, getLeadActivity, sendSmsToLead } from '../../lib/api';
import { Phone, MessageSquare, Calendar, Mail, MapPin, FileEdit, CheckCircle } from 'lucide-react';
import { AgentLeadForm } from '../AgentLeadForm';
import { QualifierLeadModal } from '../QualifierLeadModal';
import { useAuth } from '../../lib/auth-context';
function formatTimeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface LeadDetailSheetProps {
  leadId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

type ActivityItem = {
  type: string;
  id: string;
  createdAt: string;
  [key: string]: unknown;
};

export function LeadDetailSheet({ leadId, onClose, onUpdated }: LeadDetailSheetProps) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showQualifyForm, setShowQualifyForm] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setActivity([]);
      return;
    }
    setLoading(true);
    Promise.all([getLeadById(leadId), getLeadActivity(leadId)])
      .then(([l, a]) => {
        setLead(l as Record<string, unknown>);
        setActivity((a as ActivityItem[]) ?? []);
      })
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [leadId]);

  const handleSendSms = async () => {
    if (!leadId || !smsInput.trim()) return;
    setSendingSms(true);
    try {
      await sendSmsToLead(leadId, smsInput.trim());
      setSmsInput('');
      onUpdated?.();
      const a = await getLeadActivity(leadId);
      setActivity((a as ActivityItem[]) ?? []);
    } finally {
      setSendingSms(false);
    }
  };

  const phone = lead?.phone as string | undefined;
  const leadName = lead
    ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim()
    : '';

  return (
    <Sheet open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{loading ? 'Loading...' : leadName || 'Lead'}</SheetTitle>
        </SheetHeader>

        {lead && (
          <>
            {/* Quick actions */}
            <div className="p-4 flex gap-2 border-b">
              {phone && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a href={`tel:${phone}`}>
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => document.getElementById('sms-input')?.focus()}>
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={import.meta.env.VITE_SURVEY_LINK || 'https://calendly.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Schedule
                </a>
              </Button>
              {(user?.role === 'AGENT' || user?.role === 'ADMIN') && (
                <Button size="sm" variant="outline" onClick={() => setShowLeadForm(true)}>
                  <FileEdit className="h-4 w-4 mr-1" />
                  Agent Lead Sheet
                </Button>
              )}
              {(user?.role === 'QUALIFIER' || user?.role === 'ADMIN') && (
                <Button size="sm" variant="outline" onClick={() => setShowQualifyForm(true)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Qualifier Sheet
                </Button>
              )}
            </div>

            {/* Contact info */}
            <div className="p-4 space-y-2">
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${phone}`} className="text-primary hover:underline">
                    {phone}
                  </a>
                </div>
              )}
              {lead.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${String(lead.email)}`} className="text-primary hover:underline">
                    {String(lead.email)}
                  </a>
                </div>
              ) : null}
              {(lead.addressLine1 || lead.city || lead.postcode) ? (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>
                    {[lead.addressLine1, lead.city, lead.postcode]
                      .filter(Boolean)
                      .map((x) => String(x))
                      .join(', ')}
                  </span>
                </div>
              ) : null}
              {lead.status ? (
                <Badge variant="secondary">{String(lead.status).replace(/_/g, ' ')}</Badge>
              ) : null}
            </div>

            {/* Send SMS */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  id="sms-input"
                  value={smsInput}
                  onChange={(e) => setSmsInput(e.target.value)}
                  placeholder="Type SMS..."
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={handleSendSms} disabled={sendingSms || !smsInput.trim()}>
                  Send
                </Button>
              </div>
            </div>

            <Separator />

            {/* Activity timeline */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 font-medium">Activity</div>
              <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-4">
                  {activity.length === 0 && (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  )}
                  {activity.map((item) => (
                    <ActivityItemRow key={item.id} item={item} />
                  ))}
                </div>
              </ScrollArea>
            </div>

            <AgentLeadForm
              lead={lead as import('../AgentLeadForm').MargavLead}
              open={showLeadForm}
              onClose={() => setShowLeadForm(false)}
              onSaved={() => {
                onUpdated?.();
                getLeadById(leadId!).then((l) => setLead(l as Record<string, unknown>));
              }}
            />
            <QualifierLeadModal
              lead={lead as import('../QualifierLeadModal').QualifierLead}
              open={showQualifyForm}
              onClose={() => setShowQualifyForm(false)}
              onSuccess={(updated) => {
                onUpdated?.();
                if (updated) setLead(updated as Record<string, unknown>);
                else getLeadById(leadId!).then((l) => setLead(l as Record<string, unknown>));
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  const date = item.createdAt ? new Date(item.createdAt) : null;
  const timeAgo = date ? formatTimeAgo(date) : '';

  if (item.type === 'sms') {
    const dir = item.direction === 'OUTBOUND' ? 'out' : 'in';
    return (
      <div className={`flex ${dir === 'out' ? 'justify-end' : ''}`}>
        <div
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            dir === 'out' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
        >
          <div>{String(item.body)}</div>
          <div className="text-xs opacity-80 mt-1">{timeAgo}</div>
        </div>
      </div>
    );
  }

  if (item.type === 'status_change') {
    return (
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
        <div>
          <div className="text-sm">
            Status: {item.fromStatus ? `${String(item.fromStatus).replace(/_/g, ' ')} → ` : ''}
            {String(item.toStatus).replace(/_/g, ' ')}
            {item.changedBy ? ` by ${String((item.changedBy as { fullName?: string })?.fullName ?? '')}` : ''}
          </div>
          {item.note ? <div className="text-xs text-muted-foreground">{String(item.note)}</div> : null}
          <div className="text-xs text-muted-foreground">{timeAgo}</div>
        </div>
      </div>
    );
  }

  if (item.type === 'note') {
    return (
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
        <div>
          <div className="text-sm">{String(item.content)}</div>
          <div className="text-xs text-muted-foreground">
            {timeAgo}
            {(item.createdBy as { fullName?: string })?.fullName
              ? ` · ${String((item.createdBy as { fullName?: string }).fullName)}`
              : ''}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'task') {
    return (
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
        <div>
          <div className="text-sm font-medium">{String(item.title)}</div>
          <div className="text-xs text-muted-foreground">
            {String(item.status)} · Due {item.dueDate ? formatTimeAgo(new Date(String(item.dueDate))) : ''}
            {(item.assignedTo as { fullName?: string })?.fullName
              ? ` · ${String((item.assignedTo as { fullName?: string }).fullName)}`
              : ''}
          </div>
          <div className="text-xs text-muted-foreground">{timeAgo}</div>
        </div>
      </div>
    );
  }

  if (item.type === 'call') {
    return (
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
        <div>
          <div className="text-sm">Call: {String(item.outcome).replace(/_/g, ' ')}</div>
          {item.notes ? <div className="text-xs text-muted-foreground">{String(item.notes)}</div> : null}
          <div className="text-xs text-muted-foreground">{timeAgo}</div>
        </div>
      </div>
    );
  }

  if (item.type === 'activity') {
    const label = String(item.eventType ?? '').replace(/_/g, ' ').toLowerCase();
    return (
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
        <div>
          <div className="text-sm capitalize">{label}</div>
          <div className="text-xs text-muted-foreground">{timeAgo}</div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Qualify Lead Form - for qualifiers to review and qualify leads.
 * Adapted for Margav CRM schema.
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { updateLead, updateLeadStatus, createAppointment, getFieldSalesReps, getAppointments } from '../lib/api';

const QUALIFIER_SECTION = '--- QUALIFIER NOTES ---';

function splitAgentAndQualifierNotes(notes: string): { agentNotes: string; qualifierNotes: string } {
  if (!notes) return { agentNotes: '', qualifierNotes: '' };
  const idx = notes.indexOf(QUALIFIER_SECTION);
  if (idx >= 0) {
    return {
      agentNotes: notes.slice(0, idx).trim(),
      qualifierNotes: notes.slice(idx + QUALIFIER_SECTION.length).trim(),
    };
  }
  return { agentNotes: notes, qualifierNotes: '' };
}

function mergeNotes(agentNotes: string, qualifierNotes: string): string {
  if (!qualifierNotes.trim()) return agentNotes;
  return `${agentNotes}\n\n${QUALIFIER_SECTION}\n${qualifierNotes.trim()}`;
}

const STATUS_MAP: Record<string, string> = {
  qualified: 'QUALIFIED',
  appointment_set: 'APPOINTMENT_SET',
  no_contact: 'CONTACTED',
  not_interested: 'NOT_INTERESTED',
  blow_out: 'NOT_INTERESTED',
  pass_back_to_agent: 'INTERESTED',
  on_hold: 'QUALIFYING',
};

export interface MargavLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  status?: string;
  assignedAgent?: { fullName?: string } | null;
  assignedFieldSalesRep?: { fullName?: string } | null;
  appointments?: Array<{ scheduledAt: string; fieldSalesRep?: { fullName?: string } }>;
  createdAt?: string;
  updatedAt?: string;
}

interface QualifyLeadFormProps {
  lead: MargavLead | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'qualified', label: 'Qualified', color: 'text-green-600' },
  { value: 'appointment_set', label: 'Appointment Set', color: 'text-purple-600' },
  { value: 'no_contact', label: 'No Contact', color: 'text-yellow-600' },
  { value: 'not_interested', label: 'Not Interested', color: 'text-red-600' },
  { value: 'blow_out', label: 'Blow Out', color: 'text-red-600' },
  { value: 'pass_back_to_agent', label: 'Pass Back to Agent', color: 'text-blue-600' },
  { value: 'on_hold', label: 'On Hold', color: 'text-orange-600' },
];

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  return { firstName: name.trim() || 'Unknown', lastName: 'Lead' };
}

export function QualifyLeadForm({ lead, open, onClose, onSaved }: QualifyLeadFormProps) {
  const [status, setStatus] = useState('');
  const [qualifierNotes, setQualifierNotes] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [fieldSalesRepId, setFieldSalesRepId] = useState<string | null>(null);
  const [fieldSalesReps, setFieldSalesReps] = useState<Array<{ id: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address1, setAddress1] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');

  const [appointments, setAppointments] = useState<Array<{ scheduledAt: string; fieldSalesRep?: { fullName?: string } }>>([]);

  useEffect(() => {
    if (open) {
      getFieldSalesReps()
        .then((reps) => setFieldSalesReps(reps))
        .catch(() => setFieldSalesReps([]));
    }
  }, [open]);

  useEffect(() => {
    if (open && lead) {
      getAppointments({ leadId: lead.id })
        .then((res) => setAppointments((res.items as Array<{ scheduledAt: string; fieldSalesRep?: { fullName?: string } }>) ?? []))
        .catch(() => setAppointments([]));
    } else {
      setAppointments([]);
    }
  }, [open, lead?.id]);

  useEffect(() => {
    if (lead) {
      setFullName(`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim());
      setPhone(lead.phone ?? '');
      setEmail(lead.email ?? '');
      setAddress1(lead.addressLine1 ?? '');
      setCity(lead.city ?? '');
      setPostcode(lead.postcode ?? '');
      const { agentNotes: a, qualifierNotes: q } = splitAgentAndQualifierNotes(lead.notes ?? '');
      setAgentNotes(a);
      setQualifierNotes(q);
    }
  }, [lead]);

  useEffect(() => {
    const existingAppt = appointments[0];
    if (existingAppt?.scheduledAt) {
      try {
        const d = new Date(existingAppt.scheduledAt);
        setAppointmentDate(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        );
      } catch {
        setAppointmentDate('');
      }
    } else if (lead && !appointments.length) {
      setAppointmentDate('');
    }
  }, [appointments, lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    if (status === 'appointment_set') {
      if (!appointmentDate || !fieldSalesRepId) {
        return;
      }
    }

    setLoading(true);
    try {
      const margavStatus = STATUS_MAP[status] ?? status.toUpperCase().replace(/\s/g, '_');
      const { firstName, lastName } = splitName(fullName);

      const mergedNotes = mergeNotes(agentNotes, qualifierNotes);

      await updateLead(lead.id, {
        firstName,
        lastName,
        phone: phone.trim(),
        email: email.trim() || undefined,
        addressLine1: address1 || undefined,
        city: city || undefined,
        postcode: postcode || undefined,
        notes: mergedNotes || undefined,
        assignedFieldSalesRepId: fieldSalesRepId || undefined,
      });

      await updateLeadStatus(lead.id, margavStatus, qualifierNotes || undefined);

      if (status === 'appointment_set' && appointmentDate && fieldSalesRepId) {
        const scheduledAt = new Date(appointmentDate).toISOString();
        await createAppointment({
          leadId: lead.id,
          fieldSalesRepId,
          scheduledAt,
          notes: qualifierNotes || undefined,
        });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !lead) return null;

  const leadName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
  const nextAppt = appointments[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review & Qualify Lead</DialogTitle>
          <p className="text-sm text-muted-foreground">Review lead details and update status for {leadName}</p>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Agent's Lead Sheet (read-only) + contact corrections */}
          <div className="flex-1 space-y-4">
            <h3 className="text-lg font-semibold">Agent&apos;s Lead Sheet</h3>
            <p className="text-sm text-muted-foreground">Data from the agent. You may correct contact details if needed.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s()-]/g, ''))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Current Status</Label>
                <p className="py-2 px-3 rounded-md bg-muted text-sm capitalize">{String(lead.status ?? '').replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Agent&apos;s Notes &amp; Lead Data</Label>
              <div className="py-2 px-3 rounded-md bg-muted text-sm min-h-[80px] max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {agentNotes || 'No agent data yet'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assigned Agent</Label>
                <p className="py-2 px-3 rounded-md bg-muted text-sm">{lead.assignedAgent?.fullName ?? 'Not assigned'}</p>
              </div>
              <div>
                <Label>Field Sales Rep</Label>
                <p className="py-2 px-3 rounded-md bg-muted text-sm">{lead.assignedFieldSalesRep?.fullName ?? 'Not assigned'}</p>
              </div>
            </div>
            {nextAppt && (
              <div>
                <Label>Current Appointment</Label>
                <p className="py-2 px-3 rounded-md bg-muted text-sm">
                  {new Date(nextAppt.scheduledAt).toLocaleString()}
                  {nextAppt.fieldSalesRep?.fullName && ` · ${nextAppt.fieldSalesRep.fullName}`}
                </p>
              </div>
            )}
            {(lead.createdAt || lead.updatedAt) && (
              <div className="grid grid-cols-2 gap-4">
                {lead.createdAt && (
                  <div>
                    <Label>Created</Label>
                    <p className="py-2 px-3 rounded-md bg-muted text-sm">{new Date(lead.createdAt).toLocaleString()}</p>
                  </div>
                )}
                {lead.updatedAt && (
                  <div>
                    <Label>Last Updated</Label>
                    <p className="py-2 px-3 rounded-md bg-muted text-sm">{new Date(lead.updatedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Qualifier's Section */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-4">Your Qualification</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your qualification decision and notes. Agent&apos;s data is preserved.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>New Status *</Label>
                <Select value={status} onValueChange={setStatus} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualifier Notes</Label>
                <Textarea
                  value={qualifierNotes}
                  onChange={(e) => setQualifierNotes(e.target.value)}
                  rows={3}
                  placeholder="Add your qualification notes (call outcome, assessment, etc.)..."
                />
              </div>
              <div>
                <Label>Assign Field Sales Rep</Label>
                <Select value={fieldSalesRepId ?? ''} onValueChange={(v) => setFieldSalesRepId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field sales rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldSalesReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {status === 'appointment_set' && (
                <div>
                  <Label>Schedule Appointment *</Label>
                  <Input
                    type="datetime-local"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required={status === 'appointment_set'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Field sales rep must be assigned for appointment.</p>
                </div>
              )}
              {status === 'no_contact' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800">No Contact Selected</p>
                  <p className="text-xs text-amber-700">This lead will be moved to Contacted for follow-up.</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !status}>
                  {loading ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

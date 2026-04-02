/**
 * Agent Lead Sheet - comprehensive qualification form for agents.
 * Adapted for Margav CRM schema. Extended data stored in notes.
 */
import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { createLead, updateLead, updateLeadStatus, createTask, getMe } from '../lib/api';

const DETAILED_SECTION = '--- DETAILED LEAD INFORMATION ---';

/** Yes / No (stored as true | false). Legacy "Unsure" in notes maps to unset. */
function parseYesNo(val: string): string {
  const v = val.trim().toLowerCase();
  if (v === 'yes') return 'true';
  if (v === 'no') return 'false';
  return '';
}

function formatYesNo(val: string): string {
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  return '';
}

/** Yes / No / Unsure — only used for spray foam in roof */
function parseTriState(val: string): string {
  const v = val.trim().toLowerCase();
  if (v === 'yes') return 'true';
  if (v === 'no') return 'false';
  if (v === 'unsure') return 'unsure';
  return '';
}

function parseOwnership(val: string): string {
  const v = val.trim().toLowerCase();
  if (v === 'yes') return 'yes';
  if (v === 'no') return 'no';
  return '';
}

function formatTriState(val: string): string {
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  if (val === 'unsure') return 'Unsure';
  return '';
}

const ENERGY_PROVIDER_LABELS: Record<string, string> = {
  british_gas: 'British Gas',
  octopus_energy: 'Octopus Energy',
  ovo_energy: 'OVO Energy',
  edf_energy: 'EDF Energy',
  eon_next: 'E.ON Next',
  eon: 'E.ON',
  scottish_power: 'Scottish Power',
  sse: 'SSE / OVO (SSE)',
  shell_energy: 'Shell Energy',
  utilita: 'Utilita',
  so_energy: 'So Energy',
  outfox: 'Outfox the Market',
  good_energy: 'Good Energy',
  ecotricity: 'Ecotricity',
  bulb: 'Bulb',
  other: 'Other',
};

function parseEnergySupplierFromNotes(parsed: Record<string, string>): { supplier: string; other: string } {
  const raw = (parsed['Current Energy Supplier'] ?? '').trim();
  if (!raw) return { supplier: '', other: '' };
  const lower = raw.toLowerCase();
  if (lower.startsWith('other')) {
    const m = raw.match(/Other\s*\(([^)]+)\)/i);
    return { supplier: 'other', other: m ? m[1].trim() : '' };
  }
  const byKey = Object.keys(ENERGY_PROVIDER_LABELS).find((k) => k === lower);
  if (byKey) return { supplier: byKey, other: '' };
  const byLabel = Object.entries(ENERGY_PROVIDER_LABELS).find(([, label]) => label.toLowerCase() === lower);
  if (byLabel) return { supplier: byLabel[0], other: '' };
  return { supplier: 'other', other: raw };
}

function formatEnergySupplierLine(form: Record<string, string>): string {
  if (!form.current_energy_supplier) return '';
  if (form.current_energy_supplier === 'other') {
    const o = form.energy_provider_other?.trim();
    return o ? `Other (${o})` : 'Other';
  }
  return ENERGY_PROVIDER_LABELS[form.current_energy_supplier] || form.current_energy_supplier;
}

const PREFERRED_TIME_LABELS: Record<string, string> = {
  morning: 'Morning (9AM – 12PM)',
  afternoon: 'Afternoon (12PM – 5PM)',
  evening: 'Evening (5PM – 8PM)',
  anytime: 'Anytime',
};

function parsePreferredContactTime(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const entry = Object.entries(PREFERRED_TIME_LABELS).find(([, label]) => label === t);
  if (entry) return entry[0];
  const lower = t.toLowerCase();
  if (['morning', 'afternoon', 'evening', 'anytime'].includes(lower)) return lower;
  return t;
}

function parseNotesData(notes: string): Record<string, string> {
  const data: Record<string, string> = {};
  if (!notes) return data;

  const lines = notes.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key && value) data[key] = value;
    }
  }

  const sectionIdx = notes.indexOf(DETAILED_SECTION);
  if (sectionIdx > 0) {
    data._notesOnly = notes.slice(0, sectionIdx).trim();
  }
  return data;
}

function buildDetailedNotes(form: Record<string, string>): string {
  const parts: string[] = [];
  const add = (label: string, val: string) => {
    if (val) parts.push(`${label}: ${val}`);
  };
  add('Preferred Contact Time', PREFERRED_TIME_LABELS[form.preferred_contact_time] || form.preferred_contact_time);
  add(
    'Property Ownership',
    form.property_ownership === 'yes' ? 'Yes' : form.property_ownership === 'no' ? 'No' : ''
  );
  add('Lives with Partner', formatYesNo(form.lives_with_partner));
  add('Age Range 18-74', formatYesNo(form.age_range_18_74));
  add('Moving Within 5 Years', formatYesNo(form.moving_within_5_years));
  add('Property Type', form.property_type);
  add('Number of Bedrooms', form.number_of_bedrooms);
  add('Roof Type', form.roof_type);
  add('Roof Material', form.roof_material);
  add('Loft Conversions', formatYesNo(form.loft_conversions));
  add('Velux Windows', formatYesNo(form.velux_windows));
  add('Dormers', formatYesNo(form.dormers));
  add('Spray Foam Roof', formatTriState(form.spray_foam_roof));
  add('Building Work on Roof', formatYesNo(form.building_work_roof));
  if (form.monthly_electricity_spend) parts.push(`Monthly Electricity Spend (over £60): £${form.monthly_electricity_spend}`);
  add('Has EV Charger', formatYesNo(form.has_ev_charger));
  add('Day/Night Rate', form.day_night_rate);
  add('Current Energy Supplier', formatEnergySupplierLine(form));
  add('Electric Heating/Appliances', form.electric_heating_appliances);
  add('Energy Details', form.energy_details);
  add('Employment Status', form.employment_status);
  add('Debt Management/Bankruptcy', formatYesNo(form.debt_management_bankruptcy));
  add('Government Grants Aware', formatYesNo(form.government_grants_aware));
  add('Timeframe', form.timeframe);
  add('Timeframe Details', form.timeframe_details);
  if (form.previous_quotes_details?.trim()) parts.push(`Previous Quote: ${form.previous_quotes_details.trim()}`);
  add('Assessment Date Preference', form.assessment_date_preference);
  add('Assessment Time Preference', form.assessment_time_preference);

  return parts.join('\n');
}

export interface MargavLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
  status?: string;
  interestLevel?: string | null;
  homeowner?: boolean | null;
  monthlyEnergyBill?: number | null;
  roofCondition?: string | null;
}

interface AgentLeadFormProps {
  lead?: MargavLead | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  openCallbackOnMount?: boolean;
  prepopulatedData?: {
    full_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    postcode?: string;
    notes?: string;
    first_name?: string;
    last_name?: string;
    address1?: string;
    city?: string;
    postal_code?: string;
    comments?: string;
  };
}

const inputBorderClass = 'border-2 border-gray-300';

const YN_UNSET = '_unset';

function OptionalYesNoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || YN_UNSET} onValueChange={(v) => onChange(v === YN_UNSET ? '' : v)}>
      <SelectTrigger className={inputBorderClass}>
        <SelectValue placeholder="Optional" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={YN_UNSET}>—</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Yes / No / Unsure — spray foam only */
function SprayFoamTriSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || YN_UNSET} onValueChange={(v) => onChange(v === YN_UNSET ? '' : v)}>
      <SelectTrigger className={inputBorderClass}>
        <SelectValue placeholder="Optional" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={YN_UNSET}>—</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
        <SelectItem value="unsure">Unsure</SelectItem>
      </SelectContent>
    </Select>
  );
}

const ROOF_YES_NO_QUESTIONS: { key: string; label: string }[] = [
  { key: 'loft_conversions', label: 'Any loft conversions?' },
  { key: 'velux_windows', label: 'Any solar / Velux windows?' },
  { key: 'dormers', label: 'Any dormers?' },
  { key: 'building_work_roof', label: 'Planning any building work on your roof?' },
];

function FormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-6 last:border-0">
      <h4 className="text-lg font-medium mb-4">{icon} {title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

const defaultForm: Record<string, string> = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  postcode: '',
  preferred_contact_time: '',
  property_ownership: '',
  lives_with_partner: '',
  age_range_18_74: '',
  moving_within_5_years: '',
  property_type: '',
  number_of_bedrooms: '',
  roof_type: '',
  roof_material: '',
  loft_conversions: '',
  velux_windows: '',
  dormers: '',
  spray_foam_roof: '',
  building_work_roof: '',
  monthly_electricity_spend: '',
  has_ev_charger: '',
  day_night_rate: '',
  current_energy_supplier: '',
  energy_provider_other: '',
  electric_heating_appliances: '',
  energy_details: '',
  employment_status: '',
  debt_management_bankruptcy: '',
  government_grants_aware: '',
  timeframe: '',
  timeframe_details: '',
  previous_quotes_details: '',
  assessment_date_preference: '',
  assessment_time_preference: '',
  notes: '',
};

export function AgentLeadForm({
  lead,
  open,
  onClose,
  onSaved,
  openCallbackOnMount,
  prepopulatedData,
}: AgentLeadFormProps) {
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((me) => setCurrentUserId(me.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && openCallbackOnMount && lead) {
      setShowCallbackDialog(true);
    }
  }, [open, openCallbackOnMount, lead]);

  useEffect(() => {
    if (!open) return;

    if (lead) {
      const parsed = parseNotesData(lead.notes ?? '');
      const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
      const { supplier: energySupplier, other: energyOther } = parseEnergySupplierFromNotes(parsed);
      const monthlyRaw =
        parsed['Monthly Electricity Spend (over £60)'] ??
        parsed['Monthly Electricity Spend'] ??
        '';
      setForm({
        ...defaultForm,
        full_name: name,
        phone: lead.phone ?? '',
        email: lead.email ?? '',
        address: lead.addressLine1 ?? parsed.address ?? parsed.Address ?? '',
        city: lead.city ?? parsed.city ?? parsed.City ?? '',
        postcode: lead.postcode ?? parsed.postcode ?? parsed.Postcode ?? parsed['Postal code'] ?? '',
        preferred_contact_time: parsePreferredContactTime(
          parsed['Preferred Contact Time'] ?? parsed['Preferred contact time'] ?? ''
        ),
        property_type: parsed['Property Type'] ?? parsed['Property type'] ?? '',
        number_of_bedrooms: parsed['Number of Bedrooms'] ?? parsed['Bedrooms'] ?? '',
        roof_type: parsed['Roof Type'] ?? parsed['Roof type'] ?? '',
        roof_material: parsed['Roof Material'] ?? parsed['Roof material'] ?? '',
        monthly_electricity_spend: lead.monthlyEnergyBill
          ? String(lead.monthlyEnergyBill)
          : monthlyRaw.replace(/[£,]/g, '').trim(),
        property_ownership:
          lead.homeowner === true
            ? 'yes'
            : lead.homeowner === false
              ? 'no'
              : parseOwnership(parsed['Property Ownership'] ?? parsed['Property ownership'] ?? ''),
        lives_with_partner: parseYesNo(parsed['Lives with Partner'] ?? parsed['Lives with partner'] ?? ''),
        age_range_18_74: parseYesNo(parsed['Age Range 18-74'] ?? parsed['Age range 18-74'] ?? ''),
        moving_within_5_years: parseYesNo(parsed['Moving Within 5 Years'] ?? parsed['Moving within 5 years'] ?? ''),
        loft_conversions: parseYesNo(parsed['Loft Conversions'] ?? ''),
        velux_windows: parseYesNo(parsed['Velux Windows'] ?? ''),
        dormers: parseYesNo(parsed['Dormers'] ?? ''),
        spray_foam_roof: parseTriState(parsed['Spray Foam Roof'] ?? ''),
        building_work_roof: parseYesNo(parsed['Building Work on Roof'] ?? ''),
        has_ev_charger: parseYesNo(parsed['Has EV Charger'] ?? ''),
        debt_management_bankruptcy: parseYesNo(parsed['Debt Management/Bankruptcy'] ?? ''),
        government_grants_aware: parseYesNo(parsed['Government Grants Aware'] ?? ''),
        current_energy_supplier: energySupplier,
        energy_provider_other: energyOther,
        electric_heating_appliances: parsed['Electric Heating/Appliances'] ?? '',
        energy_details: parsed['Energy Details'] ?? '',
        timeframe: parsed['Timeframe'] ?? '',
        timeframe_details: parsed['Timeframe Details'] ?? '',
        previous_quotes_details: parsed['Previous Quote'] ?? parsed['Previous Quotes Details'] ?? '',
        day_night_rate: (() => {
          const d = (parsed['Day/Night Rate'] ?? '').trim().toLowerCase();
          return d === 'unsure' ? '' : (parsed['Day/Night Rate'] ?? '');
        })(),
        employment_status: parsed['Employment Status'] ?? '',
        assessment_date_preference: parsed['Assessment Date Preference'] ?? '',
        assessment_time_preference: parsed['Assessment Time Preference'] ?? '',
        notes: parsed._notesOnly ?? (lead.notes ?? '').split(DETAILED_SECTION)[0]?.trim() ?? '',
      });
    } else if (prepopulatedData) {
      const name = prepopulatedData.full_name ?? [prepopulatedData.first_name, prepopulatedData.last_name].filter(Boolean).join(' ');
      setForm({
        ...defaultForm,
        full_name: name,
        phone: prepopulatedData.phone ?? '',
        email: prepopulatedData.email ?? '',
        address: prepopulatedData.address ?? prepopulatedData.address1 ?? '',
        city: prepopulatedData.city ?? '',
        postcode: prepopulatedData.postcode ?? prepopulatedData.postal_code ?? '',
        notes: prepopulatedData.comments ? `Dialer Comments: ${prepopulatedData.comments}` : (prepopulatedData.notes ?? ''),
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, lead, prepopulatedData]);

  const update = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.full_name?.trim()) e.full_name = 'Full name is required';
    if (!form.address?.trim()) e.address = 'Address is required';
    if (!form.postcode?.trim()) e.postcode = 'Postcode is required';
    if (!form.phone?.trim()) e.phone = 'Phone is required';
    else if (!/^[+]?[0-9\s\-()]{10,}$/.test(form.phone.trim())) e.phone = 'Phone must be valid';
    if (!form.email?.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.preferred_contact_time?.trim()) e.preferred_contact_time = 'Preferred contact time is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildNotes = () => {
    const notesOnly = (form.notes || '').split(DETAILED_SECTION)[0]?.trim() ?? '';
    const detailed = buildDetailedNotes(form);
    return detailed ? `${notesOnly}\n\n${DETAILED_SECTION}\n${detailed}` : notesOnly;
  };

  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }
    return { firstName: name.trim() || 'Unknown', lastName: 'Lead' };
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { firstName, lastName } = splitName(form.full_name);
      const notes = buildNotes();

      if (lead) {
        await updateLead(lead.id, {
          firstName,
          lastName,
          phone: form.phone.trim(),
          email: form.email.trim(),
          addressLine1: form.address || undefined,
          city: form.city || undefined,
          postcode: form.postcode || undefined,
          notes: notes || undefined,
          homeowner: form.property_ownership === 'yes' ? true : form.property_ownership === 'no' ? false : undefined,
          monthlyEnergyBill: form.monthly_electricity_spend ? parseFloat(form.monthly_electricity_spend) : undefined,
          roofCondition: form.roof_type || form.roof_material || undefined,
        });
      } else {
        await createLead({
          firstName,
          lastName,
          phone: form.phone.trim(),
          email: form.email.trim(),
          addressLine1: form.address || undefined,
          city: form.city || undefined,
          postcode: form.postcode || undefined,
          notes: notes || undefined,
          source: 'Agent',
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToQualifier = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (lead?.id) {
        const { firstName, lastName } = splitName(form.full_name);
        const notes = buildNotes();
        await updateLead(lead.id, {
          firstName,
          lastName,
          phone: form.phone.trim(),
          email: form.email.trim(),
          addressLine1: form.address || undefined,
          city: form.city || undefined,
          postcode: form.postcode || undefined,
          notes: notes || undefined,
        });
        await updateLeadStatus(lead.id, 'QUALIFYING', 'Sent to qualifier from lead sheet');
      } else {
        const { firstName, lastName } = splitName(form.full_name);
        const notes = buildNotes();
        await createLead({
          firstName,
          lastName,
          phone: form.phone.trim(),
          email: form.email.trim(),
          addressLine1: form.address || undefined,
          city: form.city || undefined,
          postcode: form.postcode || undefined,
          notes: notes || undefined,
          source: 'Agent',
          status: 'QUALIFYING',
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleCallback = async () => {
    if (!callbackDateTime || !currentUserId) return;
    setLoading(true);
    try {
      const due = new Date(callbackDateTime);
      if (lead) {
        await createTask({
          title: 'Callback - ' + (form.full_name || 'Lead'),
          description: `Call back scheduled from lead sheet. Phone: ${form.phone}`,
          type: 'CALL',
          priority: 'HIGH',
          dueDate: due.toISOString(),
          assignedToUserId: currentUserId,
          leadId: lead.id,
        });
      }
      setShowCallbackDialog(false);
      setCallbackDateTime('');
      onSaved?.();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to schedule callback' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Complete Lead Sheet' : 'New Lead'}</DialogTitle>
          <DialogDescription className="sr-only">
            Enter or update lead contact and property details for the agent lead sheet.
          </DialogDescription>
        </DialogHeader>

        {Object.keys(errors).length > 0 && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {Object.entries(errors).map(([k, v]) => (
              <div key={k}>{v}</div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          <FormSection title="Contact Information" icon="📞">
            <div className="md:col-span-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} className={errors.full_name ? 'border-destructive' : inputBorderClass} />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={errors.phone ? 'border-destructive' : inputBorderClass} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={errors.email ? 'border-destructive' : inputBorderClass} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className={errors.address ? 'border-destructive' : inputBorderClass}
              />
              {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} className={inputBorderClass} />
            </div>
            <div>
              <Label htmlFor="postcode">Postcode *</Label>
              <Input id="postcode" value={form.postcode} onChange={(e) => update('postcode', e.target.value)} className={errors.postcode ? 'border-destructive' : inputBorderClass} />
              {errors.postcode && <p className="text-sm text-destructive">{errors.postcode}</p>}
            </div>
            <div>
              <Label htmlFor="preferred_contact_time">Preferred contact time *</Label>
              <Select value={form.preferred_contact_time} onValueChange={(v) => update('preferred_contact_time', v)}>
                <SelectTrigger
                  className={`${errors.preferred_contact_time ? 'border-destructive ' : ''}${inputBorderClass}`}
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{PREFERRED_TIME_LABELS.morning}</SelectItem>
                  <SelectItem value="afternoon">{PREFERRED_TIME_LABELS.afternoon}</SelectItem>
                  <SelectItem value="evening">{PREFERRED_TIME_LABELS.evening}</SelectItem>
                  <SelectItem value="anytime">{PREFERRED_TIME_LABELS.anytime}</SelectItem>
                </SelectContent>
              </Select>
              {errors.preferred_contact_time && (
                <p className="text-sm text-destructive">{errors.preferred_contact_time}</p>
              )}
            </div>
          </FormSection>

          <FormSection title="Property Information" icon="🏠">
            <div>
              <Label>Do you own the property?</Label>
              <Select
                value={form.property_ownership || YN_UNSET}
                onValueChange={(v) => update('property_ownership', v === YN_UNSET ? '' : v)}
              >
                <SelectTrigger className={inputBorderClass}>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={YN_UNSET}>—</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Do you live there with a partner?</Label>
              <OptionalYesNoSelect value={form.lives_with_partner} onChange={(v) => update('lives_with_partner', v)} />
            </div>
            <div>
              <Label>Are you between 18 and 74 years old?</Label>
              <OptionalYesNoSelect value={form.age_range_18_74} onChange={(v) => update('age_range_18_74', v)} />
            </div>
            <div>
              <Label>Are you planning on moving within the next 5 years?</Label>
              <OptionalYesNoSelect value={form.moving_within_5_years} onChange={(v) => update('moving_within_5_years', v)} />
            </div>
            <div>
              <Label>Property Type</Label>
              <Select value={form.property_type} onValueChange={(v) => update('property_type', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="detached">Detached</SelectItem>
                  <SelectItem value="semi_detached">Semi-Detached</SelectItem>
                  <SelectItem value="terraced">Terraced</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="bungalow">Bungalow</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bedrooms</Label>
              <Select value={form.number_of_bedrooms} onValueChange={(v) => update('number_of_bedrooms', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5+">5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Roof Type</Label>
              <Select value={form.roof_type} onValueChange={(v) => update('roof_type', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pitched">Pitched</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Roof Material</Label>
              <Select value={form.roof_material} onValueChange={(v) => update('roof_material', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiles">Tiles</SelectItem>
                  <SelectItem value="slate">Slate</SelectItem>
                  <SelectItem value="metal">Metal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Roof & Property Condition" icon="🏗️">
            {ROOF_YES_NO_QUESTIONS.map(({ key, label }) => (
              <div key={key}>
                <Label>{label}</Label>
                <OptionalYesNoSelect value={form[key]} onChange={(v) => update(key, v)} />
              </div>
            ))}
            <div>
              <Label>Any spray foam in the roof?</Label>
              <SprayFoamTriSelect value={form.spray_foam_roof} onChange={(v) => update('spray_foam_roof', v)} />
            </div>
          </FormSection>

          <FormSection title="Energy Usage" icon="⚡">
            <div>
              <Label>EV charger</Label>
              <OptionalYesNoSelect value={form.has_ev_charger} onChange={(v) => update('has_ev_charger', v)} />
            </div>
            <div>
              <Label>Day/Night Rate</Label>
              <Select value={form.day_night_rate} onValueChange={(v) => update('day_night_rate', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Energy provider</Label>
              <Select
                value={form.current_energy_supplier}
                onValueChange={(v) => {
                  update('current_energy_supplier', v);
                  if (v !== 'other') update('energy_provider_other', '');
                }}
              >
                <SelectTrigger className={inputBorderClass}>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="british_gas">British Gas</SelectItem>
                  <SelectItem value="octopus_energy">Octopus Energy</SelectItem>
                  <SelectItem value="ovo_energy">OVO Energy</SelectItem>
                  <SelectItem value="edf_energy">EDF Energy</SelectItem>
                  <SelectItem value="eon_next">E.ON Next</SelectItem>
                  <SelectItem value="eon">E.ON</SelectItem>
                  <SelectItem value="scottish_power">Scottish Power</SelectItem>
                  <SelectItem value="sse">SSE / OVO (SSE)</SelectItem>
                  <SelectItem value="shell_energy">Shell Energy</SelectItem>
                  <SelectItem value="utilita">Utilita</SelectItem>
                  <SelectItem value="so_energy">So Energy</SelectItem>
                  <SelectItem value="outfox">Outfox the Market</SelectItem>
                  <SelectItem value="good_energy">Good Energy</SelectItem>
                  <SelectItem value="ecotricity">Ecotricity</SelectItem>
                  <SelectItem value="bulb">Bulb</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.current_energy_supplier === 'other' && (
              <div>
                <Label htmlFor="energy_provider_other">Provider name (if other)</Label>
                <Input
                  id="energy_provider_other"
                  value={form.energy_provider_other}
                  onChange={(e) => update('energy_provider_other', e.target.value)}
                  placeholder="e.g. regional supplier"
                  className={inputBorderClass}
                />
              </div>
            )}
            <div>
              <Label>Electric Heating/Appliances</Label>
              <Select value={form.electric_heating_appliances} onValueChange={(v) => update('electric_heating_appliances', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gas_heating">Gas Heating</SelectItem>
                  <SelectItem value="electric_heating">Electric Heating</SelectItem>
                  <SelectItem value="heat_pump">Heat Pump</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Energy Details</Label>
              <Textarea value={form.energy_details} onChange={(e) => update('energy_details', e.target.value)} rows={2} className={inputBorderClass} />
            </div>
          </FormSection>

          <FormSection title="Financial & Employment" icon="💰">
            <div>
              <Label>Current monthly electricity spend (over £60)?</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">£</span>
                <Input
                  type="number"
                  min={0}
                  value={form.monthly_electricity_spend}
                  onChange={(e) => update('monthly_electricity_spend', e.target.value)}
                  placeholder="e.g. 85"
                  className={inputBorderClass}
                />
              </div>
            </div>
            <div>
              <Label>Are you employed, unemployed, self-employed, or retired?</Label>
              <Select value={form.employment_status} onValueChange={(v) => update('employment_status', v)}>
                <SelectTrigger className={inputBorderClass}>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                  <SelectItem value="self-employed">Self-employed</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>You or a partner under a Debt Management Plan or bankruptcy?</Label>
              <OptionalYesNoSelect
                value={form.debt_management_bankruptcy}
                onChange={(v) => update('debt_management_bankruptcy', v)}
              />
            </div>
            <div>
              <Label>Aware there are no government grants for solar?</Label>
              <OptionalYesNoSelect
                value={form.government_grants_aware}
                onChange={(v) => update('government_grants_aware', v)}
              />
            </div>
          </FormSection>

          <FormSection title="Timeframe & Interest" icon="⏰">
            <div>
              <Label>Timeframe</Label>
              <Select value={form.timeframe} onValueChange={(v) => update('timeframe', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediately">Immediately</SelectItem>
                  <SelectItem value="within_month">Within a month</SelectItem>
                  <SelectItem value="within_3_months">Within 3 months</SelectItem>
                  <SelectItem value="within_6_months">Within 6 months</SelectItem>
                  <SelectItem value="within_year">Within a year</SelectItem>
                  <SelectItem value="just_researching">Just researching</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Previous quote (if any)</Label>
              <Textarea
                value={form.previous_quotes_details}
                onChange={(e) => update('previous_quotes_details', e.target.value)}
                rows={3}
                placeholder="Company, price, date — optional"
                className={inputBorderClass}
              />
            </div>
            <div>
              <Label>Assessment Date Preference</Label>
              <Input type="date" value={form.assessment_date_preference} onChange={(e) => update('assessment_date_preference', e.target.value)} className={inputBorderClass} />
            </div>
            <div>
              <Label>Assessment Time Preference</Label>
              <Input type="time" value={form.assessment_time_preference} onChange={(e) => update('assessment_time_preference', e.target.value)} className={inputBorderClass} />
            </div>
          </FormSection>

          <div className="border-b border-border pb-6">
            <h4 className="text-lg font-medium mb-4">📝 Notes</h4>
            <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} placeholder="Additional notes..." className={inputBorderClass} />
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="outline" onClick={() => setShowCallbackDialog(true)} disabled={loading}>
              📞 Schedule Callback
            </Button>
            {lead && (
              <Button variant="secondary" onClick={handleSendToQualifier} disabled={loading}>
                Send to Qualifier
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </div>

        <Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Callback</DialogTitle>
              <DialogDescription className="sr-only">
                Pick a date and time for a follow-up call with this lead.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={callbackDateTime}
                onChange={(e) => setCallbackDateTime(e.target.value)}
                className={inputBorderClass}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCallbackDialog(false)}>Cancel</Button>
              <Button onClick={handleScheduleCallback} disabled={!callbackDateTime || !currentUserId}>
                Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

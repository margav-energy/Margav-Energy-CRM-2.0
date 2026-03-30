/**
 * Agent Lead Sheet - comprehensive qualification form for agents.
 * Adapted for Margav CRM schema. Extended data stored in notes.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { createLead, updateLead, updateLeadStatus, createTask, getMe } from '../lib/api';

const DETAILED_SECTION = '--- DETAILED LEAD INFORMATION ---';

function parseYesNo(val: string): string {
  const v = val.trim().toLowerCase();
  if (v === 'yes') return 'true';
  if (v === 'no') return 'false';
  return '';
}

function parseNotesData(notes: string): Record<string, string> {
  const data: Record<string, string> = {};
  if (!notes) return data;

  const lines = notes.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
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
  add('Preferred Contact Time', form.preferred_contact_time);
  add('Property Ownership', form.property_ownership);
  add('Lives with Partner', form.lives_with_partner === 'true' ? 'Yes' : form.lives_with_partner === 'false' ? 'No' : '');
  add('Age Range 18-74', form.age_range_18_74 === 'true' ? 'Yes' : form.age_range_18_74 === 'false' ? 'No' : '');
  add('Moving Within 5 Years', form.moving_within_5_years === 'true' ? 'Yes' : form.moving_within_5_years === 'false' ? 'No' : '');
  add('Property Type', form.property_type);
  add('Number of Bedrooms', form.number_of_bedrooms);
  add('Roof Type', form.roof_type);
  add('Roof Material', form.roof_material);
  add('Loft Conversions', form.loft_conversions === 'true' ? 'Yes' : form.loft_conversions === 'false' ? 'No' : '');
  add('Velux Windows', form.velux_windows === 'true' ? 'Yes' : form.velux_windows === 'false' ? 'No' : '');
  add('Dormers', form.dormers === 'true' ? 'Yes' : form.dormers === 'false' ? 'No' : '');
  add('Dormas Shading Windows', form.dormas_shading_windows === 'true' ? 'Yes' : form.dormas_shading_windows === 'false' ? 'No' : '');
  add('Spray Foam Roof', form.spray_foam_roof === 'true' ? 'Yes' : form.spray_foam_roof === 'false' ? 'No' : '');
  add('Building Work on Roof', form.building_work_roof === 'true' ? 'Yes' : form.building_work_roof === 'false' ? 'No' : '');
  if (form.monthly_electricity_spend) parts.push(`Monthly Electricity Spend: £${form.monthly_electricity_spend}`);
  add('Has EV Charger', form.has_ev_charger === 'true' ? 'Yes' : form.has_ev_charger === 'false' ? 'No' : '');
  add('Day/Night Rate', form.day_night_rate);
  add('Current Energy Supplier', form.current_energy_supplier);
  add('Electric Heating/Appliances', form.electric_heating_appliances);
  add('Energy Details', form.energy_details);
  add('Employment Status', form.employment_status);
  add('Debt Management/Bankruptcy', form.debt_management_bankruptcy === 'true' ? 'Yes' : form.debt_management_bankruptcy === 'false' ? 'No' : '');
  add('Government Grants Aware', form.government_grants_aware === 'true' ? 'Yes' : form.government_grants_aware === 'false' ? 'No' : '');
  add('Timeframe', form.timeframe);
  add('Timeframe Details', form.timeframe_details);
  add('Has Previous Quotes', form.has_previous_quotes === 'true' ? 'Yes' : form.has_previous_quotes === 'false' ? 'No' : '');
  if (form.previous_quotes_details) parts.push(`Previous Quotes Details: ${form.previous_quotes_details}`);
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
  dormas_shading_windows: '',
  spray_foam_roof: '',
  building_work_roof: '',
  monthly_electricity_spend: '',
  has_ev_charger: '',
  day_night_rate: '',
  current_energy_supplier: '',
  electric_heating_appliances: '',
  energy_details: '',
  employment_status: '',
  debt_management_bankruptcy: '',
  government_grants_aware: '',
  timeframe: '',
  timeframe_details: '',
  has_previous_quotes: '',
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
      setForm({
        ...defaultForm,
        full_name: name,
        phone: lead.phone ?? '',
        email: lead.email ?? '',
        address: lead.addressLine1 ?? parsed.address ?? parsed.Address ?? '',
        city: lead.city ?? parsed.city ?? parsed.City ?? '',
        postcode: lead.postcode ?? parsed.postcode ?? parsed.Postcode ?? parsed['Postal code'] ?? '',
        preferred_contact_time: parsed['Preferred Contact Time'] ?? parsed['Preferred contact time'] ?? '',
        property_type: parsed['Property Type'] ?? parsed['Property type'] ?? '',
        number_of_bedrooms: parsed['Number of Bedrooms'] ?? parsed['Bedrooms'] ?? '',
        roof_type: parsed['Roof Type'] ?? parsed['Roof type'] ?? '',
        roof_material: parsed['Roof Material'] ?? parsed['Roof material'] ?? '',
        monthly_electricity_spend: lead.monthlyEnergyBill ? String(lead.monthlyEnergyBill) : (parsed['Monthly Electricity Spend'] ?? '').replace(/[£,]/g, '').trim(),
        property_ownership: lead.homeowner === true ? 'yes' : lead.homeowner === false ? 'no' : (parsed['Property Ownership'] ?? parsed['Property ownership'] ?? ''),
        lives_with_partner: parseYesNo(parsed['Lives with Partner'] ?? parsed['Lives with partner'] ?? ''),
        age_range_18_74: parseYesNo(parsed['Age Range 18-74'] ?? parsed['Age range 18-74'] ?? ''),
        moving_within_5_years: parseYesNo(parsed['Moving Within 5 Years'] ?? parsed['Moving within 5 years'] ?? ''),
        loft_conversions: parseYesNo(parsed['Loft Conversions'] ?? ''),
        velux_windows: parseYesNo(parsed['Velux Windows'] ?? ''),
        dormers: parseYesNo(parsed['Dormers'] ?? ''),
        dormas_shading_windows: parseYesNo(parsed['Dormas Shading Windows'] ?? ''),
        spray_foam_roof: parseYesNo(parsed['Spray Foam Roof'] ?? ''),
        building_work_roof: parseYesNo(parsed['Building Work on Roof'] ?? ''),
        has_ev_charger: parseYesNo(parsed['Has EV Charger'] ?? ''),
        debt_management_bankruptcy: parseYesNo(parsed['Debt Management/Bankruptcy'] ?? ''),
        government_grants_aware: parseYesNo(parsed['Government Grants Aware'] ?? ''),
        has_previous_quotes: parseYesNo(parsed['Has Previous Quotes'] ?? ''),
        current_energy_supplier: parsed['Current Energy Supplier'] ?? parsed['Energy supplier'] ?? '',
        electric_heating_appliances: parsed['Electric Heating/Appliances'] ?? '',
        energy_details: parsed['Energy Details'] ?? '',
        timeframe: parsed['Timeframe'] ?? '',
        timeframe_details: parsed['Timeframe Details'] ?? '',
        previous_quotes_details: parsed['Previous Quotes Details'] ?? '',
        day_night_rate: parsed['Day/Night Rate'] ?? '',
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
    if (!form.phone?.trim()) e.phone = 'Phone is required';
    else if (!/^[+]?[0-9\s\-()]{10,}$/.test(form.phone.trim())) e.phone = 'Phone must be valid';
    if (!form.postcode?.trim()) e.postcode = 'Postcode is required';
    if (form.email?.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={errors.email ? 'border-destructive' : inputBorderClass} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => update('address', e.target.value)} className={inputBorderClass} />
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
              <Label htmlFor="preferred_contact_time">Preferred Contact Time</Label>
              <Select value={form.preferred_contact_time} onValueChange={(v) => update('preferred_contact_time', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (9AM - 12PM)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12PM - 5PM)</SelectItem>
                  <SelectItem value="evening">Evening (5PM - 8PM)</SelectItem>
                  <SelectItem value="anytime">Anytime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Property Information" icon="🏠">
            <div>
              <Label>Property Ownership</Label>
              <Select value={form.property_ownership} onValueChange={(v) => update('property_ownership', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lives with Partner</Label>
              <Select value={form.lives_with_partner} onValueChange={(v) => update('lives_with_partner', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Age 18-74</Label>
              <Select value={form.age_range_18_74} onValueChange={(v) => update('age_range_18_74', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Moving Within 5 Years</Label>
              <Select value={form.moving_within_5_years} onValueChange={(v) => update('moving_within_5_years', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
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
            {['loft_conversions', 'velux_windows', 'dormers', 'dormas_shading_windows', 'spray_foam_roof', 'building_work_roof'].map((key) => (
              <div key={key}>
                <Label>{key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</Label>
                <Select value={form[key]} onValueChange={(v) => update(key, v)}>
                  <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </FormSection>

          <FormSection title="Energy Usage" icon="⚡">
            <div>
              <Label>Monthly Electricity Spend (£)</Label>
              <Input type="number" value={form.monthly_electricity_spend} onChange={(e) => update('monthly_electricity_spend', e.target.value)} placeholder="e.g. 60" className={inputBorderClass} />
            </div>
            <div>
              <Label>EV Charger</Label>
              <Select value={form.has_ev_charger} onValueChange={(v) => update('has_ev_charger', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day/Night Rate</Label>
              <Select value={form.day_night_rate} onValueChange={(v) => update('day_night_rate', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="unsure">Unsure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Current Energy Supplier</Label>
              <Select value={form.current_energy_supplier} onValueChange={(v) => update('current_energy_supplier', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="british_gas">British Gas</SelectItem>
                  <SelectItem value="octopus_energy">Octopus Energy</SelectItem>
                  <SelectItem value="ovo_energy">OVO Energy</SelectItem>
                  <SelectItem value="edf_energy">EDF Energy</SelectItem>
                  <SelectItem value="eon">E.ON</SelectItem>
                  <SelectItem value="scottish_power">Scottish Power</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <Label>Employment Status</Label>
              <Select value={form.employment_status} onValueChange={(v) => update('employment_status', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                  <SelectItem value="self-employed">Self-Employed</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Debt Management/Bankruptcy</Label>
              <Select value={form.debt_management_bankruptcy} onValueChange={(v) => update('debt_management_bankruptcy', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Government Grants Aware</Label>
              <Select value={form.government_grants_aware} onValueChange={(v) => update('government_grants_aware', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
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
            <div>
              <Label>Previous Quotes</Label>
              <Select value={form.has_previous_quotes} onValueChange={(v) => update('has_previous_quotes', v)}>
                <SelectTrigger className={inputBorderClass}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.has_previous_quotes === 'true' && (
              <div className="md:col-span-2">
                <Label>Previous Quotes Details</Label>
                <Textarea value={form.previous_quotes_details} onChange={(e) => update('previous_quotes_details', e.target.value)} rows={2} className={inputBorderClass} />
              </div>
            )}
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

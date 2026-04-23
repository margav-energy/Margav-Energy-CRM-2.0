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
import { BoilerLeadSheetSections } from './BoilerLeadSheetSections';

const DETAILED_SECTION = '--- DETAILED LEAD INFORMATION ---';
const BOILER_SECTION = '--- BOILER LEAD INFORMATION ---';

function extractPreamble(notes: string): string {
  if (!notes) return '';
  let cut = notes.length;
  for (const marker of [DETAILED_SECTION, BOILER_SECTION]) {
    const i = notes.indexOf(marker);
    if (i >= 0) cut = Math.min(cut, i);
  }
  return notes.slice(0, cut).trim();
}

function parseSectionContent(notes: string, sectionMarker: string): Record<string, string> {
  const idx = notes.indexOf(sectionMarker);
  if (idx < 0) return {};
  let rest = notes.slice(idx + sectionMarker.length).trim();
  const nextSolar = rest.indexOf(DETAILED_SECTION);
  const nextBoiler = rest.indexOf(BOILER_SECTION);
  let end = rest.length;
  if (nextSolar >= 0) end = Math.min(end, nextSolar);
  if (nextBoiler >= 0) end = Math.min(end, nextBoiler);
  rest = rest.slice(0, end);
  const data: Record<string, string> = {};
  for (const line of rest.split('\n')) {
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key) data[key] = value;
    }
  }
  return data;
}

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

function buildBoilerNotes(form: Record<string, string>): string {
  const parts: string[] = [];
  const add = (label: string, val: string) => {
    if (val) parts.push(`${label}: ${val}`);
  };

  const gasDual: string[] = [];
  if (form.boiler_energy_gas === 'true') gasDual.push('Gas');
  if (form.boiler_energy_dual === 'true') gasDual.push('Dual');
  add('Boiler Energy Spend', gasDual.join(' & '));

  const ageLabels: Record<string, string> = {
    '7_10': '7-10 years',
    over_10: 'Over 10 years',
    '15_plus': '15+ years',
    unsure: 'Unsure',
  };
  add('Boiler Age', form.boiler_age ? ageLabels[form.boiler_age] || form.boiler_age : '');

  const typeLabels: Record<string, string> = {
    combi: 'Combi',
    system: 'System',
    back: 'Back boiler',
    unsure: 'Unsure',
  };
  add('Boiler Type', form.boiler_type ? typeLabels[form.boiler_type] || form.boiler_type : '');

  const fuelLabels: Record<string, string> = {
    oil: 'Oil',
    lpg: 'LPG',
    gas: 'Gas',
    electric: 'Electric',
  };
  add('Boiler Fuel', form.boiler_fuel ? fuelLabels[form.boiler_fuel] || form.boiler_fuel : '');

  const locs: string[] = [];
  if (form.boiler_loc_kitchen === 'true') locs.push('Kitchen');
  if (form.boiler_loc_first_floor === 'true') locs.push('First floor');
  if (form.boiler_loc_loft === 'true') locs.push('Loft');
  if (form.boiler_loc_garage === 'true') locs.push('Garage');
  if (form.boiler_loc_other?.trim()) locs.push(`Other (${form.boiler_loc_other.trim()})`);
  add('Boiler Location', locs.join(', '));

  add('Boiler Working Properly', formatYesNo(form.boiler_working));
  add('Boiler Last Serviced', form.boiler_last_serviced?.trim() || '');

  const coverLabels: Record<string, string> = { yes: 'Yes', no: 'No', unknown: 'Unknown' };
  add('Boiler Cover', form.boiler_cover ? coverLabels[form.boiler_cover] || form.boiler_cover : '');
  add('Boiler Cover Monthly Cost', form.boiler_cover_monthly_cost?.trim() || '');
  add('Boiler Cover Supplier', form.boiler_cover_supplier?.trim() || '');
  add('Boiler Breakdowns (12 months)', form.boiler_breakdowns_12m?.trim() || '');

  const issues: string[] = [];
  if (form.boiler_issue_noisy === 'true') issues.push('Noisy');
  if (form.boiler_issue_leaking === 'true') issues.push('Leaking');
  if (form.boiler_issue_pressure === 'true') issues.push('Pressure issues');
  if (form.boiler_issue_hot_water === 'true') issues.push('Hot water runs out');
  if (form.boiler_issue_not_all_rooms === 'true') issues.push('Not heating all rooms');
  add('Boiler Issues', issues.join(', '));

  const propLabels: Record<string, string> = {
    detached: 'Detached',
    semi: 'Semi-detached',
    terraced: 'Terraced',
    flat_bungalow: 'Flat/Bungalow',
  };
  add(
    'Boiler Property Type',
    form.boiler_property_type ? propLabels[form.boiler_property_type] || form.boiler_property_type : ''
  );
  add('Boiler Bathrooms', form.boiler_bathrooms?.trim() || '');
  add('Boiler Open to Free Survey', formatYesNo(form.boiler_open_survey));
  add('Boiler Survey Booked', formatYesNo(form.boiler_survey_booked));
  add('Boiler Agent Name', form.boiler_agent_name?.trim() || '');
  add('Boiler Agent Date', form.boiler_agent_date?.trim() || '');
  add('Boiler Electric (notes)', form.boiler_electric?.trim() || '');

  return parts.join('\n');
}

/** Map parsed boiler section lines back into form keys */
function boilerParsedToForm(b: Record<string, string>): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};

  const spend = (b['Boiler Energy Spend'] || '').toLowerCase();
  if (spend.includes('gas')) out.boiler_energy_gas = 'true';
  if (spend.includes('dual')) out.boiler_energy_dual = 'true';

  const ageRaw = (b['Boiler Age'] || '').trim().toLowerCase();
  const ageRevLc: Record<string, string> = {
    '7-10 years': '7_10',
    'over 10 years': 'over_10',
    '15+ years': '15_plus',
    unsure: 'unsure',
  };
  out.boiler_age = ageRevLc[ageRaw] || '';

  const typeRaw = (b['Boiler Type'] || '').trim().toLowerCase();
  const typeRevLc: Record<string, string> = {
    combi: 'combi',
    system: 'system',
    'back boiler': 'back',
    unsure: 'unsure',
  };
  out.boiler_type = typeRevLc[typeRaw] || '';

  const fuelRaw = (b['Boiler Fuel'] || '').trim().toLowerCase();
  const fuelRevLc: Record<string, string> = {
    oil: 'oil',
    lpg: 'lpg',
    gas: 'gas',
    electric: 'electric',
  };
  out.boiler_fuel = fuelRevLc[fuelRaw] || '';

  const loc = (b['Boiler Location'] || '').toLowerCase();
  if (loc.includes('kitchen')) out.boiler_loc_kitchen = 'true';
  if (loc.includes('first floor')) out.boiler_loc_first_floor = 'true';
  if (loc.includes('loft')) out.boiler_loc_loft = 'true';
  if (loc.includes('garage')) out.boiler_loc_garage = 'true';
  const otherM = (b['Boiler Location'] || '').match(/other\s*\(([^)]+)\)/i);
  if (otherM) out.boiler_loc_other = otherM[1].trim();

  const working = (b['Boiler Working Properly'] || '').toLowerCase();
  if (working === 'yes') out.boiler_working = 'true';
  else if (working === 'no') out.boiler_working = 'false';

  out.boiler_last_serviced = b['Boiler Last Serviced'] || '';

  const cov = (b['Boiler Cover'] || '').toLowerCase();
  if (cov === 'yes') out.boiler_cover = 'yes';
  else if (cov === 'no') out.boiler_cover = 'no';
  else if (cov === 'unknown') out.boiler_cover = 'unknown';

  out.boiler_cover_monthly_cost = b['Boiler Cover Monthly Cost'] || '';
  out.boiler_cover_supplier = b['Boiler Cover Supplier'] || '';
  out.boiler_breakdowns_12m = b['Boiler Breakdowns (12 months)'] || '';

  const iss = (b['Boiler Issues'] || '').toLowerCase();
  if (iss.includes('noisy')) out.boiler_issue_noisy = 'true';
  if (iss.includes('leaking')) out.boiler_issue_leaking = 'true';
  if (iss.includes('pressure')) out.boiler_issue_pressure = 'true';
  if (iss.includes('hot water')) out.boiler_issue_hot_water = 'true';
  if (iss.includes('not heating all rooms')) out.boiler_issue_not_all_rooms = 'true';

  const propRaw = (b['Boiler Property Type'] || '').trim().toLowerCase();
  const propRevLc: Record<string, string> = {
    detached: 'detached',
    'semi-detached': 'semi',
    terraced: 'terraced',
    'flat/bungalow': 'flat_bungalow',
  };
  out.boiler_property_type = propRevLc[propRaw] || '';

  out.boiler_bathrooms = b['Boiler Bathrooms'] || '';

  const os = (b['Boiler Open to Free Survey'] || '').toLowerCase();
  if (os === 'yes') out.boiler_open_survey = 'true';
  else if (os === 'no') out.boiler_open_survey = 'false';

  const sb = (b['Boiler Survey Booked'] || '').toLowerCase();
  if (sb === 'yes') out.boiler_survey_booked = 'true';
  else if (sb === 'no') out.boiler_survey_booked = 'false';

  out.boiler_agent_name = b['Boiler Agent Name'] || '';
  out.boiler_agent_date = b['Boiler Agent Date'] || '';
  out.boiler_electric = b['Boiler Electric (notes)'] || '';

  return out;
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
  productLine?: string | null;
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
const PL_UNSET = '_unset';

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
  product_line: '',
  boiler_energy_gas: '',
  boiler_energy_dual: '',
  boiler_age: '',
  boiler_type: '',
  boiler_fuel: '',
  boiler_loc_kitchen: '',
  boiler_loc_first_floor: '',
  boiler_loc_loft: '',
  boiler_loc_garage: '',
  boiler_loc_other: '',
  boiler_working: '',
  boiler_last_serviced: '',
  boiler_cover: '',
  boiler_cover_monthly_cost: '',
  boiler_cover_supplier: '',
  boiler_breakdowns_12m: '',
  boiler_issue_noisy: '',
  boiler_issue_leaking: '',
  boiler_issue_pressure: '',
  boiler_issue_hot_water: '',
  boiler_issue_not_all_rooms: '',
  boiler_property_type: '',
  boiler_bathrooms: '',
  boiler_open_survey: '',
  boiler_survey_booked: '',
  boiler_agent_name: '',
  boiler_agent_date: '',
  boiler_electric: '',
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
  const [agentDisplayName, setAgentDisplayName] = useState('');

  useEffect(() => {
    getMe()
      .then((me) => {
        setCurrentUserId(me.id);
        setAgentDisplayName(me.fullName?.trim() || '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open && openCallbackOnMount && lead) {
      setShowCallbackDialog(true);
    }
  }, [open, openCallbackOnMount, lead]);

  useEffect(() => {
    if (!open) return;

    if (lead) {
      const notesRaw = lead.notes ?? '';
      const preamble = extractPreamble(notesRaw);
      const solarParsed = parseSectionContent(notesRaw, DETAILED_SECTION);
      const boilerParsed = parseSectionContent(notesRaw, BOILER_SECTION);
      const parsed = parseNotesData(notesRaw);
      const detailSource = Object.keys(solarParsed).length > 0 ? solarParsed : parsed;
      const boilerForm = boilerParsedToForm(boilerParsed);
      const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
      const { supplier: energySupplier, other: energyOther } = parseEnergySupplierFromNotes(parsed);
      const monthlyRaw =
        detailSource['Monthly Electricity Spend (over £60)'] ??
        detailSource['Monthly Electricity Spend'] ??
        parsed['Monthly Electricity Spend (over £60)'] ??
        parsed['Monthly Electricity Spend'] ??
        '';
      setForm({
        ...defaultForm,
        ...boilerForm,
        full_name: name,
        phone: lead.phone ?? '',
        email: lead.email ?? '',
        address: lead.addressLine1 ?? parsed.address ?? parsed.Address ?? '',
        city: lead.city ?? parsed.city ?? parsed.City ?? '',
        postcode: lead.postcode ?? parsed.postcode ?? parsed.Postcode ?? parsed['Postal code'] ?? '',
        preferred_contact_time: parsePreferredContactTime(
          detailSource['Preferred Contact Time'] ??
            detailSource['Preferred contact time'] ??
            parsed['Preferred Contact Time'] ??
            parsed['Preferred contact time'] ??
            ''
        ),
        property_type:
          detailSource['Property Type'] ??
          detailSource['Property type'] ??
          parsed['Property Type'] ??
          parsed['Property type'] ??
          '',
        number_of_bedrooms:
          detailSource['Number of Bedrooms'] ?? detailSource['Bedrooms'] ?? parsed['Number of Bedrooms'] ?? parsed['Bedrooms'] ?? '',
        roof_type:
          detailSource['Roof Type'] ?? detailSource['Roof type'] ?? parsed['Roof Type'] ?? parsed['Roof type'] ?? '',
        roof_material:
          detailSource['Roof Material'] ??
          detailSource['Roof material'] ??
          parsed['Roof Material'] ??
          parsed['Roof material'] ??
          '',
        monthly_electricity_spend: lead.monthlyEnergyBill
          ? String(lead.monthlyEnergyBill)
          : monthlyRaw.replace(/[£,]/g, '').trim(),
        property_ownership:
          lead.homeowner === true
            ? 'yes'
            : lead.homeowner === false
              ? 'no'
              : parseOwnership(
                  detailSource['Property Ownership'] ??
                    detailSource['Property ownership'] ??
                    parsed['Property Ownership'] ??
                    parsed['Property ownership'] ??
                    ''
                ),
        lives_with_partner: parseYesNo(
          detailSource['Lives with Partner'] ?? detailSource['Lives with partner'] ?? parsed['Lives with Partner'] ?? parsed['Lives with partner'] ?? ''
        ),
        age_range_18_74: parseYesNo(
          detailSource['Age Range 18-74'] ?? detailSource['Age range 18-74'] ?? parsed['Age Range 18-74'] ?? parsed['Age range 18-74'] ?? ''
        ),
        moving_within_5_years: parseYesNo(
          detailSource['Moving Within 5 Years'] ??
            detailSource['Moving within 5 years'] ??
            parsed['Moving Within 5 Years'] ??
            parsed['Moving within 5 years'] ??
            ''
        ),
        loft_conversions: parseYesNo(detailSource['Loft Conversions'] ?? parsed['Loft Conversions'] ?? ''),
        velux_windows: parseYesNo(detailSource['Velux Windows'] ?? parsed['Velux Windows'] ?? ''),
        dormers: parseYesNo(detailSource['Dormers'] ?? parsed['Dormers'] ?? ''),
        spray_foam_roof: parseTriState(detailSource['Spray Foam Roof'] ?? parsed['Spray Foam Roof'] ?? ''),
        building_work_roof: parseYesNo(detailSource['Building Work on Roof'] ?? parsed['Building Work on Roof'] ?? ''),
        has_ev_charger: parseYesNo(detailSource['Has EV Charger'] ?? parsed['Has EV Charger'] ?? ''),
        debt_management_bankruptcy: parseYesNo(
          detailSource['Debt Management/Bankruptcy'] ?? parsed['Debt Management/Bankruptcy'] ?? ''
        ),
        government_grants_aware: parseYesNo(
          detailSource['Government Grants Aware'] ?? parsed['Government Grants Aware'] ?? ''
        ),
        current_energy_supplier: energySupplier,
        energy_provider_other: energyOther,
        electric_heating_appliances:
          detailSource['Electric Heating/Appliances'] ?? parsed['Electric Heating/Appliances'] ?? '',
        energy_details: detailSource['Energy Details'] ?? parsed['Energy Details'] ?? '',
        timeframe: detailSource['Timeframe'] ?? parsed['Timeframe'] ?? '',
        timeframe_details: detailSource['Timeframe Details'] ?? parsed['Timeframe Details'] ?? '',
        previous_quotes_details:
          detailSource['Previous Quote'] ??
          detailSource['Previous Quotes Details'] ??
          parsed['Previous Quote'] ??
          parsed['Previous Quotes Details'] ??
          '',
        day_night_rate: (() => {
          const raw = detailSource['Day/Night Rate'] ?? parsed['Day/Night Rate'] ?? '';
          const d = raw.trim().toLowerCase();
          return d === 'unsure' ? '' : raw;
        })(),
        employment_status: detailSource['Employment Status'] ?? parsed['Employment Status'] ?? '',
        assessment_date_preference:
          detailSource['Assessment Date Preference'] ?? parsed['Assessment Date Preference'] ?? '',
        assessment_time_preference:
          detailSource['Assessment Time Preference'] ?? parsed['Assessment Time Preference'] ?? '',
        product_line: lead.productLine === 'SOLAR' || lead.productLine === 'HEATING' ? lead.productLine : '',
        notes: preamble,
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

  const validate = (options?: { requireProductLine?: boolean }): boolean => {
    const e: Record<string, string> = {};
    if (!form.full_name?.trim()) e.full_name = 'Full name is required';
    if (!form.address?.trim()) e.address = 'Address is required';
    if (!form.postcode?.trim()) e.postcode = 'Postcode is required';
    if (!form.phone?.trim()) e.phone = 'Phone is required';
    else if (!/^[+]?[0-9\s\-()]{10,}$/.test(form.phone.trim())) e.phone = 'Phone must be valid';
    if (!form.email?.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.preferred_contact_time?.trim()) e.preferred_contact_time = 'Preferred contact time is required';
    if (options?.requireProductLine && form.product_line !== 'SOLAR' && form.product_line !== 'HEATING') {
      e.product_line = 'Select solar or heating before sending to the qualifier';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildNotes = () => {
    const notesOnly = (form.notes || '').trim();
    const chunks: string[] = [];
    if (notesOnly) chunks.push(notesOnly);
    if (form.product_line === 'HEATING') {
      const boiler = buildBoilerNotes(form);
      if (boiler) chunks.push('', BOILER_SECTION, boiler);
    } else {
      const detailed = buildDetailedNotes(form);
      if (detailed) chunks.push('', DETAILED_SECTION, detailed);
    }
    return chunks.join('\n').trim();
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

      const productLinePatch =
        form.product_line === 'SOLAR' || form.product_line === 'HEATING'
          ? { productLine: form.product_line as 'SOLAR' | 'HEATING' }
          : {};
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
          ...productLinePatch,
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
          ...productLinePatch,
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
    if (!validate({ requireProductLine: true })) return;
    setLoading(true);
    try {
      const productLine = form.product_line as 'SOLAR' | 'HEATING';
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
          productLine,
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
          productLine,
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
            <div className="md:col-span-2">
              <Label htmlFor="product_line">Product line</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Heating shows the boiler lead sheet fields. Required when you use &quot;Send to Qualifier&quot;.
              </p>
              <Select
                value={form.product_line || PL_UNSET}
                onValueChange={(v) => {
                  const next = v === PL_UNSET ? '' : v;
                  setForm((p) => {
                    if (next === 'HEATING' && !p.boiler_agent_name?.trim() && agentDisplayName) {
                      return { ...p, product_line: next, boiler_agent_name: agentDisplayName };
                    }
                    return { ...p, product_line: next };
                  });
                  if (errors.product_line) setErrors((e) => ({ ...e, product_line: '' }));
                }}
              >
                <SelectTrigger className={`${errors.product_line ? 'border-destructive ' : ''}${inputBorderClass}`}>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PL_UNSET}>Not set (save draft only)</SelectItem>
                  <SelectItem value="SOLAR">Solar</SelectItem>
                  <SelectItem value="HEATING">Heating (boilers)</SelectItem>
                </SelectContent>
              </Select>
              {errors.product_line && <p className="text-sm text-destructive">{errors.product_line}</p>}
            </div>
          </FormSection>

          {form.product_line === 'HEATING' ? (
            <BoilerLeadSheetSections form={form} update={update} inputBorderClass={inputBorderClass} />
          ) : null}

          {form.product_line !== 'HEATING' ? (
          <>
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
          </>
          ) : null}

          <FormSection title="Financial & Employment" icon="💰">
            <div>
              <Label>{form.product_line === 'HEATING' ? 'Current monthly electricity spend (if relevant)?' : 'Current monthly electricity spend (over £60)?'}</Label>
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
              <Label>
                {form.product_line === 'HEATING'
                  ? 'Aware of boiler / heating support or incentives?'
                  : 'Aware there are no government grants for solar?'}
              </Label>
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
            <Button variant="secondary" onClick={handleSendToQualifier} disabled={loading}>
              Send to Qualifier
            </Button>
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

/**
 * Qualifier Lead Sheet - comprehensive qualification form for qualifiers.
 * Agent data is shown read-only; qualifier adds their answers.
 */
import React, { useState, useEffect, useRef } from 'react';
import { qualifyLead, getFieldSalesReps } from '../lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '../lib/auth-context';

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

function parseAgentNotes(notes: string): Record<string, unknown> {
  const agentData: Record<string, unknown> = {};
  if (!notes) return agentData;

  const lines = notes.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.includes(':')) {
      const [key, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim();
      const lowerKey = key.toLowerCase();

      if (lowerKey.includes('property type')) agentData.property_type = value;
      if (lowerKey.includes('roof type')) agentData.roof_type = value;
      if (lowerKey.includes('roof material')) agentData.roof_material = value;
      if (lowerKey.includes('property ownership')) agentData.property_ownership = value;
      if (lowerKey.includes('lives with partner')) agentData.lives_with_partner = value.toLowerCase().includes('yes');
      if (lowerKey.includes('age range 18-74')) agentData.age_range_18_74 = value.toLowerCase().includes('yes');
      if (lowerKey.includes('moving within 5 years')) agentData.moving_within_5_years = value.toLowerCase().includes('yes');
      if (lowerKey.includes('monthly electricity spend')) agentData.monthly_electricity_spend = value.replace(/[£,]/g, '');
      if (lowerKey.includes('has ev charger')) agentData.has_ev_charger = value.toLowerCase().includes('yes');
      if (lowerKey.includes('day/night rate')) agentData.day_night_rate = value;
      if (lowerKey.includes('employment status')) agentData.employment_status = value;
      if (lowerKey.includes('debt management') || lowerKey.includes('bankruptcy')) agentData.debt_management_bankruptcy = value.toLowerCase().includes('yes');
      if (lowerKey.includes('government grants')) agentData.government_grants_aware = value.toLowerCase().includes('yes');
      if (lowerKey.includes('spray foam')) agentData.spray_foam_roof = value.toLowerCase().includes('yes');
      if (lowerKey.includes('building work')) agentData.building_work_roof = value.toLowerCase().includes('yes');
      if (lowerKey.includes('loft conversions')) agentData.loft_conversions = value.toLowerCase().includes('yes');
      if (lowerKey.includes('velux windows')) agentData.velux_windows = value.toLowerCase().includes('yes');
      if (lowerKey.includes('dormers')) agentData.dormers = value.toLowerCase().includes('yes');
      if (lowerKey.includes('dormas')) agentData.dormas_shading_windows = value.toLowerCase().includes('yes');
    }
  }
  return agentData;
}

function formatDateForInput(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function inferPropertyType(agentType?: string, qualifierType?: string): string {
  if (qualifierType) return qualifierType;
  const t = (agentType || '').toLowerCase();
  if (t.includes('detached')) return 'detached';
  if (t.includes('semi')) return 'semi-detached';
  if (t.includes('terraced') || t.includes('terrace')) return 'terraced';
  if (t.includes('bungalow')) return 'bungalow';
  if (t.includes('caravan')) return 'caravan';
  if (t.includes('commercial')) return 'commercial';
  return '';
}

function inferRoofType(agentType?: string, qualifierType?: string): string {
  if (qualifierType) return qualifierType;
  const t = (agentType || '').toLowerCase();
  if (t.includes('hip')) return 'hip';
  if (t.includes('gable')) return 'gable';
  if (t.includes('flat')) return 'flat';
  return '';
}

// Map backend LeadStatus back to qualifier form status
function toQualifierStatus(backendStatus?: string): string {
  const map: Record<string, string> = {
    QUALIFYING: 'sent_to_kelly',
    APPOINTMENT_SET: 'appointment_set',
    QUALIFIER_CALLBACK: 'qualifier_callback',
    NO_CONTACT: 'no_contact',
    NOT_INTERESTED: 'blow_out',
    CONTACTED: 'no_contact',
    INTERESTED: 'pass_back_to_agent',
  };
  return map[backendStatus || ''] || 'sent_to_kelly';
}

export interface QualifierLead {
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
  qualifierNotes?: string | null;
  qualifierCallbackDate?: string | null;
  assignedAgent?: { fullName?: string } | null;
  assignedFieldSalesRep?: { fullName?: string } | null;
  desktopRoofCheckCompleted?: boolean | null;
  propertyTypeQualifier?: string | null;
  roofTypeQualifier?: string | null;
  speakingToHomeowner?: boolean | null;
  bothHomeownersPresent?: boolean | null;
  propertyListed?: boolean | null;
  conservationArea?: boolean | null;
  buildingWorkOngoing?: boolean | null;
  roofShadedObstructed?: boolean | null;
  sprayFoamRoof?: boolean | null;
  customerAwareNoGrants?: boolean | null;
  currentElectricBillType?: string | null;
  customerAge?: number | null;
  aged18To70?: boolean | null;
  currentlyEmployed?: boolean | null;
  hasGoodCredit?: boolean | null;
  earnsOver12k?: boolean | null;
  planningToMove5Years?: boolean | null;
  available3WorkingDays?: boolean | null;
  appointments?: Array<{ scheduledAt: string; fieldSalesRep?: { fullName?: string } }>;
  updatedAt?: string;
}

export interface QualifierLeadModalProps {
  lead: QualifierLead;
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedLead?: QualifierLead) => void;
}

export function QualifierLeadModal({ lead, open, onClose, onSuccess }: QualifierLeadModalProps) {
  const { user } = useAuth();
  const [fieldSalesReps, setFieldSalesReps] = useState<Array<{ id: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(false);

  const agentData = React.useMemo(() => parseAgentNotes(lead.notes || ''), [lead.notes]);

  const [formData, setFormData] = useState({
    status: toQualifierStatus(lead.status),
    notes: lead.notes || '',
    qualifier_notes: lead.qualifierNotes || '',
    appointment_date: (lead.appointments?.[0] as { scheduledAt?: string } | undefined)?.scheduledAt ? formatDateForInput(lead.appointments[0].scheduledAt) : '',
    qualifier_callback_date: lead.qualifierCallbackDate ? formatDateForInput(lead.qualifierCallbackDate) : '',
    field_sales_rep: (lead.assignedFieldSalesRep as { id?: string } | null)?.id || null,
    full_name: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
    phone: lead.phone || '',
    email: lead.email || '',
    address1: lead.addressLine1 || '',
    postal_code: lead.postcode || '',
    desktop_roof_check_completed: lead.desktopRoofCheckCompleted ?? undefined as boolean | undefined,
    property_type_qualifier: lead.propertyTypeQualifier || inferPropertyType(agentData.property_type as string),
    roof_type_qualifier: lead.roofTypeQualifier || inferRoofType(agentData.roof_type as string),
    speaking_to_homeowner: lead.speakingToHomeowner ?? undefined as boolean | undefined,
    both_homeowners_present: lead.bothHomeownersPresent ?? undefined as boolean | undefined,
    property_listed: lead.propertyListed ?? undefined as boolean | undefined,
    conservation_area: lead.conservationArea ?? undefined as boolean | undefined,
    building_work_ongoing: lead.buildingWorkOngoing ?? undefined as boolean | undefined,
    roof_shaded_obstructed: lead.roofShadedObstructed ?? undefined as boolean | undefined,
    spray_foam_roof: lead.sprayFoamRoof ?? (agentData.spray_foam_roof as boolean | undefined),
    customer_aware_no_grants: lead.customerAwareNoGrants ?? undefined as boolean | undefined,
    current_electric_bill_type: lead.currentElectricBillType || (agentData.day_night_rate ? 'electric' : ''),
    customer_age: lead.customerAge ?? undefined as number | undefined,
    aged_18_70: lead.aged18To70 ?? (agentData.age_range_18_74 as boolean | undefined),
    currently_employed: lead.currentlyEmployed ?? (agentData.employment_status ? (agentData.employment_status as string) !== 'unemployed' : undefined as boolean | undefined),
    has_good_credit: lead.hasGoodCredit ?? (agentData.debt_management_bankruptcy === false ? true : undefined as boolean | undefined),
    earns_over_12k: lead.earnsOver12k ?? undefined as boolean | undefined,
    planning_to_move_5_years: lead.planningToMove5Years ?? (agentData.moving_within_5_years as boolean | undefined),
    available_3_working_days: lead.available3WorkingDays ?? undefined as boolean | undefined,
  });

  const prevLeadIdRef = useRef(lead.id);
  const prevUpdatedAtRef = useRef(lead.updatedAt);
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (open) {
      getFieldSalesReps()
        .then((reps) => setFieldSalesReps(reps))
        .catch(() => setFieldSalesReps([]));
    }
  }, [open]);

  useEffect(() => {
    if (!open || !lead) return;
    if (isInitialRef.current) {
      isInitialRef.current = false;
      prevLeadIdRef.current = lead.id;
      prevUpdatedAtRef.current = lead.updatedAt;
      return;
    }
    if (lead.id !== prevLeadIdRef.current || lead.updatedAt !== prevUpdatedAtRef.current) {
      const appt = lead.appointments?.[0];
      setFormData({
        status: toQualifierStatus(lead.status),
        notes: lead.notes || '',
        qualifier_notes: lead.qualifierNotes || '',
        appointment_date: appt?.scheduledAt ? formatDateForInput(appt.scheduledAt) : '',
        qualifier_callback_date: lead.qualifierCallbackDate ? formatDateForInput(lead.qualifierCallbackDate) : '',
        field_sales_rep: lead.assignedFieldSalesRep ? (lead.assignedFieldSalesRep as { id?: string }).id || null : null,
        full_name: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
        phone: lead.phone || '',
        email: lead.email || '',
        address1: lead.addressLine1 || '',
        postal_code: lead.postcode || '',
        desktop_roof_check_completed: lead.desktopRoofCheckCompleted ?? undefined,
        property_type_qualifier: lead.propertyTypeQualifier || inferPropertyType(agentData.property_type as string),
        roof_type_qualifier: lead.roofTypeQualifier || inferRoofType(agentData.roof_type as string),
        speaking_to_homeowner: lead.speakingToHomeowner ?? undefined,
        both_homeowners_present: lead.bothHomeownersPresent ?? undefined,
        property_listed: lead.propertyListed ?? undefined,
        conservation_area: lead.conservationArea ?? undefined,
        building_work_ongoing: lead.buildingWorkOngoing ?? undefined,
        roof_shaded_obstructed: lead.roofShadedObstructed ?? undefined,
        spray_foam_roof: lead.sprayFoamRoof ?? (agentData.spray_foam_roof as boolean | undefined),
        customer_aware_no_grants: lead.customerAwareNoGrants ?? undefined,
        current_electric_bill_type: lead.currentElectricBillType || (agentData.day_night_rate ? 'electric' : ''),
        customer_age: lead.customerAge ?? undefined,
        aged_18_70: lead.aged18To70 ?? (agentData.age_range_18_74 as boolean | undefined),
        currently_employed: lead.currentlyEmployed ?? (agentData.employment_status ? (agentData.employment_status as string) !== 'unemployed' : undefined),
        has_good_credit: lead.hasGoodCredit ?? (agentData.debt_management_bankruptcy === false ? true : undefined),
        earns_over_12k: lead.earnsOver12k ?? undefined,
        planning_to_move_5_years: lead.planningToMove5Years ?? (agentData.moving_within_5_years as boolean | undefined),
        available_3_working_days: lead.available3WorkingDays ?? undefined,
      });
      prevLeadIdRef.current = lead.id;
      prevUpdatedAtRef.current = lead.updatedAt;
    }
  }, [open, lead, agentData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'field_sales_rep' ? (value || null) : name === 'customer_age' ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  const handleBooleanChange = (name: string, value: boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      setLoading(true);
      const payload = {
        ...formData,
        appointment_date: formData.appointment_date ? (() => {
          try {
            const d = new Date(formData.appointment_date);
            return isNaN(d.getTime()) ? null : d.toISOString();
          } catch {
            return null;
          }
        })() : null,
        qualifier_callback_date: formData.qualifier_callback_date ? (() => {
          try {
            const d = new Date(formData.qualifier_callback_date);
            return isNaN(d.getTime()) ? null : d.toISOString();
          } catch {
            return null;
          }
        })() : null,
        field_sales_rep: formData.field_sales_rep || null,
      };

      const result = await qualifyLead(lead.id, payload);

      if (formData.status === 'appointment_set' && !result.calendar_synced) {
        toast.warning('Lead qualified successfully, but Google Calendar sync failed. The appointment may not appear in the calendar.', {
          autoClose: 8000,
          position: 'top-right',
        });
      } else {
        toast.success('Lead qualified successfully!');
      }

      onSuccess(result.lead as QualifierLead);
      onClose();
    } catch (err) {
      toast.error('Failed to qualify lead');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const leadName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
  const agentName = (lead.assignedAgent as { fullName?: string })?.fullName || 'Unknown';

  return (
    <div className="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Qualifier Lead Sheet - {leadName}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Qualifier: {user?.fullName || 'You'} | Agent: {agentName}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>

          {/* Agent Data Summary */}
          {agentName && agentName !== 'Unknown' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">📋</span>
                  Agent Information (from {agentName})
                </h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Read-Only</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {agentData.property_type && (
                  <div>
                    <span className="font-medium text-gray-700">Property Type:</span>{' '}
                    <span className="text-gray-600">{String(agentData.property_type)}</span>
                  </div>
                )}
                {agentData.roof_type && (
                  <div>
                    <span className="font-medium text-gray-700">Roof Type:</span>{' '}
                    <span className="text-gray-600">{String(agentData.roof_type)}</span>
                  </div>
                )}
                {agentData.property_ownership && (
                  <div>
                    <span className="font-medium text-gray-700">Property Ownership:</span>{' '}
                    <span className="text-gray-600">{String(agentData.property_ownership)}</span>
                  </div>
                )}
                {agentData.monthly_electricity_spend && (
                  <div>
                    <span className="font-medium text-gray-700">Monthly Electricity Spend:</span>{' '}
                    <span className="text-gray-600">£{String(agentData.monthly_electricity_spend)}</span>
                  </div>
                )}
                {agentData.employment_status && (
                  <div>
                    <span className="font-medium text-gray-700">Employment Status:</span>{' '}
                    <span className="text-gray-600">{String(agentData.employment_status)}</span>
                  </div>
                )}
                {agentData.has_ev_charger !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Has EV Charger:</span>{' '}
                    <span className="text-gray-600">{agentData.has_ev_charger ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {agentData.day_night_rate && (
                  <div>
                    <span className="font-medium text-gray-700">Day/Night Rate:</span>{' '}
                    <span className="text-gray-600">{String(agentData.day_night_rate)}</span>
                  </div>
                )}
                {agentData.age_range_18_74 !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Age Range 18-74:</span>{' '}
                    <span className="text-gray-600">{agentData.age_range_18_74 ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {agentData.moving_within_5_years !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Moving Within 5 Years:</span>{' '}
                    <span className="text-gray-600">{agentData.moving_within_5_years ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {agentData.spray_foam_roof !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Spray Foam Roof:</span>{' '}
                    <span className="text-gray-600">{agentData.spray_foam_roof ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {agentData.building_work_roof !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Building Work on Roof:</span>{' '}
                    <span className="text-gray-600">{agentData.building_work_roof ? 'Yes' : 'No'}</span>
                  </div>
                )}
              </div>
              {lead.notes && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                      View Full Agent Notes
                    </summary>
                    <div className="mt-2 p-3 bg-white rounded border max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-xs text-gray-600">{lead.notes}</pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Contact Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" id="address1" name="address1" value={formData.address1} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input type="text" id="postal_code" name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>

            {/* Desktop Roof Check */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Desktop Roof Check</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Desktop Roof Check Completed?</label>
                <p className="text-xs text-gray-600 mb-3">Have you reviewed the roof of the property to ensure that the roof is suitable for a minimum of EIGHT panels.</p>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input type="radio" name="desktop_roof_check_completed" checked={formData.desktop_roof_check_completed === true} onChange={() => handleBooleanChange('desktop_roof_check_completed', true)} className="mr-2" />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="desktop_roof_check_completed" checked={formData.desktop_roof_check_completed === false} onChange={() => handleBooleanChange('desktop_roof_check_completed', false)} className="mr-2" />
                    No
                  </label>
                </div>
              </div>
            </div>

            {/* Property Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Property Information</h4>
                {agentData.property_type && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Pre-filled from agent data</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="property_type_qualifier" className="block text-sm font-medium text-gray-700 mb-1">
                    Property Type? {agentData.property_type && <span className="ml-2 text-xs text-green-600">(Agent: {String(agentData.property_type)})</span>}
                  </label>
                  <select id="property_type_qualifier" name="property_type_qualifier" value={formData.property_type_qualifier || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select...</option>
                    <option value="detached">Detached</option>
                    <option value="semi-detached">Semi-Detached</option>
                    <option value="terraced">Terrace</option>
                    <option value="bungalow">Bungalow</option>
                    <option value="caravan">Caravan</option>
                    <option value="commercial">Commercial</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="roof_type_qualifier" className="block text-sm font-medium text-gray-700 mb-1">
                    Roof Type? {agentData.roof_type && <span className="ml-2 text-xs text-green-600">(Agent: {String(agentData.roof_type)})</span>}
                  </label>
                  <select id="roof_type_qualifier" name="roof_type_qualifier" value={formData.roof_type_qualifier || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select...</option>
                    <option value="hip">Hip</option>
                    <option value="gable">Gable</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Homeowner Verification */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Homeowner Verification</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Are you speaking to the homeowner?</label>
                  <p className="text-xs text-red-600 mb-3">You cannot proceed unless you are speaking to the property owner, or the person you are speaking to can confirm ALL owners of the property will be available on the day of appointment.</p>
                  <div className="flex gap-4">
                    <label className="flex items-center"><input type="radio" name="speaking_to_homeowner" checked={formData.speaking_to_homeowner === true} onChange={() => handleBooleanChange('speaking_to_homeowner', true)} className="mr-2" />Yes</label>
                    <label className="flex items-center"><input type="radio" name="speaking_to_homeowner" checked={formData.speaking_to_homeowner === false} onChange={() => handleBooleanChange('speaking_to_homeowner', false)} className="mr-2" />No</label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Will both home owners be present?</label>
                  <p className="text-xs text-gray-600 mb-3">This is important to ensure we meet our legal requirements under FCA and EPVS as both homeowners are required to review all figures we produce on the day.</p>
                  <div className="flex gap-4">
                    <label className="flex items-center"><input type="radio" name="both_homeowners_present" checked={formData.both_homeowners_present === true} onChange={() => handleBooleanChange('both_homeowners_present', true)} className="mr-2" />Yes</label>
                    <label className="flex items-center"><input type="radio" name="both_homeowners_present" checked={formData.both_homeowners_present === false} onChange={() => handleBooleanChange('both_homeowners_present', false)} className="mr-2" />No</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Restrictions */}
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Property Restrictions</h4>
              <div className="space-y-4">
                {[
                  { key: 'property_listed', label: 'Is the property listed?', hint: 'If YES you cannot proceed as it is unlikely the customer will get planning permission.' },
                  { key: 'conservation_area', label: 'Is the property in a conservation area?', hint: 'If YES please map check and ensure that there is room for at least x1 array with a minimum of 8 panels on a part of the roof NOT visible from a main road.' },
                  { key: 'building_work_ongoing', label: 'Do you have any building work ongoing or planning in next 6 months?', hint: 'If the roof is in a state of disrepair, we MAY not be able to offer an appointment.' },
                  { key: 'spray_foam_roof', label: 'Does the property have spray foam?', hint: 'We MAY not be able to install where spray foam is present.' },
                  { key: 'roof_shaded_obstructed', label: 'Is the roof shaded or obstructed?', hint: 'Ensure that the EIGHT panels are able to be placed in an area of the roof that is free from obstructions.' },
                ].map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                    <p className="text-xs text-gray-600 mb-3">{hint}</p>
                    <div className="flex gap-4">
                      <label className="flex items-center"><input type="radio" name={key} checked={formData[key as keyof typeof formData] === true} onChange={() => handleBooleanChange(key, true)} className="mr-2" />Yes</label>
                      <label className="flex items-center"><input type="radio" name={key} checked={formData[key as keyof typeof formData] === false} onChange={() => handleBooleanChange(key, false)} className="mr-2" />No</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Awareness */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Customer Awareness</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">The customer is aware there are NO grants for solar?</label>
                <p className="text-xs text-gray-600 mb-3">Ensure that the customer is aware there are NO schemes or grants available to cover the cost of solar.</p>
                <div className="flex gap-4">
                  <label className="flex items-center"><input type="radio" name="customer_aware_no_grants" checked={formData.customer_aware_no_grants === true} onChange={() => handleBooleanChange('customer_aware_no_grants', true)} className="mr-2" />Yes</label>
                  <label className="flex items-center"><input type="radio" name="customer_aware_no_grants" checked={formData.customer_aware_no_grants === false} onChange={() => handleBooleanChange('customer_aware_no_grants', false)} className="mr-2" />No</label>
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Financial Information</h4>
                {(agentData.monthly_electricity_spend || agentData.employment_status) && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Some data from agent</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="current_electric_bill_type" className="block text-sm font-medium text-gray-700 mb-1">
                    What is their current electric bill? {agentData.day_night_rate && <span className="ml-2 text-xs text-green-600">(Agent: {String(agentData.day_night_rate)})</span>}
                  </label>
                  {agentData.monthly_electricity_spend && <p className="text-xs text-green-600 mb-2">Agent reported: £{String(agentData.monthly_electricity_spend)}/month</p>}
                  <select id="current_electric_bill_type" name="current_electric_bill_type" value={formData.current_electric_bill_type || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select...</option>
                    <option value="electric">Electric</option>
                    <option value="gas">Gas</option>
                    <option value="dual">Dual</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="customer_age" className="block text-sm font-medium text-gray-700 mb-1">Age:</label>
                  <input type="number" id="customer_age" name="customer_age" value={formData.customer_age || ''} onChange={handleChange} min={18} max={70} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                {[
                  { key: 'aged_18_70', label: 'Aged between 18 & 70?', agentKey: 'age_range_18_74' },
                  { key: 'currently_employed', label: 'Is the customer currently employed?', agentKey: 'employment_status' },
                  { key: 'has_good_credit', label: 'Do they have good credit?' },
                  { key: 'earns_over_12k', label: 'Do you earn over £12K per year?' },
                  { key: 'planning_to_move_5_years', label: 'Are they planning to move within 5 years?', agentKey: 'moving_within_5_years' },
                  { key: 'available_3_working_days', label: 'Is the customer available for an appointment within the next 3 working days?' },
                ].map(({ key, label, agentKey }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {label}
                      {agentKey && agentData[agentKey] !== undefined && (
                        <span className="ml-2 text-xs text-green-600">(Agent: {typeof agentData[agentKey] === 'boolean' ? (agentData[agentKey] ? 'Yes' : 'No') : String(agentData[agentKey])})</span>
                      )}
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center"><input type="radio" name={key} checked={formData[key as keyof typeof formData] === true} onChange={() => handleBooleanChange(key, true)} className="mr-2" />Yes</label>
                      <label className="flex items-center"><input type="radio" name={key} checked={formData[key as keyof typeof formData] === false} onChange={() => handleBooleanChange(key, false)} className="mr-2" />No</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Qualification Status */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Qualification Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Qualification Status</label>
                  <select id="status" name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="sent_to_kelly">📋 Sent to Qualifier (Current)</option>
                    <option value="no_contact">📞 No Contact</option>
                    <option value="blow_out">💨 Blow Out</option>
                    <option value="appointment_set">📅 Appointment Set</option>
                    <option value="not_interested">❌ Not Interested</option>
                    <option value="pass_back_to_agent">↩️ Pass Back to Agent</option>
                    <option value="on_hold">⏸️ On Hold</option>
                    <option value="qualifier_callback">📞 Call Back</option>
                  </select>
                </div>
                {formData.status === 'appointment_set' && (
                  <>
                    <div>
                      <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700 mb-1">Appointment Date & Time</label>
                      <input type="datetime-local" id="appointment_date" name="appointment_date" value={formData.appointment_date || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label htmlFor="field_sales_rep" className="block text-sm font-medium text-gray-700 mb-1">Assign Field Sales Rep</label>
                      <select id="field_sales_rep" name="field_sales_rep" value={formData.field_sales_rep || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">Select sales rep...</option>
                        {fieldSalesReps.map((rep) => (
                          <option key={rep.id} value={rep.id}>{rep.fullName}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {formData.status === 'qualifier_callback' && (
                  <div>
                    <label htmlFor="qualifier_callback_date" className="block text-sm font-medium text-gray-700 mb-1">Callback Date & Time</label>
                    <input type="datetime-local" id="qualifier_callback_date" name="qualifier_callback_date" value={formData.qualifier_callback_date || ''} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <p className="text-xs text-gray-500 mt-1">You will receive a notification when it&apos;s time to call back.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Qualifier Notes */}
            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Qualifier&apos;s Notes</h4>
              <label htmlFor="qualifier_notes" className="block text-sm font-medium text-gray-700 mb-1">Your Qualification Notes</label>
              <p className="text-xs text-gray-600 mb-2">Add your specific notes about this qualification. These notes will be visible separately from general notes.</p>
              <textarea id="qualifier_notes" name="qualifier_notes" value={formData.qualifier_notes} onChange={handleChange} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Enter your qualification notes here..." />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t sticky bottom-0 bg-white pb-4">
              <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" disabled={loading}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <span className="flex items-center"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Processing...</span> : 'Save Qualification'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

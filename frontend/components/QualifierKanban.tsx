import { CalendarCheck, PhoneCall, PhoneOff, Wind, Trophy } from 'lucide-react';

/** Lead journey (left → right). Sold uses LeadStatus.SOLD. */
export const QUALIFIER_JOURNEY_STAGES = [
  { key: 'NO_CONTACT', label: 'No Contact', icon: PhoneOff },
  { key: 'QUALIFIER_CALLBACK', label: 'Callback', icon: PhoneCall },
  { key: 'APPOINTMENT_SET', label: 'Appointment Set', icon: CalendarCheck },
  { key: 'SOLD', label: 'Sold', icon: Trophy },
  { key: 'NOT_INTERESTED', label: 'Blowout', icon: Wind },
] as const;

export const QUALIFIER_JOURNEY_STAGE_KEYS = QUALIFIER_JOURNEY_STAGES.map((s) => s.key);

export interface QualifierLead {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  status: string;
  source?: string | null;
  notes?: string | null;
  assignedAgent?: { fullName?: string };
  assignedQualifier?: { fullName?: string };
  createdAt?: string;
}

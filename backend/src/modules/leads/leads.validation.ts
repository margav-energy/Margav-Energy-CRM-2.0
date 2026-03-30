import { z } from 'zod';

const leadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'DEPOSITION',
  'QUALIFYING',
  'QUALIFIED',
  'NOT_QUALIFIED',
  'APPOINTMENT_SET',
  'NO_CONTACT',
  'QUALIFIER_CALLBACK',
]);

export const leadIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(50),
  email: z.string().email('Invalid email'),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().optional(),
  assignedAgentId: z.string().cuid().optional(),
  status: leadStatusEnum.optional(), // When sending to qualifier, use QUALIFYING for atomic create
});

export const importLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(50),
  email: z.string().email('Invalid email'),
  postcode: z.string().max(20).optional(),
  notes: z.string().optional(),
  source: z.string().max(100).optional(),
});

export const updateLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  source: z.string().max(100).optional(),
  interestLevel: z.enum(['high', 'medium', 'low']).optional(),
  homeowner: z.boolean().optional(),
  monthlyEnergyBill: z.number().min(0).optional(),
  notes: z.string().optional(),
  depositionReason: z.string().max(200).optional(),
  roofCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  assignedAgentId: z.string().cuid().nullable().optional(),
  assignedQualifierId: z.string().cuid().nullable().optional(),
  assignedFieldSalesRepId: z.string().cuid().nullable().optional(),
  /** Admin: stop automated SMS journey sends for this lead */
  smsAutomationPaused: z.boolean().optional(),
  /** Admin: highlight in lead lists */
  priority: z.boolean().optional(),
  /** Admin: this lead is a duplicate of the given canonical lead id */
  duplicateOfLeadId: z.string().cuid().nullable().optional(),
});

export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
  note: z.string().optional(),
});

// Qualifier sheet status values (from UI) -> LeadStatus
export const QUALIFIER_STATUS_MAP: Record<string, string> = {
  sent_to_kelly: 'QUALIFYING',
  no_contact: 'NO_CONTACT',
  blow_out: 'NOT_INTERESTED',
  appointment_set: 'APPOINTMENT_SET',
  not_interested: 'NOT_INTERESTED',
  pass_back_to_agent: 'INTERESTED',
  on_hold: 'QUALIFYING',
  qualifier_callback: 'QUALIFIER_CALLBACK',
};

export const qualifyLeadSchema = z.object({
  status: z.string(),
  notes: z.string().optional(),
  qualifier_notes: z.string().optional(),
  appointment_date: z.string().nullable().optional(),
  qualifier_callback_date: z.string().nullable().optional(),
  field_sales_rep: z.string().nullable().optional(), // User ID (CUID) of field sales rep
  full_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address1: z.string().optional(),
  postal_code: z.string().optional(),
  desktop_roof_check_completed: z.boolean().optional(),
  property_type_qualifier: z.string().optional(),
  roof_type_qualifier: z.string().optional(),
  speaking_to_homeowner: z.boolean().optional(),
  both_homeowners_present: z.boolean().optional(),
  property_listed: z.boolean().optional(),
  conservation_area: z.boolean().optional(),
  building_work_ongoing: z.boolean().optional(),
  roof_shaded_obstructed: z.boolean().optional(),
  spray_foam_roof: z.boolean().optional(),
  customer_aware_no_grants: z.boolean().optional(),
  current_electric_bill_type: z.string().optional(),
  customer_age: z.number().optional(),
  aged_18_70: z.boolean().optional(), // maps to aged18To70
  currently_employed: z.boolean().optional(),
  has_good_credit: z.boolean().optional(),
  earns_over_12k: z.boolean().optional(),
  planning_to_move_5_years: z.boolean().optional(),
  available_3_working_days: z.boolean().optional(),
});

export type QualifyLeadInput = z.infer<typeof qualifyLeadSchema>;

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(500).default(20),
  status: leadStatusEnum.optional(),
  source: z.string().optional(),
  assignedAgentId: z.string().cuid().optional(),
  assignedQualifierId: z.string().cuid().optional(),
  assignedFieldSalesRepId: z.string().cuid().optional(),
  search: z.string().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type ImportLeadInput = z.infer<typeof importLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

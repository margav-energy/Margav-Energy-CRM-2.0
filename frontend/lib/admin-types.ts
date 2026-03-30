export interface AdminOverviewMetrics {
  newLeadsToday: number;
  newLeadsYesterday?: number;
  leadsNotContacted5Min: number;
  leadsNotContacted15Min: number;
  leadsByStatus: Record<string, number>;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  wonRevenueThisMonth: number;
  wonRevenuePriorMonth?: number;
  lostOpportunitiesThisMonth: number;
  noShowRate: number;
  pipelineValue: number;
  pipelineOpportunityCount?: number;
  bookedViaSms: number;
  funnelSnapshot: { stage: string; count: number }[];
}

export interface AdminAlert {
  type: string;
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  entityIds: string[];
  actions: { label: string; action: string }[];
}

export interface AdminOverviewData {
  metrics: AdminOverviewMetrics;
  alerts: AdminAlert[];
}

// Lead Operations
export type LeadViewType = 'all' | 'unassigned' | 'duplicates' | 'no-activity';

export interface AdminLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedQualifierId?: string;
  assignedQualifierName?: string;
  assignedFieldSalesRepId?: string;
  assignedFieldSalesRepName?: string;
  createdAt: string;
  lastActivityAt?: string;
  region?: string;
  postcode?: string;
  productInterest?: string;
  priority?: boolean;
  /** Stops automated outbound SMS / journey timers (backend `smsAutomationPaused`) */
  smsAutomationPaused?: boolean;
  duplicateOfLeadId?: string;
  duplicateOfLeadName?: string;
}

// Team Performance
export interface TeamPerformanceUser {
  id: string;
  fullName: string;
  role: string;
  leadsHandled: number;
  firstResponseTimeAvg: number;
  contactedRate: number;
  qualificationRate: number;
  appointmentSetRate: number;
  noShowRate: number;
  closeRate: number;
  revenueGenerated: number;
  avgDealValue: number;
  overdueTaskCount: number;
}

export interface TeamLeaderboardEntry {
  userId: string;
  userName: string;
  rank: number;
  metric: string;
  value: number;
}

// Appointments
export interface AdminAppointment {
  id: string;
  leadId: string;
  leadName: string;
  scheduledAt: string;
  status: string;
  fieldSalesRepId?: string;
  fieldSalesRepName?: string;
  address?: string;
  notes?: string;
}

export interface AdminOpportunity {
  id: string;
  leadId: string;
  leadName: string;
  stage: string;
  estimatedValue?: number;
  productType?: string;
  fieldSalesRepName?: string;
  createdAt: string;
  daysInStage?: number;
}

// SMS
export interface SmsMetrics {
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  replyRate: number;
  optOutRate: number;
  bookedViaSms: number;
  failedDelivery: number;
  activeConversations: number;
  waitingForReply: number;
  requiringTakeover: number;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

// Users
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  region?: string;
  queueOwnership?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// Data Quality
export interface DataQualityIssue {
  type: string;
  title: string;
  count: number;
  ids: string[];
  groups?: { key: string; ids: string[] }[];
}

// Audit
export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  createdAt: string;
}

// Settings
export interface SettingSection {
  key: string;
  label: string;
  description: string;
  items: { key: string; label: string; value: string }[];
}

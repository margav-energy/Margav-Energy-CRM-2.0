import type {
  AdminOverviewData,
  AdminLead,
  TeamPerformanceUser,
  AdminAppointment,
  AdminOpportunity,
  SmsMetrics,
  SmsTemplate,
  AdminUser,
  DataQualityIssue,
  AuditLogEntry,
  SettingSection,
} from './admin-types';

export const mockAdminOverview: AdminOverviewData = {
  metrics: {
    newLeadsToday: 12,
    leadsNotContacted5Min: 3,
    leadsNotContacted15Min: 1,
    leadsByStatus: {
      NEW: 8,
      CONTACTED: 15,
      INTERESTED: 6,
      QUALIFIED: 4,
      APPOINTMENT_SET: 5,
      NOT_INTERESTED: 2,
      DEPOSITION: 1,
    },
    appointmentsToday: 4,
    appointmentsThisWeek: 18,
    wonRevenueThisMonth: 125000,
    lostOpportunitiesThisMonth: 3,
    noShowRate: 0.12,
    pipelineValue: 285000,
    bookedViaSms: 7,
    funnelSnapshot: [
      { stage: 'Leads', count: 45 },
      { stage: 'Contacted', count: 38 },
      { stage: 'Qualified', count: 15 },
      { stage: 'Appointments', count: 12 },
      { stage: 'Proposals', count: 8 },
      { stage: 'Won', count: 4 },
    ],
  },
  alerts: [
    {
      type: 'hot_leads',
      title: 'Hot Leads Not Assigned',
      count: 3,
      severity: 'high',
      entityIds: ['l1', 'l2', 'l3'],
      actions: [
        { label: 'View', action: 'view' },
        { label: 'Assign', action: 'assign' },
      ],
    },
    {
      type: 'qualified_no_appt',
      title: 'Qualified, No Appointment',
      count: 5,
      severity: 'high',
      entityIds: ['l4', 'l5'],
      actions: [{ label: 'Set Appointment', action: 'set_appt' }],
    },
    {
      type: 'overdue',
      title: 'Overdue Follow-ups',
      count: 7,
      severity: 'medium',
      entityIds: ['t1'],
      actions: [{ label: 'View Tasks', action: 'view_tasks' }],
    },
    {
      type: 'failed_sms',
      title: 'Failed SMS Deliveries',
      count: 2,
      severity: 'high',
      entityIds: ['m1', 'm2'],
      actions: [{ label: 'Inspect', action: 'inspect' }],
    },
    {
      type: 'missing_rep',
      title: 'Appointments Missing Rep',
      count: 1,
      severity: 'high',
      entityIds: ['a1'],
      actions: [{ label: 'Assign', action: 'assign' }],
    },
  ],
};

// Lead Operations
export const mockAdminLeads: AdminLead[] = [
  { id: 'l1', firstName: 'Sarah', lastName: 'Johnson', phone: '512-555-0101', email: 'sarah.j@email.com', status: 'NEW', source: 'Website', assignedAgentName: 'Mike R.', createdAt: '2025-03-12T09:00:00Z', lastActivityAt: '2025-03-12T09:00:00Z', postcode: '78701', productInterest: 'Solar', priority: true },
  { id: 'l2', firstName: 'James', lastName: 'Chen', phone: '512-555-0102', email: 'j.chen@email.com', status: 'CONTACTED', source: 'Referral', assignedAgentName: 'Sarah K.', createdAt: '2025-03-11T14:00:00Z', lastActivityAt: '2025-03-12T08:30:00Z', postcode: '78702', productInterest: 'Battery' },
  { id: 'l3', firstName: 'Maria', lastName: 'Garcia', phone: '512-555-0103', email: 'maria.g@email.com', status: 'INTERESTED', source: 'Website', assignedAgentName: 'John D.', createdAt: '2025-03-10T10:00:00Z', lastActivityAt: '2025-03-11T16:00:00Z', postcode: '78703', productInterest: 'Solar', priority: true },
  { id: 'l4', firstName: 'Robert', lastName: 'Smith', phone: '512-555-0104', email: 'r.smith@email.com', status: 'QUALIFIED', source: 'Cold Call', assignedQualifierName: 'Emma W.', createdAt: '2025-03-09T11:00:00Z', lastActivityAt: '2025-03-12T09:00:00Z', postcode: '78704', productInterest: 'Bundle' },
  { id: 'l5', firstName: 'Lisa', lastName: 'Brown', phone: '512-555-0105', email: 'lisa.b@email.com', status: 'APPOINTMENT_SET', source: 'Website', assignedQualifierName: 'Emma W.', assignedFieldSalesRepName: 'Mike R.', createdAt: '2025-03-08T09:00:00Z', lastActivityAt: '2025-03-12T09:00:00Z', postcode: '78705', productInterest: 'Solar' },
  { id: 'l6', firstName: 'David', lastName: 'Wilson', phone: '', email: 'd.wilson@email.com', status: 'NEW', source: '', createdAt: '2025-03-12T08:00:00Z', postcode: '78706', productInterest: 'EV' },
  { id: 'l7', firstName: 'Stuck', lastName: 'Lead', phone: '512-555-0199', email: 'stuck@email.com', status: 'NEW', source: 'Website', createdAt: '2025-03-01T09:00:00Z', lastActivityAt: '2025-03-01T09:00:00Z', postcode: '78701', productInterest: 'Solar' },
];

// Team Performance
export const mockTeamPerformance: TeamPerformanceUser[] = [
  { id: 'u1', fullName: 'Mike Rodriguez', role: 'FIELD_SALES', leadsHandled: 45, firstResponseTimeAvg: 4.2, contactedRate: 0.92, qualificationRate: 0.65, appointmentSetRate: 0.48, noShowRate: 0.08, closeRate: 0.32, revenueGenerated: 125000, avgDealValue: 8500, overdueTaskCount: 2 },
  { id: 'u2', fullName: 'Sarah Kim', role: 'AGENT', leadsHandled: 78, firstResponseTimeAvg: 3.1, contactedRate: 0.88, qualificationRate: 0.58, appointmentSetRate: 0.42, noShowRate: 0.12, closeRate: 0.28, revenueGenerated: 98000, avgDealValue: 7200, overdueTaskCount: 1 },
  { id: 'u3', fullName: 'John Davis', role: 'QUALIFIER', leadsHandled: 62, firstResponseTimeAvg: 5.0, contactedRate: 0.85, qualificationRate: 0.72, appointmentSetRate: 0.55, noShowRate: 0.10, closeRate: 0.25, revenueGenerated: 75000, avgDealValue: 6800, overdueTaskCount: 4 },
  { id: 'u4', fullName: 'Emma Wilson', role: 'QUALIFIER', leadsHandled: 55, firstResponseTimeAvg: 4.5, contactedRate: 0.90, qualificationRate: 0.68, appointmentSetRate: 0.52, noShowRate: 0.08, closeRate: 0.30, revenueGenerated: 82000, avgDealValue: 7200, overdueTaskCount: 0 },
];

export const mockLeaderboard = [
  { userId: 'u1', userName: 'Mike Rodriguez', rank: 1, metric: 'revenue', value: 125000 },
  { userId: 'u2', userName: 'Sarah Kim', rank: 2, metric: 'revenue', value: 98000 },
  { userId: 'u4', userName: 'Emma Wilson', rank: 3, metric: 'revenue', value: 82000 },
  { userId: 'u3', userName: 'John Davis', rank: 4, metric: 'revenue', value: 75000 },
];

// Appointments
export const mockAdminAppointments: AdminAppointment[] = [
  { id: 'a1', leadId: 'l1', leadName: 'Sarah Johnson', scheduledAt: '2025-03-12T14:00:00Z', status: 'SCHEDULED', fieldSalesRepName: 'Mike R.', address: '123 Main St, Austin TX' },
  { id: 'a2', leadId: 'l2', leadName: 'James Chen', scheduledAt: '2025-03-12T15:30:00Z', status: 'SCHEDULED', fieldSalesRepName: 'Sarah K.', address: '456 Oak Ave, Austin TX' },
  { id: 'a3', leadId: 'l3', leadName: 'Maria Garcia', scheduledAt: '2025-03-12T10:00:00Z', status: 'COMPLETED', fieldSalesRepName: 'John D.', address: '789 Pine Rd, Austin TX', notes: 'Pitch completed, follow-up in 2 days' },
  { id: 'a4', leadId: 'l4', leadName: 'Robert Smith', scheduledAt: '2025-03-13T09:00:00Z', status: 'SCHEDULED', address: '321 Elm St, Austin TX' },
  { id: 'a5', leadId: 'l5', leadName: 'Lisa Brown', scheduledAt: '2025-03-11T11:00:00Z', status: 'NO_SHOW', fieldSalesRepName: 'Mike R.', address: '555 Cedar Ln, Austin TX' },
];

export const mockAdminOpportunities: AdminOpportunity[] = [
  { id: 'o1', leadId: 'l1', leadName: 'Sarah Johnson', stage: 'PITCH_SCHEDULED', estimatedValue: 12000, productType: 'Solar', fieldSalesRepName: 'Mike R.', createdAt: '2025-03-10T10:00:00Z', daysInStage: 2 },
  { id: 'o2', leadId: 'l2', leadName: 'James Chen', stage: 'PITCH_COMPLETED', estimatedValue: 18000, productType: 'Bundle', fieldSalesRepName: 'Sarah K.', createdAt: '2025-03-08T09:00:00Z', daysInStage: 4 },
  { id: 'o3', leadId: 'l3', leadName: 'Maria Garcia', stage: 'WON', estimatedValue: 8500, productType: 'Solar', fieldSalesRepName: 'John D.', createdAt: '2025-03-05T09:00:00Z', daysInStage: 7 },
];

// SMS
export const mockSmsMetrics: SmsMetrics = {
  sentToday: 45,
  sentThisWeek: 312,
  sentThisMonth: 1250,
  replyRate: 0.42,
  optOutRate: 0.02,
  bookedViaSms: 7,
  failedDelivery: 3,
  activeConversations: 28,
  waitingForReply: 12,
  requiringTakeover: 2,
};

export const mockSmsTemplates: SmsTemplate[] = [
  { id: 't1', name: 'Welcome', body: 'Hi {{leadName}}, thanks for your interest in solar! We\'ll reach out shortly.', variables: ['leadName'], isActive: true },
  { id: 't2', name: 'Appointment Reminder', body: 'Hi {{leadName}}, your appointment with {{repName}} is tomorrow at {{time}}. Reply YES to confirm.', variables: ['leadName', 'repName', 'time'], isActive: true },
  { id: 't3', name: 'Follow-up', body: 'Hi {{leadName}}, just checking in. Have you had a chance to review our proposal?', variables: ['leadName'], isActive: true },
];

// Users
export const mockAdminUsers: AdminUser[] = [
  { id: 'u1', fullName: 'Mike Rodriguez', email: 'mike@margav.com', role: 'FIELD_SALES', status: 'active', region: 'Austin Central', createdAt: '2024-01-15T00:00:00Z', lastLoginAt: '2025-03-12T08:30:00Z' },
  { id: 'u2', fullName: 'Sarah Kim', email: 'sarah@margav.com', role: 'AGENT', status: 'active', region: 'Austin North', createdAt: '2024-02-01T00:00:00Z', lastLoginAt: '2025-03-12T09:00:00Z' },
  { id: 'u3', fullName: 'John Davis', email: 'john@margav.com', role: 'QUALIFIER', status: 'active', region: 'Austin South', createdAt: '2024-01-20T00:00:00Z', lastLoginAt: '2025-03-11T17:00:00Z' },
  { id: 'u4', fullName: 'Emma Wilson', email: 'emma@margav.com', role: 'QUALIFIER', status: 'active', region: 'Austin East', createdAt: '2024-03-01T00:00:00Z', lastLoginAt: '2025-03-12T08:45:00Z' },
  { id: 'u5', fullName: 'Admin User', email: 'admin@margav.com', role: 'ADMIN', status: 'active', createdAt: '2024-01-01T00:00:00Z', lastLoginAt: '2025-03-12T09:00:00Z' },
];

// Data Quality
export const mockDataQualityIssues: DataQualityIssue[] = [
  { type: 'duplicate_leads', title: 'Duplicate Leads', count: 12, ids: ['l1', 'l2', 'l3'], groups: [{ key: '512-555-0101', ids: ['l1', 'l7'] }, { key: 'sarah.j@email.com', ids: ['l1', 'l8'] }] },
  { type: 'missing_phone', title: 'Missing Phone Numbers', count: 5, ids: ['l6', 'l9', 'l10'] },
  { type: 'invalid_postcode', title: 'Invalid Postcode', count: 3, ids: ['l11', 'l12'] },
  { type: 'opportunities_missing_value', title: 'Opportunities Missing Value', count: 4, ids: ['o4', 'o5', 'o6'] },
  { type: 'appointments_missing_rep', title: 'Appointments Missing Rep', count: 1, ids: ['a4'] },
  { type: 'leads_missing_source', title: 'Leads Missing Source', count: 2, ids: ['l6', 'l13'] },
];

// Audit
export const mockAuditLog: AuditLogEntry[] = [
  { id: 'al1', userId: 'u2', userName: 'Sarah Kim', action: 'STATUS_CHANGE', entityType: 'LEAD', entityId: 'l1', oldValue: { status: 'NEW' }, newValue: { status: 'CONTACTED' }, createdAt: '2025-03-12T09:15:00Z' },
  { id: 'al2', userId: 'u3', userName: 'John Davis', action: 'ASSIGN', entityType: 'LEAD', entityId: 'l2', newValue: { assignedAgentId: 'u2' }, createdAt: '2025-03-12T09:10:00Z' },
  { id: 'al3', userId: 'u4', userName: 'Emma Wilson', action: 'CREATE', entityType: 'APPOINTMENT', entityId: 'a4', newValue: { leadId: 'l4', scheduledAt: '2025-03-13T09:00:00Z' }, createdAt: '2025-03-12T09:05:00Z' },
  { id: 'al4', userId: 'u1', userName: 'Mike Rodriguez', action: 'STAGE_CHANGE', entityType: 'OPPORTUNITY', entityId: 'o3', oldValue: { stage: 'PITCH_COMPLETED' }, newValue: { stage: 'WON' }, createdAt: '2025-03-12T08:45:00Z' },
  { id: 'al5', userId: 'u5', userName: 'Admin User', action: 'SMS_TEMPLATE_EDIT', entityType: 'SMS_TEMPLATE', entityId: 't1', createdAt: '2025-03-11T14:00:00Z' },
];

// Settings
export const mockSettingSections: SettingSection[] = [
  { key: 'lead_statuses', label: 'Lead Statuses', description: 'Configure lead lifecycle statuses', items: [{ key: 'statuses', label: 'Statuses', value: 'NEW,CONTACTED,INTERESTED,QUALIFIED,APPOINTMENT_SET,NOT_INTERESTED,DEPOSITION' }] },
  { key: 'deposition_reasons', label: 'Deposition Reasons', description: 'Reasons for closing leads', items: [{ key: 'reasons', label: 'Reasons', value: 'Price,Timing,Competitor,No Response,Other' }] },
  { key: 'product_types', label: 'Product Types', description: 'Product offerings', items: [{ key: 'types', label: 'Types', value: 'Solar,Battery,EV,Bundle' }] },
  { key: 'lost_reasons', label: 'Lost Reasons', description: 'Opportunity lost reasons', items: [{ key: 'reasons', label: 'Reasons', value: 'Price,Timing,Competitor,Financing,Other' }] },
  { key: 'task_priorities', label: 'Task Priorities', description: 'Task priority levels', items: [{ key: 'priorities', label: 'Priorities', value: 'High,Medium,Low' }] },
];

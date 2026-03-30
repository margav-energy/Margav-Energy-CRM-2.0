/**
 * API client for Margav CRM backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('margav_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data ?? json;
  return { data };
}

// Notifications
export async function getNotifications() {
  const { data } = await request<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    link?: string;
    priority: string;
  }>>('/notifications');
  return data;
}

// Auth
export async function login(email: string, password: string) {
  const { data } = await request<{ user: { id: string; fullName: string; email: string; role: string }; token: string }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  );
  return data;
}

export async function getMe() {
  const { data } = await request<{ id: string; fullName: string; email: string; role: string }>('/auth/me');
  return data;
}

// Admin
export async function getAdminOverview() {
  const { data } = await request<{ metrics: Record<string, unknown>; alerts: Array<Record<string, unknown>> }>(
    '/admin/overview'
  );
  return data;
}

export type AdminChartPeriod = 'week' | 'month' | 'quarter';

export async function getAdminOverviewCharts(period: AdminChartPeriod = 'month') {
  const { data } = await request<{
    period: AdminChartPeriod;
    periodStart: string;
    leadsByStatus: Record<string, number>;
    funnelSnapshot: Array<{ stage: string; count: number }>;
  }>(`/admin/overview/charts?period=${period}`);
  return data;
}

export async function getAdminLeads(params?: {
  view?: string;
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params?.view) q.set('view', params.view);
  if (params?.search) q.set('search', params.search);
  if (params?.status) q.set('status', params.status);
  if (params?.source) q.set('source', params.source);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const { data } = await request<{ items: unknown[]; total: number; page: number; pageSize: number }>(
    `/admin/leads?${q.toString()}`
  );
  return data;
}

export async function mergeAdminLeads(keepLeadId: string, mergeLeadId: string) {
  const { data } = await request<{ mergedIntoId: string; removedId: string }>('/admin/leads/merge', {
    method: 'POST',
    body: JSON.stringify({ keepLeadId, mergeLeadId }),
  });
  return data;
}

export async function deleteAdminLead(id: string) {
  const { data } = await request<{ deleted: boolean }>(`/admin/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return data;
}

export async function getAdminAppointments(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const { data } = await request<{ items: unknown[]; total: number; page: number; pageSize: number }>(
    `/admin/appointments?${q.toString()}`
  );
  return data;
}

export async function getAdminOpportunities(params?: { stage?: string; page?: number; pageSize?: number }) {
  const q = new URLSearchParams();
  if (params?.stage) q.set('stage', params.stage);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const { data } = await request<{ items: unknown[]; total: number; page: number; pageSize: number }>(
    `/admin/opportunities?${q.toString()}`
  );
  return data;
}

export async function getAdminUsers() {
  const { data } = await request<unknown[]>('/admin/users');
  return data;
}

export async function getSmsMetrics() {
  const { data } = await request<Record<string, unknown>>('/admin/sms-metrics');
  return data;
}

export async function getDataQualityIssues() {
  const { data } = await request<{ issues: Array<Record<string, unknown>> }>('/admin/data-quality');
  return data;
}

export async function getAdminAuditLog(params?: { page?: number; pageSize?: number; userId?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.userId) q.set('userId', params.userId);
  const { data } = await request<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/audit-log?${q.toString()}`);
  return data;
}

export async function getAdminSettingsConfig() {
  const { data } = await request<{ sections: Array<Record<string, unknown>> }>('/admin/settings-config');
  return data;
}

export async function getTeamWorkload(period: 'week' | 'month' | 'quarter' = 'month') {
  const { data } = await request<{
    period: string;
    avgLeadsPerAgent: number;
    avgAppointmentsPerRep: number;
    avgFirstResponseMinutes: number | null;
  }>(`/admin/team-workload?period=${period}`);
  return data;
}

// Reports (for team performance)
export async function getRepPerformance(months = 6) {
  const { data } = await request<Array<{ name: string; calls: number; leads: number; appointments: number; sales: number; revenue: number; conversionRate: number }>>(
    `/reports/rep-performance?months=${months}`
  );
  return data;
}

export async function getWeeklyLeadPerformance(weeks = 1) {
  const { data } = await request<Array<{ name: string; value: number; fill: string }>>(
    `/reports/weekly-lead-performance?weeks=${weeks}`
  );
  return data;
}

export async function getWeeklyFunnel(weeks = 1) {
  const { data } = await request<Array<{ name: string; value: number; fill: string }>>(
    `/reports/weekly-funnel?weeks=${weeks}`
  );
  return data;
}

export async function getAppointmentOutcomes(weeks = 4) {
  const { data } = await request<Array<{ name: string; value: number; fill: string }>>(
    `/reports/appointment-outcomes?weeks=${weeks}`
  );
  return data;
}

export async function getReportsFunnel(months = 6) {
  const { data } = await request<Array<{ name: string; value: number; key: string }>>(
    `/reports/funnel?months=${months}`
  );
  return data;
}

export async function getProductMix(months = 6) {
  const { data } = await request<Array<{ name: string; value: number; revenue: number; color: string }>>(
    `/reports/product-mix?months=${months}`
  );
  return data;
}

export async function getMonthlyTrends(months = 6) {
  const { data } = await request<Array<{ month: string; leads: number; appointments: number; sales: number; revenue: number }>>(
    `/reports/monthly-trends?months=${months}`
  );
  return data;
}

// Agent-specific reports
export async function getAgentDepositions(weeks = 4) {
  const { data } = await request<Array<{ name: string; value: number; fill: string }>>(
    `/reports/agent/depositions?weeks=${weeks}`
  );
  return data;
}

export async function getAgentOutcomes(weeks = 4) {
  const { data } = await request<Array<{ name: string; value: number; fill: string }>>(
    `/reports/agent/outcomes?weeks=${weeks}`
  );
  return data;
}

export async function getAgentSummary(weeks = 4) {
  const { data } = await request<{
    totalLeads: number;
    sentToQualifier: number;
    depositions: number;
    appointmentSet: number;
    inPipeline: number;
    conversionRate: number;
  }>(`/reports/agent/summary?weeks=${weeks}`);
  return data;
}

// Leads
export async function getLeads(params?: { page?: number; pageSize?: number; status?: string; search?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  const { data } = await request<{ items: unknown[]; total: number; page: number; pageSize: number }>(
    `/leads?${q.toString()}`
  );
  return data;
}

export async function getLeadById(id: string) {
  const { data } = await request<unknown>(`/leads/${id}`);
  return data;
}

export async function updateLeadStatus(leadId: string, status: string, note?: string) {
  const { data } = await request<unknown>(`/leads/${leadId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
  return data;
}

export async function qualifyLead(
  leadId: string,
  body: Record<string, unknown>
): Promise<{ lead: unknown; calendar_synced?: boolean }> {
  const { data } = await request<{ lead: unknown; calendar_synced?: boolean }>(
    `/leads/${leadId}/qualify`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return data;
}

export async function createLead(body: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1?: string;
  city?: string;
  postcode?: string;
  notes?: string;
  source?: string;
  status?: string;
}) {
  const { data } = await request<unknown>('/leads', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

export async function updateLead(
  leadId: string,
  body: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
    notes?: string;
    interestLevel?: string;
    homeowner?: boolean;
    monthlyEnergyBill?: number;
    roofCondition?: string;
    assignedAgentId?: string | null;
    assignedQualifierId?: string | null;
    assignedFieldSalesRepId?: string | null;
    smsAutomationPaused?: boolean;
    priority?: boolean;
    duplicateOfLeadId?: string | null;
  }
) {
  const { data } = await request<unknown>(`/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data;
}

export async function getTasks(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  assignedToUserId?: string;
  type?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', params.status);
  if (params?.assignedToUserId) q.set('assignedToUserId', params.assignedToUserId);
  if (params?.type) q.set('type', params.type);
  const { data } = await request<{ items: Array<{
    id: string;
    title: string;
    description?: string | null;
    type: string;
    status: string;
    dueDate: string;
    lead?: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
  }>; total: number }>(`/tasks?${q.toString()}`);
  return data;
}

export async function createTask(body: {
  title: string;
  description?: string;
  type: string;
  priority?: string;
  dueDate: string;
  assignedToUserId: string;
  leadId?: string | null;
}) {
  const { data } = await request<unknown>('/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

// SMS
export async function sendSmsToLead(leadId: string, body: string) {
  const { data } = await request<{ success: boolean; message?: string; threadId?: string }>('/sms/send-to-lead', {
    method: 'POST',
    body: JSON.stringify({ leadId, body }),
  });
  return data;
}

export async function getSmsThreadByLead(leadId: string) {
  const { data } = await request<{ id: string; leadId: string; phone: string; messages: unknown[] }>(
    `/sms/threads/lead/${leadId}`
  );
  return data;
}

// Opportunities (for pipeline drag-and-drop)
export async function updateOpportunity(id: string, body: { stage?: string; ownerId?: string; estimatedValue?: number; notes?: string }) {
  const { data } = await request<unknown>(`/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data;
}

// Team
export async function getFieldSalesReps() {
  const { data } = await request<Array<{ id: string; fullName: string; email: string }>>('/team/field-sales-reps');
  return data;
}

// Appointments
export async function getAppointments(params?: {
  leadId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params?.leadId) q.set('leadId', params.leadId);
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const { data } = await request<{ items: unknown[]; total: number }>(`/appointments?${q.toString()}`);
  return data;
}

/** Temporary dev: SMS lead journey (backend /api/sms-journey/*) */
export type SmsJourneyCallOutcomeType =
  | 'WRONG_NUMBER'
  | 'NOT_INTERESTED'
  | 'APPOINTMENT_BOOKED'
  | 'NO_ANSWER'
  | 'CALLBACK_REQUESTED';

export async function smsJourneySendInitial(leadId: string) {
  const { data } = await request<unknown>(`/sms-journey/send-initial/${leadId}`, { method: 'POST' });
  return data;
}

export async function smsJourneyCallOutcome(
  leadId: string,
  outcome: SmsJourneyCallOutcomeType,
  notes?: string
) {
  const { data } = await request<unknown>('/sms-journey/call-outcome', {
    method: 'POST',
    body: JSON.stringify({ leadId, outcome, notes }),
  });
  return data;
}

export async function smsJourneyBookAppointment(body: {
  leadId: string;
  fieldSalesRepId: string;
  scheduledAt: string;
  notes?: string;
}) {
  const { data } = await request<unknown>('/sms-journey/book-appointment', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

export async function smsJourneyProcessNoReplies(hours: number) {
  const { data } = await request<unknown>('/sms-journey/process-no-replies', {
    method: 'POST',
    body: JSON.stringify({ hours }),
  });
  return data;
}

export async function smsJourneyCronAppointmentReminders() {
  const { data } = await request<unknown>('/sms-journey/cron/appointment-reminders', { method: 'POST' });
  return data;
}

export async function smsJourneyCronSurveyorOnRoute() {
  const { data } = await request<unknown>('/sms-journey/cron/surveyor-on-route', { method: 'POST' });
  return data;
}

export async function smsJourneyCronNextDayFollowup() {
  const { data } = await request<unknown>('/sms-journey/cron/next-day-followup', { method: 'POST' });
  return data;
}

export async function smsJourneySurveyorOnRoute(appointmentId: string) {
  const { data } = await request<unknown>(`/sms-journey/surveyor-on-route/${appointmentId}`, { method: 'POST' });
  return data;
}

export async function createAppointment(body: {
  leadId: string;
  fieldSalesRepId: string;
  scheduledAt: string;
  notes?: string;
}) {
  const { data } = await request<unknown>('/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

// Lead activity timeline
export async function getLeadActivity(leadId: string) {
  const { data } = await request<unknown[]>(`/leads/${leadId}/activity`);
  return data;
}

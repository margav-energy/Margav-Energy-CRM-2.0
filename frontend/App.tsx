import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { PageProvider } from './lib/page-context';
import { Layout } from './components/Layout';
import { LoginPage } from './components/LoginPage';
import { AgentDashboard } from './components/AgentDashboard';
import { QualifierDashboard } from './components/QualifierDashboard';
import { QualifierLeadsPage } from './components/QualifierLeadsPage';
import { FieldSalesDashboard } from './components/FieldSalesDashboard';
import { AppointmentsPage } from './components/AppointmentsPage';
import { TasksPage } from './components/TasksPage';
import { ReportsPage } from './components/ReportsPage';
import { AgentReportsPage } from './components/AgentReportsPage';
import { AdminOverview } from './components/admin/AdminOverview';
import { LeadOperationsPage } from './components/admin/LeadOperationsPage';
import { TeamPerformancePage } from './components/admin/TeamPerformancePage';
import { AppointmentsAdminPage } from './components/admin/AppointmentsAdminPage';
import { SmsAutomationPage } from './components/admin/SmsAutomationPage';
import { UserManagementPage } from './components/admin/UserManagementPage';
import { DataQualityPage } from './components/admin/DataQualityPage';
import { AuditTrailPage } from './components/admin/AuditTrailPage';
import { AdminSettingsPage } from './components/admin/AdminSettingsPage';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';

function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          System configuration and admin settings will be available here.
        </p>
      </CardContent>
    </Card>
  );
}

function CalendarPage() {
  const embedUrl = import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar</CardTitle>
        <p className="text-sm text-muted-foreground">
          {embedUrl
            ? 'Your calendar is embedded below.'
            : 'Add VITE_GOOGLE_CALENDAR_EMBED_URL to .env to show your Google Calendar here.'}
        </p>
      </CardHeader>
      <CardContent>
        {embedUrl ? (
          <div className="rounded-lg border overflow-hidden bg-white" style={{ minHeight: 600 }}>
            <iframe
              src={embedUrl}
              style={{ border: 0, width: '100%', height: 600 }}
              frameBorder="0"
              scrolling="no"
              title="Google Calendar"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="mb-2">To embed Google Calendar:</p>
            <ol className="text-left max-w-md mx-auto space-y-1 list-decimal list-inside">
              <li>Open Google Calendar → Settings (gear) → Select your calendar</li>
              <li>Under &quot;Integrate calendar&quot;, copy the &quot;Embed code&quot; iframe src URL</li>
              <li>Add to frontend/.env: <code className="bg-muted px-1 rounded">VITE_GOOGLE_CALENDAR_EMBED_URL=https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID</code></li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    if (!user) return;
    const adminPageIds = ['admin-overview', 'admin-leads', 'admin-team', 'admin-appointments', 'admin-sms', 'admin-users', 'admin-data-quality', 'admin-audit', 'admin-settings'];
    const isAdminPage = adminPageIds.includes(currentPage);
    if (user.role === 'ADMIN') {
      if (currentPage === 'dashboard' || !isAdminPage) setCurrentPage('admin-overview');
    } else if (isAdminPage) {
      setCurrentPage('dashboard');
    }
  }, [user?.role, user?.id]);

  const renderPage = () => {
    if (!user) return null;

    if (user.role === 'ADMIN') {
      switch (currentPage) {
        case 'admin-overview':
          return <AdminOverview />;
        case 'admin-leads':
          return <LeadOperationsPage />;
        case 'admin-team':
          return <TeamPerformancePage />;
        case 'admin-appointments':
          return <AppointmentsAdminPage />;
        case 'admin-sms':
          return <SmsAutomationPage />;
        case 'admin-users':
          return <UserManagementPage />;
        case 'admin-data-quality':
          return <DataQualityPage />;
        case 'admin-audit':
          return <AuditTrailPage />;
        case 'admin-settings':
          return <AdminSettingsPage />;
        default:
          return <AdminOverview />;
      }
    }

    switch (currentPage) {
      case 'dashboard':
        switch (user.role) {
          case 'AGENT':
            return <AgentDashboard />;
          case 'QUALIFIER':
            return <QualifierDashboard />;
          case 'FIELD_SALES':
            return <FieldSalesDashboard />;
          default:
            return <AgentDashboard />;
        }
      case 'leads':
        return user.role === 'QUALIFIER' ? <QualifierLeadsPage /> : <AgentDashboard />;
      case 'appointments':
        return <AppointmentsPage />;
      case 'opportunities':
        return <FieldSalesDashboard />;
      case 'tasks':
        return <TasksPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'reports':
        return user.role === 'AGENT' ? <AgentReportsPage /> : <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <AgentDashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) {
    return <LoginPage />;
  }

  return (
    <PageProvider value={{ currentPage, setCurrentPage }}>
      <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
        {renderPage()}
      </Layout>
    </PageProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

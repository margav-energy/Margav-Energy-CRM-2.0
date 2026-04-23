import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Settings, Flag, MessageSquare } from 'lucide-react';
import { getAdminSettingsConfig } from '../../lib/api';
import { usePage } from '../../lib/page-context';
import type { SettingSection } from '../../lib/admin-types';
import { toast } from 'react-toastify';

const SETTINGS_STORAGE_KEY = 'crm.admin.settings.v1';

export function AdminSettingsPage() {
  const page = usePage();
  const [sections, setSections] = useState<SettingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('');
  const [draftValues, setDraftValues] = useState<Record<string, Record<string, string>>>({});
  const [globalToggles, setGlobalToggles] = useState({
    smsAutomationEnabled: true,
    auditAlertsEnabled: true,
  });

  useEffect(() => {
    const persisted = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted) as {
          values?: Record<string, Record<string, string>>;
          toggles?: { smsAutomationEnabled?: boolean; auditAlertsEnabled?: boolean };
        };
        if (parsed.values) setDraftValues(parsed.values);
        if (parsed.toggles) {
          setGlobalToggles((prev) => ({
            smsAutomationEnabled: parsed.toggles?.smsAutomationEnabled ?? prev.smsAutomationEnabled,
            auditAlertsEnabled: parsed.toggles?.auditAlertsEnabled ?? prev.auditAlertsEnabled,
          }));
        }
      } catch {
        // ignore invalid local snapshot
      }
    }

    getAdminSettingsConfig()
      .then((res) => {
        const list = (res.sections ?? []) as unknown as SettingSection[];
        setSections(list);
        if (list[0]?.key) setActiveSection(list[0].key);
        setDraftValues((prev) => {
          const next = { ...prev };
          for (const section of list) {
            next[section.key] = next[section.key] ?? {};
            for (const item of section.items) {
              if (!next[section.key][item.key]) next[section.key][item.key] = item.value;
            }
          }
          return next;
        });
      })
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, []);

  const persistSettings = (
    values: Record<string, Record<string, string>>,
    toggles: { smsAutomationEnabled: boolean; auditAlertsEnabled: boolean }
  ) => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        values,
        toggles,
      })
    );
  };

  const updateSectionValue = (sectionKey: string, itemKey: string, value: string) => {
    setDraftValues((prev) => {
      const next = {
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] ?? {}),
          [itemKey]: value,
        },
      };
      persistSettings(next, globalToggles);
      return next;
    });
  };

  const saveSection = (sectionKey: string) => {
    const section = sections.find((s) => s.key === sectionKey);
    if (!section) return;
    toast.success(`${section.label} settings saved`);
  };

  const resetSection = (sectionKey: string) => {
    const section = sections.find((s) => s.key === sectionKey);
    if (!section) return;
    setDraftValues((prev) => {
      const next = {
        ...prev,
        [sectionKey]: Object.fromEntries(section.items.map((item) => [item.key, item.value])),
      };
      persistSettings(next, globalToggles);
      return next;
    });
    toast.info(`${section.label} reset to defaults`);
  };

  const setToggle = (key: 'smsAutomationEnabled' | 'auditAlertsEnabled', value: boolean) => {
    setGlobalToggles((prev) => {
      const next = { ...prev, [key]: value };
      persistSettings(draftValues, next);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">Loading configuration…</div>
    );
  }

  return (
    <div className="space-y-6 mx-auto max-w-6xl">
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure system defaults, automation preferences, and operational controls.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border bg-slate-50/70 p-3">
            <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium">SMS automation</p>
                <p className="text-xs text-muted-foreground">Enable outbound automation journeys</p>
              </div>
              <Switch
                checked={globalToggles.smsAutomationEnabled}
                onCheckedChange={(checked) => setToggle('smsAutomationEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium">Audit alerts</p>
                <p className="text-xs text-muted-foreground">Trigger alerts on sensitive config changes</p>
              </div>
              <Switch
                checked={globalToggles.auditAlertsEnabled}
                onCheckedChange={(checked) => setToggle('auditAlertsEnabled', checked)}
              />
            </div>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Could not load settings.</p>
          ) : (
            <Tabs value={activeSection || sections[0].key} onValueChange={setActiveSection}>
              <TabsList className="flex-wrap h-auto mb-4">
                {sections.map((section) => (
                  <TabsTrigger key={section.key} value={section.key}>
                    {section.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {sections.map((section) => (
                <TabsContent key={section.key} value={section.key} className="mt-4">
                  <Card className="rounded-xl border-slate-200">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>{section.label}</CardTitle>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => resetSection(section.key)}>
                            Reset
                          </Button>
                          <Button size="sm" onClick={() => saveSection(section.key)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.items.map((item) => (
                        <div key={item.key} className="space-y-2">
                          <Label htmlFor={item.key}>{item.label}</Label>
                          <Input
                            id={item.key}
                            value={draftValues[section.key]?.[item.key] ?? item.value}
                            onChange={(e) => updateSectionValue(section.key, item.key, e.target.value)}
                            className="font-mono text-sm"
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Templates
            </CardTitle>
            <p className="text-sm text-muted-foreground">Manage template library and journey copy.</p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => page?.setCurrentPage('admin-sms')}
            >
              Go to SMS Automation
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Automation Rules
            </CardTitle>
            <p className="text-sm text-muted-foreground">Journey timing and triggers (backend + env).</p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => page?.setCurrentPage('admin-sms')}
            >
              Go to SMS Automation
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

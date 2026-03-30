import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Settings, Flag, MessageSquare } from 'lucide-react';
import { getAdminSettingsConfig } from '../../lib/api';
import { usePage } from '../../lib/page-context';
import type { SettingSection } from '../../lib/admin-types';

export function AdminSettingsPage() {
  const page = usePage();
  const [sections, setSections] = useState<SettingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    getAdminSettingsConfig()
      .then((res) => {
        const list = (res.sections ?? []) as unknown as SettingSection[];
        setSections(list);
        if (list[0]?.key) setActiveSection(list[0].key);
      })
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">Loading configuration…</div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Read-only view of enums and options defined in the CRM schema. Business copy for SMS lives under SMS
            Automation.
          </p>
        </CardHeader>
        <CardContent>
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
                  <Card>
                    <CardHeader>
                      <CardTitle>{section.label}</CardTitle>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.items.map((item) => (
                        <div key={item.key} className="space-y-2">
                          <Label htmlFor={item.key}>{item.label}</Label>
                          <Input id={item.key} readOnly defaultValue={item.value} className="font-mono text-sm" />
                          <p className="text-xs text-muted-foreground">
                            Values are defined in code and database migrations. Contact a developer to change lifecycle
                            or role enums.
                          </p>
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
        <Card>
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
        <Card>
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

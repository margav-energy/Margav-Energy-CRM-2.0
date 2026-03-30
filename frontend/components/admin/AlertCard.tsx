import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface AlertCardProps {
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  entityIds: string[];
  actions: { label: string; action: string }[];
  onAction?: (action: string) => void;
}

export function AlertCard({ title, count, severity, actions, onAction }: AlertCardProps) {
  const severityStyles = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-blue-200 bg-blue-50',
  };

  const Icon = severity === 'high' ? AlertTriangle : AlertCircle;

  return (
    <Card className={`${severityStyles[severity]} border h-full flex flex-col`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-medium">{title}</span>
          <span className="ml-auto font-bold text-lg">{count}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        <div className="flex gap-2">
          {actions.map((a) => (
            <Button
              key={a.action}
              size="sm"
              variant="outline"
              onClick={() => onAction?.(a.action)}
              style={
                a.action === 'assign' || a.action === 'set_appt'
                  ? { backgroundColor: 'var(--energy-green-1)', color: 'white', borderColor: 'var(--energy-green-1)' }
                  : undefined
              }
            >
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

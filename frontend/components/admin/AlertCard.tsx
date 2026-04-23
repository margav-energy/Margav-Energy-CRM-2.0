import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface AlertCardProps {
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  entityIds: string[];
  actions: { label: string; action: string }[];
  onAction?: (action: string) => void;
}

export function AlertCard({ title, count, severity, actions, onAction }: AlertCardProps) {
  const styles = {
    high: {
      wrap: 'border-red-200/90 bg-gradient-to-br from-red-50 via-white to-red-50/50 shadow-red-100/40 dark:from-red-950/50 dark:via-red-950/20 dark:to-transparent dark:border-red-900/70 dark:shadow-none',
      bar: 'bg-red-500 dark:bg-red-400',
      iconWrap: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200',
      Icon: AlertTriangle,
      count: 'text-red-700 dark:text-red-300',
    },
    medium: {
      wrap: 'border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 shadow-amber-100/35 dark:from-amber-950/45 dark:via-amber-950/15 dark:to-transparent dark:border-amber-900/60 dark:shadow-none',
      bar: 'bg-amber-500 dark:bg-amber-400',
      iconWrap: 'bg-amber-100 text-amber-800 dark:bg-amber-900/55 dark:text-amber-200',
      Icon: AlertCircle,
      count: 'text-amber-900 dark:text-amber-200',
    },
    low: {
      wrap: 'border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-indigo-50/35 shadow-sky-100/30 dark:from-sky-950/40 dark:via-sky-950/10 dark:to-transparent dark:border-sky-900/55 dark:shadow-none',
      bar: 'bg-sky-500 dark:bg-sky-400',
      iconWrap: 'bg-sky-100 text-sky-800 dark:bg-sky-900/55 dark:text-sky-200',
      Icon: Info,
      count: 'text-sky-900 dark:text-sky-200',
    },
  }[severity];

  const { Icon } = styles;

  return (
    <Card
      className={cn(
        'relative h-full flex flex-col overflow-hidden border-2 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg',
        styles.wrap
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', styles.bar)} aria-hidden />
      <CardHeader className="pb-2 pl-5 pt-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/5 dark:border-white/10',
              styles.iconWrap
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Needs attention in operations</p>
          </div>
          <div
            className={cn(
              'flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-black/5 bg-white/80 px-2.5 text-xl font-bold tabular-nums shadow-sm dark:border-white/10 dark:bg-black/25',
              styles.count
            )}
          >
            {count}
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto pb-4 pl-5 pr-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.action}
              size="sm"
              variant={a.action === 'assign' || a.action === 'set_appt' ? 'default' : 'outline'}
              className={cn(
                'rounded-lg font-medium shadow-sm',
                (a.action === 'assign' || a.action === 'set_appt') &&
                  'bg-[var(--energy-green-1)] text-white hover:bg-[var(--energy-green-1)]/90 border-transparent'
              )}
              onClick={() => onAction?.(a.action)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckSquare,
  UserPlus,
  Calendar,
  BellRing,
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  MapPin,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { getNotifications } from '../lib/api';
import { usePage } from '../lib/page-context';
import {
  getAdminAlertSoundEnabled,
  playAdminAlertTone,
  resumeAdminAlertAudio,
  setAdminAlertSoundEnabled,
} from '../lib/adminAlertSound';
import { cn } from './ui/utils';
import {
  dropDismissalsNotInCurrentSet,
  loadNotificationDismissals,
  NOTIFICATION_DISMISS_SNOOZE_MS,
  pruneStaleDismissals,
  saveNotificationDismissals,
  shouldShowNotification,
  type DismissRecord,
} from '../lib/notificationDismiss';

const POLL_MS = 60_000;
const SNOOZE_MINUTES = Math.round(NOTIFICATION_DISMISS_SNOOZE_MS / 60000);

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  link?: string;
  path?: string;
  priority: string;
}

function pathLine(item: NotificationItem): string | undefined {
  if (item.path?.trim()) return item.path.trim();
  if (item.link?.trim()) return item.link.trim().replace(/^\//, '') || undefined;
  return undefined;
}

function notificationChimeShouldPlay(prev: Map<string, string>, items: NotificationItem[]): boolean {
  const next = new Map(items.map((n) => [n.id, n.message]));
  for (const [id, msg] of next) {
    if (!prev.has(id)) return true;
    if (prev.get(id) !== msg) return true;
  }
  return false;
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, DismissRecord>>(loadNotificationDismissals);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => getAdminAlertSoundEnabled());
  const pageContext = usePage();
  const readyRef = useRef(false);
  const prevMessagesRef = useRef<Map<string, string>>(new Map());

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => shouldShowNotification(n.id, n.message, dismissals)),
    [notifications, dismissals]
  );

  const dismissOne = useCallback((item: NotificationItem) => {
    setDismissals((prev) => {
      const next = pruneStaleDismissals({
        ...prev,
        [item.id]: { message: item.message, at: Date.now() },
      });
      saveNotificationDismissals(next);
      return next;
    });
  }, []);

  const fetchNotifications = useCallback((opts?: { forPoll?: boolean }) => {
    const isPoll = opts?.forPoll === true;
    if (!isPoll) setLoading(true);
    getNotifications()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (readyRef.current && notificationChimeShouldPlay(prevMessagesRef.current, list)) {
          playAdminAlertTone();
        }
        if (!readyRef.current) {
          readyRef.current = true;
        }
        prevMessagesRef.current = new Map(list.map((n) => [n.id, n.message]));
        const ids = new Set(list.map((n) => n.id));
        setDismissals((prev) => {
          const next = pruneStaleDismissals(dropDismissalsNotInCurrentSet(prev, ids));
          saveNotificationDismissals(next);
          return next;
        });
        setNotifications(list);
      })
      .catch(() => {
        if (!readyRef.current) readyRef.current = true;
        setNotifications([]);
      })
      .finally(() => {
        if (!isPoll) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = window.setInterval(() => fetchNotifications({ forPoll: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    const resume = () => {
      resumeAdminAlertAudio();
      document.removeEventListener('pointerdown', resume);
    };
    document.addEventListener('pointerdown', resume, { passive: true });
    return () => document.removeEventListener('pointerdown', resume);
  }, []);

  const getIcon = (type: string, priority: string) => {
    const high = priority === 'high';
    switch (type) {
      case 'task':
        return <CheckSquare className={cn('h-4 w-4', high ? 'text-amber-600' : 'text-amber-500')} />;
      case 'lead':
        return <UserPlus className={cn('h-4 w-4', high ? 'text-emerald-600' : 'text-green-500')} />;
      case 'appointment':
        return <Calendar className={cn('h-4 w-4', high ? 'text-blue-600' : 'text-blue-500')} />;
      case 'ops':
        return <AlertTriangle className={cn('h-4 w-4', high ? 'text-red-600' : 'text-orange-500')} />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleClick = (item: NotificationItem) => {
    if (item.link && pageContext?.setCurrentPage) {
      const page = item.link.startsWith('/') ? item.link.slice(1) : item.link;
      pageContext.setCurrentPage(page);
      setOpen(false);
    }
  };

  const hasItems = visibleNotifications.length > 0;
  const highCount = visibleNotifications.filter((n) => n.priority === 'high').length;
  const hiddenCount = notifications.length - visibleNotifications.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
          aria-label={
            hasItems
              ? `Notifications, ${visibleNotifications.length} items`
              : hiddenCount > 0
                ? 'Notifications, all dismissed for now'
                : 'Notifications'
          }
        >
          {hasItems ? (
            <BellRing className="h-[1.15rem] w-[1.15rem]" />
          ) : (
            <Bell className="h-[1.15rem] w-[1.15rem]" />
          )}
          {hasItems && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums text-white shadow-sm',
                highCount > 0 ? 'bg-red-500' : 'bg-emerald-600'
              )}
            >
              {visibleNotifications.length > 99 ? '99+' : visibleNotifications.length}
            </span>
          )}
          {!hasItems && hiddenCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-muted-foreground/50 ring-2 ring-background"
              title={`${hiddenCount} snoozed — may return in up to ${SNOOZE_MINUTES} min only if the CRM still reports the same alert`}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2.5">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <span className="text-[11px] text-muted-foreground tabular-nums">Updates every {POLL_MS / 1000}s</span>
        </div>
        <ScrollArea className="h-[min(320px,50vh)]">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !hasItems && notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
          ) : !hasItems && hiddenCount > 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>Everything here is snoozed for now.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-1.5">
              {visibleNotifications.map((item) => {
                const fixPath = pathLine(item);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-stretch gap-1 rounded-lg transition-colors',
                      item.priority === 'high' && 'bg-red-50/80 dark:bg-red-950/25'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleClick(item)}
                      disabled={!item.link}
                      className={cn(
                        'min-w-0 flex-1 flex items-start gap-3 rounded-lg p-3 text-left transition-colors',
                        item.link ? 'hover:bg-muted/90 cursor-pointer' : 'opacity-80 cursor-default'
                      )}
                    >
                      <div className="mt-0.5 shrink-0">{getIcon(item.type, item.priority)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.message}</p>
                        {fixPath ? (
                          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-primary">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            <span>
                              <span className="text-muted-foreground font-normal">Fix in: </span>
                              {fixPath}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-auto shrink-0 w-9 rounded-lg text-muted-foreground hover:text-foreground"
                      title="Dismiss"
                      aria-label={`Dismiss: ${item.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismissOne(item);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {soundOn ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="text-[11px] text-muted-foreground truncate">Sound when list changes</span>
          </div>
          <Switch
            checked={soundOn}
            onCheckedChange={(on) => {
              setAdminAlertSoundEnabled(on);
              setSoundOn(on);
              resumeAdminAlertAudio();
              if (on) playAdminAlertTone();
            }}
            className="scale-90"
            aria-label="Play sound when notifications change"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

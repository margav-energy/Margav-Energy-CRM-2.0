import { useState, useEffect } from 'react';
import { Bell, CheckSquare, UserPlus, Calendar, BellDot } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { getNotifications } from '../lib/api';
import { usePage } from '../lib/page-context';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  link?: string;
  priority: string;
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const pageContext = usePage();

  const fetchNotifications = () => {
    setLoading(true);
    getNotifications()
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-4 w-4 text-amber-500" />;
      case 'lead':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'appointment':
        return <Calendar className="h-4 w-4 text-blue-500" />;
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

  const hasUnread = notifications.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {hasUnread ? (
            <BellDot className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-2 py-2 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
        </div>
        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className="w-full flex items-start gap-3 p-3 rounded-md hover:bg-muted/80 text-left transition-colors"
                >
                  <div className="mt-0.5 shrink-0">{getIcon(item.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.message}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

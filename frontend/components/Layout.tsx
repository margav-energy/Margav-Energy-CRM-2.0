import React from 'react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset } from './ui/sidebar';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '../lib/auth-context';
import { getNavItemsForRole } from '../lib/navigation';
import { NotificationDropdown } from './NotificationDropdown';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { user, logout } = useAuth();
  const navItems = user ? getNavItemsForRole(user.role) : [];

  const getPageLabel = (id: string) => {
    const item = navItems.find((i) => i.id === id);
    return item?.label ?? id;
  };

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border">
        <SidebarContent>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--energy-green-1)] to-[var(--energy-green-3)] flex items-center justify-center">
                <span className="text-white font-bold">M</span>
              </div>
              <span className="text-lg font-semibold">Margav Energy</span>
            </div>
          </div>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onPageChange(item.id)}
                      isActive={currentPage === item.id}
                      className="w-full justify-start"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background px-6">
          <SidebarTrigger />
          <h1 className="text-xl font-semibold">
            {getPageLabel(currentPage)}
          </h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="mr-1 shrink-0 border-r border-border/70 pr-3 sm:mr-2 sm:pr-5">
              <NotificationDropdown />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium">{user?.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {user?.usernameDisplay ?? user?.username} · {user?.role.replace('_', ' ')}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-auto p-6 bg-gray-50">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { UserPlus, KeyRound, Search, Settings2, Trash2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { createAdminUser, getAdminUsers, updateAdminUser } from '../../lib/api';
import type { AdminUser } from '../../lib/admin-types';
import { toast } from 'react-toastify';

const ROLES = ['ADMIN', 'AGENT', 'QUALIFIER', 'FIELD_SALES'];
type RoleType = 'ADMIN' | 'AGENT' | 'QUALIFIER' | 'FIELD_SALES';
type UserMeta = { region?: string; queueOwnership?: string; inactive?: boolean; deleted?: boolean };
const USER_META_KEY = 'crm.user-management.meta.v1';

export function UserManagementPage() {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userMeta, setUserMeta] = useState<Record<string, UserMeta>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [addRole, setAddRole] = useState<RoleType>('AGENT');

  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [roleDraft, setRoleDraft] = useState<RoleType>('AGENT');
  const [newPassword, setNewPassword] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    const stored = localStorage.getItem(USER_META_KEY);
    if (stored) {
      try {
        setUserMeta(JSON.parse(stored) as Record<string, UserMeta>);
      } catch {
        setUserMeta({});
      }
    }
    getAdminUsers().then((u) => setUsers(u as AdminUser[])).catch(() => []).finally(() => setLoading(false));
  }, []);

  const persistUserMeta = (next: Record<string, UserMeta>) => {
    setUserMeta(next);
    localStorage.setItem(USER_META_KEY, JSON.stringify(next));
  };

  const refreshUsers = async () => {
    const rows = await getAdminUsers();
    setUsers(rows as AdminUser[]);
  };

  const computedUsers = useMemo(
    () =>
      users.map((u) => {
        const meta = userMeta[u.id] ?? {};
        return {
          ...u,
          status: meta.inactive ? 'inactive' : 'active',
          region: meta.region ?? u.region,
          queueOwnership: meta.queueOwnership ?? u.queueOwnership,
        } as AdminUser;
      }),
    [users, userMeta]
  );

  const filteredUsers = computedUsers.filter((u) => {
    const meta = userMeta[u.id] ?? {};
    const derivedStatus = meta.deleted ? 'deleted' : meta.inactive || !u.lastLoginAt ? 'inactive' : 'active';
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || derivedStatus === statusFilter;
    const matchesSearch =
      !search.trim() ||
      [u.fullName, u.username, u.email ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    return matchesRole && matchesStatus && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const formatDate = (dateStr?: string) =>
    dateStr ? new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const selectedEditUser = computedUsers.find((u) => u.id === editUserId) ?? null;
  const selectedRoleUser = computedUsers.find((u) => u.id === roleUserId) ?? null;
  const selectedPasswordUser = computedUsers.find((u) => u.id === passwordUserId) ?? null;

  const openEditDialog = (user: AdminUser) => {
    setEditUserId(user.id);
    setEditFullName(user.fullName);
    setEditUsername(user.username);
    setEditEmail(user.email ?? '');
  };

  const openRoleDialog = (user: AdminUser) => {
    setRoleUserId(user.id);
    setRoleDraft(user.role as RoleType);
  };

  const softDeleteUser = (user: AdminUser) => {
    const current = userMeta[user.id] ?? {};
    persistUserMeta({
      ...userMeta,
      [user.id]: { ...current, deleted: true, inactive: true },
    });
    toast.success('User deleted (data retained)');
  };

  const restoreDeletedUser = (user: AdminUser) => {
    const current = userMeta[user.id] ?? {};
    persistUserMeta({
      ...userMeta,
      [user.id]: { ...current, deleted: false, inactive: false },
    });
    toast.success('User restored');
  };

  const createUser = async () => {
    try {
      await createAdminUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        password: password.trim(),
        role: addRole,
      });
      setAddOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setAddRole('AGENT');
      await refreshUsers();
      toast.success('User created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create user');
    }
  };

  const saveEditUser = async () => {
    if (!selectedEditUser) return;
    try {
      await updateAdminUser(selectedEditUser.id, {
        fullName: editFullName.trim(),
        username: editUsername.trim().toLowerCase(),
        email: editEmail.trim(),
      });
      setEditUserId(null);
      await refreshUsers();
      toast.success('User updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update user');
    }
  };

  const saveRole = async () => {
    if (!selectedRoleUser) return;
    try {
      await updateAdminUser(selectedRoleUser.id, { role: roleDraft });
      setRoleUserId(null);
      await refreshUsers();
      toast.success('Role updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update role');
    }
  };

  const savePassword = async () => {
    if (!selectedPasswordUser || newPassword.trim().length < 8) return;
    try {
      await updateAdminUser(selectedPasswordUser.id, { password: newPassword.trim() });
      setPasswordUserId(null);
      setNewPassword('');
      toast.success('Password reset complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset password');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = pagedUsers.map((u) => u.id);
    const allSelected = visibleIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedUserIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getUserPresence = (user: AdminUser): 'active' | 'not_logged_in' | 'deleted' => {
    const meta = userMeta[user.id] ?? {};
    if (meta.deleted) return 'deleted';
    if (user.role === 'ADMIN' && !meta.inactive) return 'active';
    if (meta.inactive || !user.lastLoginAt) return 'not_logged_in';
    return 'active';
  };

  const getRoleBadgeClass = (role: string) => {
    if (role === 'ADMIN') return 'bg-emerald-900 text-white';
    if (role === 'QUALIFIER') return 'bg-cyan-100 text-cyan-800';
    if (role === 'FIELD_SALES') return 'bg-indigo-100 text-indigo-800';
    return 'bg-amber-200 text-amber-900';
  };

  const getInitials = (fullName: string) =>
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');

  return (
    <div className="space-y-5 rounded-[22px] border border-slate-300/70 bg-gradient-to-br from-slate-100 via-slate-50 to-sky-100/50 p-5">
      <Card className="rounded-2xl border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search User"
                  className="w-[240px] pl-9"
                />
              </div>
              <Button onClick={() => setAddOpen(true)} className="bg-amber-400 text-slate-900 hover:bg-amber-300">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Not logged in</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <p className="ml-auto text-sm text-muted-foreground">
              Showing {pagedUsers.length} of {filteredUsers.length} filtered users
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={pagedUsers.length > 0 && pagedUsers.every((u) => selectedUserIds.includes(u.id))}
                      onChange={toggleSelectAllVisible}
                    />
                  </TableHead>
                  <TableHead className="w-[300px]">Name</TableHead>
                  <TableHead className="w-[170px]">User Role</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[420px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(loading ? [] : pagedUsers).map((user) => (
                  <TableRow key={user.id} className="h-20">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                          {getInitials(user.fullName)}
                        </div>
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                          <p className="text-xs text-muted-foreground">{user.email ?? user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getRoleBadgeClass(user.role)}>{user.role.replace('_', ' ')}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getUserPresence(user) === 'active' ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : getUserPresence(user) === 'deleted' ? (
                        <Badge className="bg-rose-100 text-rose-700">Deleted</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700">Not Logged In</Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[420px]">
                      <div className="flex flex-wrap items-center gap-4 py-1">
                        <Button size="sm" variant="ghost" onClick={() => openRoleDialog(user)}>
                          <Settings2 className="mr-1 h-3.5 w-3.5" />
                          Modify Roles
                        </Button>
                        {getUserPresence(user) === 'deleted' ? (
                          <Button size="sm" variant="ghost" onClick={() => restoreDeletedUser(user)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Restore User
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => softDeleteUser(user)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove User
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPasswordUserId(user.id)}>
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Reset
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 text-sm">
            <span className="mr-1 text-muted-foreground">displaying page</span>
            <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="rounded border px-3 py-1">{page}</span>
            <span className="text-muted-foreground">/ {totalPages}</span>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as RoleType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={!firstName.trim() || !lastName.trim() || password.trim().length < 8}>Create user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUserId} onOpenChange={(o) => !o && setEditUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} /></div>
            <div><Label>Username</Label><Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserId(null)}>Cancel</Button>
            <Button onClick={saveEditUser} disabled={!editFullName.trim() || !editUsername.trim()}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleUserId} onOpenChange={(o) => !o && setRoleUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign role</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{selectedRoleUser?.fullName}</Label>
            <Select value={roleDraft} onValueChange={(v) => setRoleDraft(v as RoleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUserId(null)}>Cancel</Button>
            <Button onClick={saveRole}>Save role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordUserId} onOpenChange={(o) => !o && setPasswordUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{selectedPasswordUser?.fullName}</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUserId(null)}>Cancel</Button>
            <Button onClick={savePassword} disabled={newPassword.trim().length < 8}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

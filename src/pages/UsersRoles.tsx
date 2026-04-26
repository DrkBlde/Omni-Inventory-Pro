import { useState, useEffect } from "react";
import { useAppStore, ALL_PERMISSIONS } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, UserX, Key, Shield, UserCheck } from "lucide-react"; // Added UserCheck icon
import { useToast } from "@/hooks/use-toast";

const UsersRoles = () => {
  const { 
    users, roles, addUser, updateUser, deactivateUser, 
    activateUser,
    resetPassword, addRole, updateRole, deleteRole, hasPermission 
  } = useAppStore();
  const { toast } = useToast();

  // User form
  const [userDialog, setUserDialog] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ username: '', fullName: '', role: 'Cashier', password: '' });

  // Role form
  const [roleDialog, setRoleDialog] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] as string[] });

  // Reset password
  const [resetDialog, setResetDialog] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const openAddUser = () => { setEditUserId(null); setUserForm({ username: '', fullName: '', role: 'Cashier', password: '' }); setUserDialog(true); };
  const openEditUser = (u: typeof users[0]) => {
    setEditUserId(u.id);
    setUserForm({ username: u.username, fullName: u.fullName, role: u.role, password: '' });
    setUserDialog(true);
  };

  const saveUser = () => {
    if (!userForm.username.trim() || !userForm.fullName.trim()) {
      toast({ title: "Name and username required", variant: "destructive" }); return;
    }
    if (editUserId) {
      updateUser(editUserId, { username: userForm.username, fullName: userForm.fullName, role: userForm.role });
      toast({ title: "User updated" });
    } else {
      if (!userForm.password) { toast({ title: "Password required", variant: "destructive" }); return; }
      addUser({ username: userForm.username, fullName: userForm.fullName, role: userForm.role, isActive: true }, userForm.password);
      toast({ title: "User created" });
    }
    setUserDialog(false);
  };

  const openAddRole = () => { setEditRoleId(null); setRoleForm({ name: '', permissions: [] }); setRoleDialog(true); };
  const openEditRole = (r: typeof roles[0]) => {
    setEditRoleId(r.id);
    setRoleForm({ name: r.name, permissions: [...r.permissions] });
    setRoleDialog(true);
  };

  const togglePerm = (perm: string) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm],
    }));
  };

  const saveRole = () => {
    if (!roleForm.name.trim()) { toast({ title: "Role name required", variant: "destructive" }); return; }
    if (editRoleId) {
      updateRole(editRoleId, roleForm);
      toast({ title: "Role updated" });
    } else {
      addRole(roleForm);
      toast({ title: "Role created" });
    }
    setRoleDialog(false);
  };

  const handleReset = () => {
    if (!newPassword) return;
    resetPassword(resetUserId, newPassword);
    toast({ title: "Password reset" });
    setResetDialog(false);
    setNewPassword('');
  };

  const permGroups = {
    'Inventory': ALL_PERMISSIONS.filter(p => p.startsWith('inventory')),
    'POS': ALL_PERMISSIONS.filter(p => p.startsWith('pos')),
    'Reports': ALL_PERMISSIONS.filter(p => p.startsWith('reports')),
    'Users': ALL_PERMISSIONS.filter(p => p.startsWith('users')),
    'Roles': ALL_PERMISSIONS.filter(p => p.startsWith('roles')),
    'Settings': ALL_PERMISSIONS.filter(p => p.startsWith('settings')),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gradient">Users & Roles</h1>

      <Tabs defaultValue="users">
        <TabsList className="glass-subtle">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-end">
            {hasPermission('users.manage') && (
              <Button onClick={openAddUser} className="gap-2"><Plus className="w-4 h-4" /> Add User</Button>
            )}
          </div>
          <GlassCard className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} className="border-border">
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{u.username}</TableCell>
                    <TableCell><span className="glass-subtle px-2 py-1 rounded text-xs">{u.role}</span></TableCell>
                    <TableCell>
                      {u.isActive
                        ? <span className="text-xs text-success">Active</span>
                        : <span className="text-xs text-destructive">Deactivated</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('users.manage') && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditUser(u)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setResetUserId(u.id); setResetDialog(true); }}><Key className="w-4 h-4" /></Button>
                          </>
                        )}

                        {/* DEACTIVATE LOGIC */}
                        {u.isActive && u.username !== 'admin' && hasPermission('users.manage') && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { deactivateUser(u.id); toast({ title: "User deactivated" }); }}>
                            <UserX className="w-4 h-4" />
                          </Button>
                        )}

                        {/* REACTIVATE LOGIC - Admin/Specialized Permission Only */}
                        {!u.isActive && hasPermission('users.reactivate') && (
                          <Button variant="ghost" size="icon" className="text-success" onClick={() => { activateUser(u.id); toast({ title: "User reactivated" }); }}>
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </TabsContent>

        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="flex justify-end">
            {hasPermission('roles.manage') && (
              <Button onClick={openAddRole} className="gap-2"><Plus className="w-4 h-4" /> Add Role</Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => (
              <GlassCard key={r.id} className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  <h3 className="font-semibold">{r.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{r.permissions.length} permissions</p>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.slice(0, 6).map(p => (
                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded glass-subtle">{p}</span>
                  ))}
                  {r.permissions.length > 6 && <span className="text-[10px] text-muted-foreground">+{r.permissions.length - 6} more</span>}
                </div>
                <div className="flex gap-1 mt-3">
                  {hasPermission('roles.manage') && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEditRole(r)}>Edit</Button>
                      {r.name !== 'Admin' && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { deleteRole(r.id); toast({ title: "Role deleted" }); }}>Delete</Button>}
                    </>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent className="glass-strong border-border max-w-md">
          <DialogHeader><DialogTitle>{editUserId ? 'Edit' : 'Add'} User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Full Name</Label><Input value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} className="bg-accent/30" /></div>
            <div className="space-y-2"><Label>Username</Label><Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} className="bg-accent/30" /></div>
            {!editUserId && <div className="space-y-2"><Label>Password</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="bg-accent/30" /></div>}
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="w-full bg-accent border border-border rounded-md px-3 py-2 text-sm">
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <Button onClick={saveUser} className="w-full">{editUserId ? 'Update' : 'Create'} User</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="glass-strong border-border max-w-lg flex flex-col p-0 overflow-hidden max-h-[85vh]">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle>{editRoleId ? 'Edit' : 'Create'} Role</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <Label>Role Name</Label>
              <Input 
                value={roleForm.name} 
                onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} 
                className="bg-accent/30" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Permissions</Label>
            {Object.entries(permGroups).map(([group, perms]) => (
              <div key={group} className="glass-subtle rounded-lg p-3 border border-white/5">
                <p className="text-[11px] font-bold text-primary/80 mb-3 underline underline-offset-4">{group}</p>
                <div className="grid grid-cols-1 gap-3">
                  {perms.map(p => (
                    <div 
                      key={p} 
                      className="flex items-center space-x-3 group cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        togglePerm(p);
                      }}
                    >
                      <Checkbox 
                        id={p}
                        checked={roleForm.permissions.includes(p)} 
                        onCheckedChange={() => togglePerm(p)} 
                      />
                      <label 
                        htmlFor={p}
                        className="text-sm font-mono cursor-pointer group-hover:text-primary transition-colors"
                      >
                        {p}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 pt-2 bg-background/40 backdrop-blur-sm border-t border-white/5">
            <Button onClick={saveRole} className="w-full h-11">
              {editRoleId ? 'Update Role' : 'Create Role'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="glass-strong border-border max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-accent/30" /></div>
            <Button onClick={handleReset} className="w-full">Reset Password</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersRoles;
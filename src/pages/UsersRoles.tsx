import { useState } from "react";
import { useAppStore, ALL_PERMISSIONS } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, UserX, Key, Shield, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UsersRoles = () => {
  const { 
    users, roles, addUser, updateUser, deactivateUser, 
    activateUser, resetPassword, addRole, updateRole, deleteRole, hasPermission 
  } = useAppStore();
  const { toast } = useToast();

  // User form state
  const [userDialog, setUserDialog] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ username: '', fullName: '', role: '', password: '' });

  // Role form state
  const [roleDialog, setRoleDialog] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] as string[] });

  // Reset password state
  const [resetDialog, setResetDialog] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // --- User Actions ---
  const openAddUser = () => { 
    setEditUserId(null); 
    setUserForm({ 
      username: '', 
      fullName: '', 
      role: roles.length > 0 ? roles[0].id : '', 
      password: '' 
    }); 
    setUserDialog(true); 
  };

  const openEditUser = (u: any) => {
    setEditUserId(u.id);
    // Logic to handle both roleId and nested roleRelation during edit
    const currentRoleId = u.roleId || u.role || (u.roleRelation ? u.roleRelation.id : '');
    setUserForm({ username: u.username, fullName: u.fullName, role: currentRoleId, password: '' });
    setUserDialog(true);
  };

  const saveUser = async () => {
    if (!userForm.username.trim() || !userForm.fullName.trim()) {
      toast({ title: "Name and username required", variant: "destructive" }); return;
    }

    try {
      if (editUserId) {
        await updateUser(editUserId, { 
          username: userForm.username, 
          fullName: userForm.fullName, 
          roleId: userForm.role 
        });
        toast({ title: "User updated successfully" });
      } else {
        if (!userForm.password) { toast({ title: "Password required", variant: "destructive" }); return; }
        await addUser({ ...userForm, roleId: userForm.role, isActive: true });
        toast({ title: "User created successfully" });
      }
      setUserDialog(false);
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message || "Check server connection", variant: "destructive" });
    }
  };

  const openAddRole = () => { setEditRoleId(null); setRoleForm({ name: '', permissions: [] }); setRoleDialog(true); };
  
  const openEditRole = (r: any) => {
    setEditRoleId(r.id);
    setRoleForm({ 
      name: r.name, 
      permissions: Array.isArray(r.permissions) ? [...r.permissions] : [] 
    });
    setRoleDialog(true);
  };

  const togglePerm = (perm: string) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm],
    }));
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) { toast({ title: "Role name required", variant: "destructive" }); return; }
    try {
      if (editRoleId) {
        await updateRole(editRoleId, roleForm);
        toast({ title: "Role updated" });
      } else {
        await addRole(roleForm);
        toast({ title: "Role created" });
      }
      setRoleDialog(false);
    } catch (e: any) {
      toast({ title: "Error saving role", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    if (!newPassword) return;
    try {
      await resetPassword(resetUserId, newPassword);
      toast({ title: "Password has been reset" });
      setResetDialog(false);
      setNewPassword('');
    } catch (e: any) {
      toast({ title: "Reset failed", description: "You might not have permission", variant: "destructive" });
    }
  };

  const permGroups = {
    'Dashboard': ALL_PERMISSIONS.filter(p => p.startsWith('dashboard')),
    'Inventory': ALL_PERMISSIONS.filter(p => p.startsWith('inventory')),
    'POS': ALL_PERMISSIONS.filter(p => p.startsWith('pos')),
    'Reports': ALL_PERMISSIONS.filter(p => p.startsWith('reports')),
    'Users': ALL_PERMISSIONS.filter(p => p.startsWith('users')),
    'Roles': ALL_PERMISSIONS.filter(p => p.startsWith('roles')),
    'Attendance': ALL_PERMISSIONS.filter(p => p.startsWith('attendance')),
    'Settings': ALL_PERMISSIONS.filter(p => p.startsWith('settings')),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient">Users & Roles</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="glass-subtle">
          <TabsTrigger value="users">Users</TabsTrigger>
          {hasPermission('roles.view') && <TabsTrigger value="roles">Roles</TabsTrigger>}
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-end">
            {hasPermission('users.manage') && (
              <Button onClick={openAddUser} className="gap-2">
                <Plus className="w-4 h-4" /> Add User
              </Button>
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
                    <TableCell>
                      <span className="glass-subtle px-2 py-1 rounded text-xs">
                        {/* THE FIX: Lookup priority list */}
                        {u.roleRelation?.name || 
                         roles.find(r => r.id === u.roleId || r.id === u.role)?.name || 
                         u.role || 
                         'No Role'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.isActive
                        ? <span className="text-xs text-success flex items-center gap-1"><UserCheck className="w-3 h-3" /> Active</span>
                        : <span className="text-xs text-destructive flex items-center gap-1"><UserX className="w-3 h-3" /> Deactivated</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('users.manage') && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditUser(u)} className="hover:text-primary">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setResetUserId(u.id); setResetDialog(true); }} className="hover:text-amber-500">
                              <Key className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {u.isActive && u.username !== 'admin' && hasPermission('users.manage') && (
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deactivateUser(u.id)}>
                            <UserX className="w-4 h-4" />
                          </Button>
                        )}
                        {!u.isActive && hasPermission('users.manage') && (
                          <Button variant="ghost" size="icon" className="text-success hover:bg-success/10" onClick={() => activateUser(u.id)}>
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
            {hasPermission('roles.create') && (
              <Button onClick={openAddRole} className="gap-2">
                <Plus className="w-4 h-4" /> Add Role
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => (
              <GlassCard key={r.id} className="relative p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{r.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">
                  {Array.isArray(r.permissions) ? r.permissions.length : 0} Assigned Permissions
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {Array.isArray(r.permissions) && r.permissions.slice(0, 6).map(p => (
                    <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 border border-white/5">{p}</span>
                  ))}
                  {Array.isArray(r.permissions) && r.permissions.length > 6 && (
                    <span className="text-[10px] text-muted-foreground">+{r.permissions.length - 6} more</span>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  {hasPermission('roles.manage') && (
                    <>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEditRole(r)}>Edit</Button>
                      {r.name.toLowerCase() !== 'admin' && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteRole(r.id)}>
                          Delete
                        </Button>
                      )}
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
          <DialogHeader>
            <DialogTitle>{editUserId ? 'Edit Account' : 'Create New User'}</DialogTitle>
            <DialogDescription>Fill in the profile details and assign a role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} className="bg-background/50" />
            </div>
            {!editUserId && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="bg-background/50" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Assigned Role</Label>
              <select 
                value={userForm.role} 
                onChange={e => setUserForm({ ...userForm, role: e.target.value })} 
                className="w-full bg-background/50 border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Button onClick={saveUser} className="w-full h-11 mt-2">
              {editUserId ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Dialog - Complex Height/Scroll Restored */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="glass-strong border-border max-w-lg flex flex-col p-0 overflow-hidden max-h-[90vh]">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle>{editRoleId ? 'Modify Role' : 'Define New Role'}</DialogTitle>
              <DialogDescription>Configure permissions and access levels.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-2">
              <Label>Role Name</Label>
              <Input value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} className="bg-background/50" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
            {Object.entries(permGroups).map(([group, perms]) => (
              perms.length > 0 && (
                <div key={group} className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
                  <h4 className="text-[11px] font-bold uppercase text-primary/70 tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {group}
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {perms.map(p => (
                      <div key={p} className="flex items-center space-x-3 group cursor-pointer" onClick={() => togglePerm(p)}>
                        <Checkbox id={p} checked={roleForm.permissions.includes(p)} onCheckedChange={() => togglePerm(p)} />
                        <label htmlFor={p} className="text-sm font-mono cursor-pointer group-hover:text-primary transition-colors">{p}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
          
          <div className="p-6 bg-background/40 backdrop-blur-md border-t border-white/10">
            <Button onClick={saveRole} className="w-full h-11">Save Role Configuration</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="glass-strong border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Assign a new secure password for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-background/50" />
            </div>
            <Button onClick={handleReset} className="w-full h-11">Update Password</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersRoles;
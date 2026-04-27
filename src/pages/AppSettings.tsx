import { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "@/lib/settingsStore";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { 
  Store, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Receipt, 
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Database,
  Timer
} from "lucide-react";

const AppSettings = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { refreshFromServer } = useAppStore();
  const { toast } = useToast();

  const [form, setForm] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isRestartingDb, setIsRestartingDb] = useState(false);
  const savedGst = useRef<{ gstNumber: string; gstPercentage: number } | null>(null);

  // Sync settings to form exactly once on component mount or when settings load
  useEffect(() => {
    if (settings && !form) {
      setForm({ ...settings });
      // Snapshot the real GST values from the server so we can restore them
      // if the user toggles Normal → GST without saving in between
      savedGst.current = {
        gstNumber: settings.gstNumber || '',
        gstPercentage: settings.gstPercentage ?? 0,
      };
    }
  }, [settings, form]);

  const handleSave = async () => {
    if (!form) return;

    try {
      // 1. Optimistic Update: Sync the store with the form state immediately
      // This prevents the useEffect from resetting the form to old data
      useSettingsStore.setState({ settings: form });

      // Keep the GST snapshot in sync with what was just saved
      savedGst.current = {
        gstNumber: form.gstNumber || '',
        gstPercentage: form.gstPercentage ?? 0,
      };

      // 2. Call the server
      await updateSettings(form);
      
      toast({ 
        title: "Settings Saved",
        description: "Settings Successfuly Saved" 
      });

      // 3. Wait 300ms to allow SQLite to finish its write operation
      setTimeout(async () => {
        if (refreshFromServer) {
          await refreshFromServer();
        }
        // Also refresh the specific settings store from server
        const { refreshFromServer: refreshSettings } = useSettingsStore.getState();
        await refreshSettings();
      }, 300);

    } catch (err: any) {
      console.error("Save failed:", err);
      toast({
        variant: "destructive",
        title: "Database Rejected Save",
        description: err.message || "Connection lost or Payload too large.",
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, storeLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRestartDb = async () => {
    setIsRestartingDb(true);
    try {
      await api.admin.restartDb();
      toast({
        title: "Database Server Restarted",
        description: "The database connection has been refreshed successfully.",
      });
      if (refreshFromServer) await refreshFromServer();
    } catch (err: any) {
      toast({
        title: "Restart Failed",
        description: err.message || "Could not restart the database server.",
        variant: "destructive",
      });
    } finally {
      setIsRestartingDb(false);
    }
  };

  const handleFactoryReset = async () => {
    try {
      await api.admin.resetDb();
      
      // Wipe frontend cache
      useAppStore.setState({
        products: [],
        bills: [],
        customers: [],
        users: [],
        attendance: []
      });

      localStorage.removeItem('omni_token');
      localStorage.clear();
      sessionStorage.clear();

      toast({
        title: "Database Reset Complete",
        description: "All data has been cleared. Reloading app...",
      });

      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      toast({
        title: "Error Resetting Database",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Accessing Settings DB...</p>
      </div>
    );
  }

  // Determine if inputs should be grayed out
  const isNormalBill = form.defaultBillType === "Normal";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient">Settings</h1>
        <Button onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20">
          <Save className="w-4 h-4" /> Save Settings
        </Button>
      </div>

      {/* Store Branding Section */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Store Branding</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-accent/30 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden">
              {form.storeLogo ? (
                <img src={form.storeLogo} alt="Store Logo" className="w-full h-full object-contain" />
              ) : (
                <Store className="w-8 h-8 text-muted-foreground opacity-20" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label>Store Logo</Label>
              <Input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                className="bg-accent/30 text-xs file:text-primary" 
              />
            </div>
          </div>
          
          <div className="grid gap-4 mt-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input 
                value={form.storeName || ""} 
                onChange={e => setForm({ ...form, storeName: e.target.value })} 
                className="bg-accent/30" 
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input 
                value={form.storeAddress || ""} 
                onChange={e => setForm({ ...form, storeAddress: e.target.value })} 
                className="bg-accent/30" 
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input 
                value={form.storePhone || ""} 
                onChange={e => setForm({ ...form, storePhone: e.target.value })} 
                placeholder="e.g. +91 12345 67890"
                className="bg-accent/30" 
              />
            </div>
          </div>
        </div>
      </GlassCard>
      
      {/* Billing Section with Gray-out Logic */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Billing & Taxation</h2>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={isNormalBill ? "opacity-50" : ""}>GSTIN Number</Label>
              <Input 
                value={form.gstNumber || ""} 
                disabled={isNormalBill}
                onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} 
                placeholder={isNormalBill ? "Not Applicable" : "GSTIN"} 
                className={`bg-accent/30 transition-opacity duration-200 ${
                  isNormalBill ? 'opacity-40 cursor-not-allowed grayscale' : 'opacity-100'
                }`} 
              />
            </div>
            <div className="space-y-2">
              <Label className={isNormalBill ? "opacity-50" : ""}>Default GST (%)</Label>
              <Input 
                type="number" 
                value={form.gstPercentage ?? ""} 
                disabled={isNormalBill}
                onChange={e => setForm({ ...form, gstPercentage: Number(e.target.value) })} 
                className={`bg-accent/30 transition-opacity duration-200 ${
                  isNormalBill ? 'opacity-40 cursor-not-allowed grayscale' : 'opacity-100'
                }`} 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <Input 
                value={form.currency || ""} 
                onChange={e => setForm({ ...form, currency: e.target.value })} 
                className="bg-accent/30" 
              />
            </div>
            <div className="space-y-2">
              <Label>Default Bill Type</Label>
              <select
                value={form.defaultBillType || "GST"}
                onChange={e => {
                  const val = e.target.value;
                  setForm({ ...form, defaultBillType: val });
                }}
                className="w-full bg-black/30 border border-white/20 rounded-md h-10 px-2 py-1 text-sm outline-none text-white focus:bg-black/40 focus:border-white/25 backdrop-blur transition-all"
              >
                <option value="GST">GST Invoice</option>
                <option value="Normal">Normal Bill</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Inactivity Timeout Section */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Session & Attendance</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="max-w-[65%]">
              <p className="font-medium text-sm">Auto Logout on Inactivity</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Automatically logs out and stops attendance tracking when the user is idle.
              </p>
            </div>
            <Switch
              checked={(form.inactivityTimeout ?? 10) > 0}
              onCheckedChange={enabled =>
                setForm({ ...form, inactivityTimeout: enabled ? 10 : 0 })
              }
            />
          </div>

          {(form.inactivityTimeout ?? 10) > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Timeout duration</Label>
              <Input
                type="number"
                min={1}
                max={480}
                value={form.inactivityTimeout ?? 10}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  setForm({ ...form, inactivityTimeout: isNaN(val) ? 1 : Math.max(1, val) });
                }}
                className="bg-accent/30 w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          )}

          <p className={`text-[11px] rounded-md px-3 py-2 ${
            (form.inactivityTimeout ?? 10) === 0
              ? 'text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20'
              : 'text-muted-foreground/70 bg-accent/20'
          }`}>
            {(form.inactivityTimeout ?? 10) === 0
              ? '⚠ Inactivity logout is disabled. Attendance will keep counting until manual sign out.'
              : `Users will be logged out after ${form.inactivityTimeout} minute${form.inactivityTimeout !== 1 ? 's' : ''} of no activity.`
            }
          </p>
        </div>
      </GlassCard>

      {/* Database Management Section */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Database Management</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="max-w-[70%]">
            <p className="font-medium text-sm">Restart Database Server</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Resets the backend connection pool if the app becomes unresponsive. This action is safe and preserves all current data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartDb}
            disabled={isRestartingDb}
            className="gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            {isRestartingDb ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isRestartingDb ? "Restarting..." : "Restart DB"}
          </Button>
        </div>
      </GlassCard>

      {/* Danger Zone Section */}
      <GlassCard className="border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 mb-4 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="font-semibold">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="max-w-[70%]">
            <p className="font-medium text-sm">Factory Reset</p>
            <p className="text-[10px] text-red-400/80 leading-relaxed">
              Irreversible action: Deletes all products, bills, users, settings, and attendance records from the server database.
            </p>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowResetDialog(true)} 
            className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Reset Everything
          </Button>
        </div>
      </GlassCard>

      {/* Reset Confirmation Overlay */}
      {showResetDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm transform transition-all animate-in zoom-in-95 duration-200">
            <GlassCard className="border-red-500/50 shadow-2xl shadow-red-900/40">
              <div className="text-center space-y-5">
                <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/10">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Wipe all data?</h3>
                  <p className="text-sm text-muted-foreground">
                    This action will clear all databases and logout all active users. You cannot undo this.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-white/10 hover:bg-white/5" 
                    onClick={() => setShowResetDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 bg-red-600 hover:bg-red-700 font-semibold" 
                    onClick={handleFactoryReset}
                  >
                    Confirm Wipe
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppSettings;
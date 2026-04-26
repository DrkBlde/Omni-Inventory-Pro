import { useState, useEffect } from "react";
import { useSettingsStore } from "@/lib/settingsStore";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { 
  Store, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Receipt, 
  Image as ImageIcon,
  Loader2
} from "lucide-react";

const AppSettings = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { refreshFromServer } = useAppStore();
  const { toast } = useToast();

  const [form, setForm] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Sync from the new store when component mounts
  useEffect(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings, form]);

  const handleSave = () => {
    if (!form) return;

    // Logo size safety check
    if (form.storeLogo && form.storeLogo.length > 500000) {
        toast({
            variant: "destructive",
            title: "Logo too large",
            description: "Please use an image smaller than 500KB."
        });
        return;
    }

    updateSettings(form);
    toast({ 
      title: "Settings Saved",
      description: "Store configuration is now synced with the dedicated database." 
    });
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

  const handleFactoryReset = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      const parsedToken = token ? JSON.parse(token) : null;

      if (!parsedToken) {
        throw new Error('Please login first');
      }

      // Call server to reset database
      const response = await fetch('http://localhost:3001/api/admin/reset-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parsedToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Reset failed');
      }

      // Clear localStorage
      localStorage.clear();

      toast({
        title: "Database Reset Complete",
        description: "All data has been cleared. Reloading...",
      });

      // Reload page (will re-login and fetch fresh data from server)
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast({
        title: "Error Resetting Database",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Hydration Guard
  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Accessing Settings DB...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient">Settings</h1>
        <Button onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20">
          <Save className="w-4 h-4" /> Save to Settings DB
        </Button>
      </div>

      {/* Store Branding */}
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
              <Input type="file" accept="image/*" onChange={handleLogoUpload} className="bg-accent/30 text-xs" />
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
                placeholder="e.g. +91 98765 43210"
                className="bg-accent/30" 
              />
            </div>
          </div>
        </div>
      </GlassCard>
      
      {/* Taxation */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Billing & Taxation</h2>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GSTIN Number</Label>
              <Input 
                value={form.gstNumber || ""} 
                onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} 
                placeholder="GSTIN" 
                className="bg-accent/30" 
              />
            </div>
            <div className="space-y-2">
              <Label>Default GST (%)</Label>
              <Input 
                type="number" 
                value={form.gstPercentage} 
                onChange={e => setForm({ ...form, gstPercentage: Number(e.target.value) })} 
                className="bg-accent/30" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="bg-accent/30" />
            </div>
            <div className="space-y-2">
              <Label>Bill Type</Label>
              <select
                value={form.defaultBillType}
                onChange={e => setForm({ ...form, defaultBillType: e.target.value as any })}
                className="w-full bg-black/30 border border-white/20 rounded-md h-10 px-2 py-1 text-sm outline-none text-white focus:bg-black/40 focus:border-white/25 backdrop-blur"
              >
                <option value="GST">GST Invoice</option>
                <option value="Normal">Normal Bill</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Danger Zone */}
      <GlassCard className="border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 mb-4 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="font-semibold">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Factory Reset</p>
            <p className="text-[10px] text-muted-foreground">Wipe both Settings and Inventory DBs.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setShowResetDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Reset Everything
          </Button>
        </div>
      </GlassCard>

      {/* RESET DIALOG */}
      {showResetDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm">
            <GlassCard className="border-red-500/50">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Wipe all data?</h3>
                  <p className="text-xs text-muted-foreground mt-1">This cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowResetDialog(false)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" onClick={handleFactoryReset}>Confirm</Button>
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
import { useEffect, useState } from "react";
import { Wifi, WifiOff, Monitor, Copy, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Check if running in Electron desktop app
const isElectron = () => {
  return navigator.userAgent.toLowerCase().includes('electron');
};

export const ServerStatus = () => {
  const [ips, setIps] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isOnline: storeOnline } = useAppStore();

  useEffect(() => {
    // Only run in Electron desktop app
    if (!isElectron()) return;

    // Get IPs using node integration (since nodeIntegration: true)
    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      const foundIps: string[] = [];

      for (const iface of Object.values(interfaces)) {
        if (iface) {
          for (const config of iface) {
            if (config.family === 'IPv4' && !config.internal) {
              foundIps.push(config.address);
            }
          }
        }
      }

      setIps(foundIps.length > 0 ? foundIps : ['127.0.0.1']);
    } catch (err) {
      console.error('Failed to get IP addresses:', err);
      setIps(['127.0.0.1']);
    }

    // Check server connection
    const checkConnection = async () => {
      const online = await api.health().catch(() => false);
      setIsOnline(!!online);
    };
    checkConnection();

    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = () => {
    if (ips.length > 0) {
      navigator.clipboard.writeText(`http://${ips[0]}:5173`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Only show in desktop app
  if (!isElectron()) {
    return null;
  }

  return (
    <div className="glass-subtle border border-white/10 rounded-lg p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <span className="font-semibold">Desktop App</span>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
          isOnline || storeOnline
            ? "bg-green-500/10 text-green-400"
            : "bg-red-500/10 text-red-400"
        )}>
          {isOnline || storeOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline || storeOnline ? "Online" : "Offline"}
        </div>
      </div>

      <div className="space-y-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Server IP:</span>
          <span className="font-mono text-primary">{ips[0] || '...'}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span>Web Access:</span>
          <div className="flex items-center gap-1">
            <code className="bg-accent/30 px-1.5 py-0.5 rounded">
              http://{ips[0] || '...'}:5173
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-accent/50"
              onClick={copyToClipboard}
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>

        {copied && (
          <div className="text-green-400 text-[9px] mt-1">
            ✓ URL copied to clipboard
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-muted-foreground">
        <p>Open this URL on other devices to access the web app</p>
      </div>
    </div>
  );
};

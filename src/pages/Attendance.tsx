import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, Calendar, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const AttendancePage = () => {
  const { users, roles, attendance, refreshFromServer } = useAppStore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces re-render every second for live timers

  // Poll server every 10 seconds for fresh attendance data
  useEffect(() => {
    const poll = setInterval(() => refreshFromServer(), 10000);
    refreshFromServer(); // immediate fetch on mount
    return () => clearInterval(poll);
  }, [refreshFromServer]);

  // Tick every second so active durations count up live
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!attendance || !users) return <div className="p-6 text-center">Loading...</div>;

  const formatSecondsToTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // For active sessions, add elapsed seconds since checkIn on top of stored durationSeconds
  const getLiveDuration = (entry: any) => {
    if (entry.checkOut) return entry.durationSeconds || 0;
    const elapsed = Math.floor((Date.now() - new Date(entry.checkIn).getTime()) / 1000);
    return elapsed;
  };

  const getUserStats = (userId: string) => {
    const userEntries = (attendance || []).filter(e => e.userId === userId);
    const todayStr = new Date().toDateString();

    const dailySeconds = userEntries
      .filter(e => new Date(e.checkIn).toDateString() === todayStr)
      .reduce((acc, e) => acc + getLiveDuration(e), 0);

    const totalSeconds = userEntries.reduce((acc, e) => acc + getLiveDuration(e), 0);

    return {
      daily: formatSecondsToTime(dailySeconds),
      total: formatSecondsToTime(totalSeconds),
      entries: userEntries
    };
  };

  // --- DETAILED VIEW ---
  if (selectedUserId) {
    const selectedUser = users.find(u => u.id === selectedUserId);
    const stats = getUserStats(selectedUserId);

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff
        </Button>
        
        <h1 className="text-2xl font-bold">{selectedUser?.fullName}'s Shift History</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-green-500">
            <Timer className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Today's Total</p>
              <p className="text-2xl font-black">{stats.daily}</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
            <Calendar className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">All-Time Total</p>
              <p className="text-2xl font-black">{stats.total}</p>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4">Session Start</th>
                <th className="p-4">Session End</th>
                <th className="p-4 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {stats.entries.sort((a,b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()).map(entry => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-medium">{new Date(entry.checkIn).toLocaleString()}</td>
                  <td className="p-4">
                    {entry.checkOut 
                      ? new Date(entry.checkOut).toLocaleString() 
                      : <span className="text-green-500 font-bold animate-pulse">Active Now</span>
                    }
                  </td>
                  <td className="p-4 text-right font-mono text-primary">
                    {formatSecondsToTime(getLiveDuration(entry))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient">Staff Attendance</h1>
        <div className="text-sm px-3 py-1 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
          Server-Side Tracking Active
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => {
          const stats = getUserStats(user.id);
          const isActive = attendance.some(e => e.userId == user.id && !e.checkOut);
          
          // LOOKUP LOGIC: Find the role name that matches the ID string stored on the user
          const roleObj = roles.find(r => r.id === user.role || r.id === (user.role as any)?.id);
          const roleName = roleObj?.name || (typeof user.role === 'string' ? user.role : (user.role as any)?.name) || 'Staff';
          
          return (
            <GlassCard 
              key={user.id} 
              onClick={() => setSelectedUserId(user.id)} 
              className={cn(
                "p-5 cursor-pointer hover:border-primary/50 transition-all group",
                isActive && "border-green-500/30 bg-green-500/5"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isActive ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-muted text-muted-foreground"
                  )}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold group-hover:text-primary transition-colors">{user.fullName}</p>
                    {/* Fixed: Displays roleName instead of the raw user.role string */}
                    <p className="text-xs text-muted-foreground capitalize">{roleName}</p>
                  </div>
                </div>
                {isActive && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 uppercase tracking-tighter">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                    Online
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Today</p>
                  <p className="text-sm font-black text-primary">{stats.daily}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                  <p className="text-sm font-black">{stats.total}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};

export default AttendancePage;
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Users, Clock, ChevronRight, ArrowLeft, Timer } from "lucide-react";

const AttendancePage = () => {
  const { users, clockEntries } = useAppStore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Filter logic
  const selectedUser = users.find(u => u.id === selectedUserId);
  const userEntries = clockEntries
    .filter(e => e.userId === selectedUserId)
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  // Helper: Calculate Duration
  const getDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const diffMs = endTime - startTime;
    
    const totalHours = diffMs / (1000 * 60 * 60);
    const h = Math.floor(totalHours);
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
      formatted: `${h}h ${m}m`, 
      rawHours: totalHours 
    };
  };

  // Calculate Total Hours for the selected user
  const totalAccumulatedHours = userEntries.reduce((acc, entry) => {
    return acc + getDuration(entry.clockIn, entry.clockOut).rawHours;
  }, 0);

  if (selectedUserId && selectedUser) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff
          </Button>
          <h1 className="text-2xl font-bold">{selectedUser.fullName}'s Logs</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                <Timer className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time Worked</p>
                <p className="text-2xl font-bold text-gradient">{totalAccumulatedHours.toFixed(2)} hrs</p>
              </div>
           </GlassCard>

           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center text-accent-foreground">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{userEntries.length}</p>
              </div>
           </GlassCard>
        </div>

        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="p-4">Clock In</th>
                  <th className="p-4">Clock Out</th>
                  <th className="p-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {userEntries.map(entry => {
                  const duration = getDuration(entry.clockIn, entry.clockOut);
                  const isCurrentlyActive = !entry.clockOut;

                  return (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-medium">
                        {new Date(entry.clockIn).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="p-4">
                        {entry.clockOut ? (
                          new Date(entry.clockOut).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-green-500 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Active Now
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono text-primary font-bold">
                        {duration.formatted}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Main Staff List View
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gradient">Staff Attendance</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => {
          const isActive = clockEntries.some(e => e.userId === user.id && !e.clockOut);
          
          return (
            <GlassCard 
              key={user.id} 
              className="p-4 cursor-pointer hover:border-primary/50 transition-all group"
              onClick={() => setSelectedUserId(user.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              {isActive && (
                <div className="mt-4 flex items-center gap-2 text-[10px] text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full w-fit font-medium">
                  <Clock className="w-3 h-3 animate-pulse" />
                  Currently Clocked In
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};

export default AttendancePage;
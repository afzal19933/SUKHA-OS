"use client";

import { useState, useMemo } from "react";
import { 
  Bell, 
  BellDot, 
  CheckCheck, 
  Trash2, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  WashingMachine,
  ShoppingBag,
  Info
} from "lucide-react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore } from "@/store/authStore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, doc, writeBatch, getDocs, where } from "firebase/firestore";
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

const ICON_MAP: any = {
  checkin: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  checkout: { icon: Info, color: "text-slate-500", bg: "bg-slate-50" },
  housekeeping: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/5" },
  maintenance: { icon: Wrench, color: "text-rose-500", bg: "bg-rose-50" },
  purchase: { icon: ShoppingBag, color: "text-amber-500", bg: "bg-amber-50" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50" },
  alert: { icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
};

export function NotificationBell() {
  const { user } = useAuthStore();
  const db = useFirestore();
  const [isOpen, setIsOpen] = useState(false);

  const notifRef = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, "user_profiles", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
  }, [db, user?.uid]);

  const { data: notifications, isLoading } = useCollection(notifRef);

  const unreadCount = useMemo(() => {
    return notifications?.filter(n => n.status === "unread").length || 0;
  }, [notifications]);

  const handleMarkAllRead = async () => {
    if (!user?.uid || !notifications) return;
    
    const unread = notifications.filter(n => n.status === "unread");
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      const ref = doc(db, "user_profiles", user.uid, "notifications", n.id);
      batch.update(ref, { status: "read", updatedAt: new Date().toISOString() });
    });

    await batch.commit();
  };

  const handleMarkOneRead = (id: string) => {
    if (!user?.uid) return;
    const ref = doc(db, "user_profiles", user.uid, "notifications", id);
    updateDocumentNonBlocking(ref, { status: "read", updatedAt: new Date().toISOString() });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-secondary transition-all">
          {unreadCount > 0 ? (
            <BellDot className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <Bell className="w-5 h-5 text-slate-400" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-lg border-2 border-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-[2rem] shadow-2xl border-none overflow-hidden mt-2" align="end">
        <div className="bg-primary p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Property Alerts</h3>
            <p className="text-[9px] font-bold text-white/70 uppercase">Operational Context</p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[9px] font-black uppercase text-white hover:bg-white/10"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="w-3 h-3 mr-1.5" /> Mark All Read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-secondary">
            {notifications && notifications.length > 0 ? (
              notifications.map((notif) => {
                const config = ICON_MAP[notif.type] || ICON_MAP.info;
                const Icon = config.icon;
                
                return (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "p-4 flex gap-4 transition-colors cursor-pointer group",
                      notif.status === 'unread' ? "bg-primary/5 hover:bg-primary/10" : "bg-white hover:bg-secondary/50"
                    )}
                    onClick={() => handleMarkOneRead(notif.id)}
                  >
                    <div className={cn("shrink-0 p-2 h-9 w-9 rounded-xl flex items-center justify-center shadow-inner", config.bg)}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest", config.color)}>
                          {notif.title}
                        </span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">
                          {formatAppTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className={cn(
                        "text-[11px] leading-relaxed",
                        notif.status === 'unread' ? "font-bold text-slate-800" : "font-medium text-slate-500"
                      )}>
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase">
                          {formatAppDate(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                    {notif.status === 'unread' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center space-y-3">
                <Bell className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">No recent alerts</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 bg-secondary/30 border-t flex justify-center">
          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
            SUKHA OS Real-time Synchronization
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

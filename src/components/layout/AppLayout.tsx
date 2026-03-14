
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { 
  LayoutDashboard, 
  CalendarDays, 
  BedDouble, 
  Wrench, 
  Calculator, 
  Bell, 
  LogOut,
  Menu,
  Users,
  User as UserIcon,
  Settings,
  WashingMachine,
  DoorOpen,
  Building2,
  ChevronDown,
  Clock,
  Check,
  Monitor,
  PlayCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { signOut } from "firebase/auth";
import { collection, query, orderBy, limit, doc } from "firebase/firestore";
import Link from "next/link";
import { cn, formatAppTime } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { name: "Command Center", href: "/command-center", icon: Monitor, restricted: ["owner", "admin", "manager"] },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Reservations", href: "/reservations", icon: CalendarDays },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Housekeeping", href: "/housekeeping", icon: BedDouble },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Laundry", href: "/laundry", icon: WashingMachine },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Team", href: "/team", icon: Users },
  { name: "Simulation", href: "/admin/simulation", icon: PlayCircle, restricted: ["owner", "admin"] },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user: firebaseUser, isUserLoading } = useUser();
  const { _hasHydrated, role, permissions, entityId, setEntityId, availableProperties } = useAuthStore();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firebaseUser) return null;
    return query(
      collection(db, "user_profiles", firebaseUser.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
  }, [db, firebaseUser]);

  const { data: notifications } = useCollection(notificationsQuery);
  const unreadCount = notifications?.filter(n => n.status === 'unread').length || 0;

  const markAsRead = (id: string) => {
    if (!firebaseUser) return;
    updateDocumentNonBlocking(
      doc(db, "user_profiles", firebaseUser.uid, "notifications", id),
      { status: 'read', updatedAt: new Date().toISOString() }
    );
  };

  const markAllAsRead = () => {
    if (!firebaseUser || !notifications) return;
    notifications.forEach(n => {
      if (n.status === 'unread') {
        markAsRead(n.id);
      }
    });
  };

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      // 1. Check Role-based restriction for the item itself
      if (item.restricted && !item.restricted.includes(role || "")) {
        return false;
      }
      
      // 2. Dashboard is always visible
      if (item.name === "Dashboard") return true;

      // 3. For owners/admins, all (non-restricted by other means) items are visible
      if (role === 'owner' || role === 'admin') return true;

      // 4. For others, check specific permissions
      if (permissions && permissions.length > 0) {
        return permissions.includes(item.name);
      }

      return false;
    });
  }, [role, permissions]);

  useEffect(() => {
    if (_hasHydrated && !isUserLoading && !firebaseUser && pathname !== "/login") {
      router.push("/login");
    }
  }, [_hasHydrated, firebaseUser, isUserLoading, router, pathname]);

  if (!_hasHydrated || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (pathname === "/login") return <>{children}</>;
  if (!firebaseUser) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside 
        className={cn(
          "bg-white border-r transition-all duration-300 ease-in-out flex flex-col",
          sidebarOpen ? "w-56" : "w-16"
        )}
      >
        <div className="p-5 flex items-center gap-2.5">
          <div className="bg-primary h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          {sidebarOpen && <span className="font-bold text-lg tracking-tight text-primary">SUKHA OS</span>}
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 p-2.5 rounded-xl transition-all group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:bg-secondary hover:text-primary"
                )}
              >
                <item.icon className={cn("w-4.5 h-4.5 shrink-0", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
                {sidebarOpen && <span className="font-medium text-xs">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b flex items-center justify-between px-5 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)} suppressHydrationWarning>
              <Menu className="w-4 h-4" />
            </Button>

            {availableProperties.length > 0 && pathname !== '/command-center' && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-secondary/50 rounded-lg border border-border/50">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <Select value={entityId || ""} onValueChange={(val) => setEntityId(val)}>
                  <SelectTrigger className="w-[150px] h-7 border-none bg-transparent p-0 focus:ring-0 shadow-none font-semibold text-[11px]">
                    <SelectValue placeholder="Property" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id} className="text-[11px]">
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {pathname === '/command-center' && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-primary/5 rounded-lg border border-primary/10">
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-black uppercase text-primary tracking-widest">Command Center Mode</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative" suppressHydrationWarning>
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-primary text-[9px] text-white flex items-center justify-center rounded-full border-2 border-background">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 overflow-hidden rounded-xl border-none shadow-xl" align="end">
                <div className="p-3 bg-primary text-primary-foreground flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && <Badge variant="secondary" className="bg-white/20 text-white text-[9px] h-4 px-1">{unreadCount} New</Badge>}
                  </h4>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      className="h-6 text-[9px] text-white hover:bg-white/10 p-1"
                      onClick={markAllAsRead}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  {notifications && notifications.length > 0 ? (
                    <div className="divide-y">
                      {notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => n.status === 'unread' && markAsRead(n.id)}
                          className={cn(
                            "p-3 transition-colors relative group cursor-pointer",
                            n.status === 'unread' ? "bg-primary/5 hover:bg-primary/10" : "bg-white hover:bg-secondary/20"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-1.5">
                                {n.status === 'unread' && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                                <p className="text-[11px] font-bold leading-none">{n.title}</p>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{n.message}</p>
                              <div className="flex items-center gap-1 pt-1.5 text-[8px] text-muted-foreground">
                                <Clock className="w-2 h-2" />
                                {formatAppTime(n.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center flex flex-col items-center justify-center">
                      <p className="text-[10px] text-muted-foreground">No updates.</p>
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            <div className="flex items-center gap-3 pl-3 border-l">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold leading-none">{firebaseUser?.displayName || "Admin"}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{role || "Staff"}</p>
                    </div>
                    <Avatar className="h-8 w-8 ring-offset-2 ring-primary transition-all group-hover:ring-2">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <UserIcon className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="text-xs">
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive text-xs">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

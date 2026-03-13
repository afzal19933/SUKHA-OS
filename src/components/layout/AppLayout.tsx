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
  Check
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
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Reservations", href: "/reservations", icon: CalendarDays },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Housekeeping", href: "/housekeeping", icon: BedDouble },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Laundry", href: "/laundry", icon: WashingMachine },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Team", href: "/team", icon: Users },
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

  // Notifications logic
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

  const filteredNavItems = useMemo(() => {
    if (role === 'owner' || role === 'admin') return NAV_ITEMS;
    if (permissions && permissions.length > 0) {
      return NAV_ITEMS.filter(item => 
        item.name === "Dashboard" || 
        permissions.includes(item.name)
      );
    }
    return NAV_ITEMS;
  }, [role, permissions]);

  useEffect(() => {
    if (_hasHydrated && !isUserLoading && !firebaseUser && pathname !== "/login") {
      router.push("/login");
    }
  }, [_hasHydrated, firebaseUser, isUserLoading, router, pathname]);

  if (!_hasHydrated || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-primary-foreground font-bold">S</span>
          </div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tight text-primary">SUKHA OS</span>}
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:bg-secondary hover:text-primary"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} suppressHydrationWarning>
              <Menu className="w-5 h-5" />
            </Button>

            {availableProperties.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
                <Building2 className="w-4 h-4 text-primary" />
                <Select value={entityId || ""} onValueChange={(val) => setEntityId(val)}>
                  <SelectTrigger className="w-[180px] h-8 border-none bg-transparent p-0 focus:ring-0 shadow-none font-semibold text-xs">
                    <SelectValue placeholder="Select Property" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id} className="text-xs">
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" suppressHydrationWarning>
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-4 h-4 bg-primary text-[10px] text-white flex items-center justify-center rounded-full border-2 border-background animate-in zoom-in-50">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-none shadow-2xl" align="end">
                <div className="p-4 bg-primary text-primary-foreground">
                  <h4 className="text-sm font-bold flex items-center justify-between">
                    Notifications
                    {unreadCount > 0 && <Badge variant="secondary" className="bg-white/20 text-white border-none">{unreadCount} New</Badge>}
                  </h4>
                </div>
                <ScrollArea className="h-[350px]">
                  {notifications && notifications.length > 0 ? (
                    <div className="divide-y">
                      {notifications.map((n) => (
                        <div key={n.id} className={cn(
                          "p-4 transition-colors relative group",
                          n.status === 'unread' ? "bg-primary/5" : "bg-white"
                        )}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-1">
                              <p className="text-xs font-bold leading-none">{n.title}</p>
                              <p className="text-[11px] text-muted-foreground leading-snug">{n.message}</p>
                              <div className="flex items-center gap-1.5 pt-1 text-[9px] text-muted-foreground">
                                <Clock className="w-2.5 h-2.5" />
                                {formatAppTime(n.createdAt)}
                              </div>
                            </div>
                            {n.status === 'unread' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => markAsRead(n.id)}
                              >
                                <Check className="w-3 h-3 text-primary" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <Bell className="w-8 h-8 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">All caught up!</p>
                    </div>
                  )}
                </ScrollArea>
                <div className="p-2 border-t text-center bg-secondary/20">
                  <Button variant="link" className="text-[10px] h-auto p-0 text-primary font-bold">See all updates</Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="flex items-center gap-3 pl-4 border-l">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer group">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold leading-none">{firebaseUser?.displayName || "Admin User"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role || "Staff"}</p>
                    </div>
                    <Avatar className="ring-offset-2 ring-primary transition-all group-hover:ring-2 h-9 w-9">
                      <AvatarImage src={`https://picsum.photos/seed/${firebaseUser?.uid}/40/40`} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <UserIcon className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { 
  LayoutDashboard, CalendarDays, BedDouble, Wrench, Calculator, LogOut,
  Menu, Users, Settings, WashingMachine, DoorOpen, Building2, Monitor,
  MessageSquare, Package, Cpu, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WelcomeGreeting } from "@/components/ui/WelcomeGreeting";
import { NotificationManager } from "@/components/notifications/NotificationManager";

const NAV_ITEMS = [
  { name: "Command Center", href: "/command-center", icon: Monitor, restricted: ["admin", "manager"] },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Insights", href: "/ai-insights", icon: Cpu },
  { name: "Reservations", href: "/reservations", icon: CalendarDays },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Housekeeping", href: "/housekeeping", icon: BedDouble },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Laundry", href: "/laundry", icon: WashingMachine },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Communications", href: "/communications", icon: MessageSquare, restricted: ["admin", "manager"] },
  { name: "Team", href: "/team", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user: firebaseUser, isUserLoading } = useUser();
  const { _hasHydrated, role, permissions, entityId, assignedEntityId, setEntityId, availableProperties, userName } = useAuthStore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  useEffect(() => {
    if (_hasHydrated && !isUserLoading && !firebaseUser && pathname !== "/login") {
      router.push("/login");
    }
  }, [_hasHydrated, isUserLoading, firebaseUser, pathname, router]);

  if (!_hasHydrated || isUserLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (pathname === "/login") return <>{children}</>;
  if (!firebaseUser) return null;

  const handleLogout = async () => {
    // Clear the greeting session lock so it triggers on next login
    if (firebaseUser?.uid) {
      sessionStorage.removeItem(`greeted_${firebaseUser.uid}`);
    }
    await signOut(auth);
    router.push("/login");
  };

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.restricted && !item.restricted.includes(role || "")) return false;
    if (item.name === "Dashboard") return true;
    if (role === 'admin' || role === 'owner') return true;
    return permissions?.includes(item.name);
  });

  const filteredProperties = role === 'admin' || assignedEntityId === 'all' 
    ? availableProperties 
    : availableProperties.filter(p => p.id === entityId);

  const SidebarContent = () => (
    <aside className="bg-white h-full flex flex-col w-64">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary h-9 w-9 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <span className="font-black text-xl tracking-tighter text-primary">SUKHA OS</span>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-4">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} className={cn(
              "flex items-center gap-3 p-3 rounded-2xl transition-all group",
              isActive ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-500 hover:bg-secondary hover:text-primary"
            )}>
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-primary")} />
              <span className="font-bold text-xs uppercase tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FD] overflow-hidden relative" suppressHydrationWarning>
      <WelcomeGreeting userName={userName} />
      <NotificationManager />

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop always visible, mobile slides in */}
      <div className={cn(
        "fixed md:relative z-50 md:z-auto h-full transition-transform duration-300 border-r shadow-sm",
        isMobile 
          ? sidebarOpen ? "translate-x-0" : "-translate-x-full"
          : "translate-x-0"
      )}>
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>

            {filteredProperties.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-xl border border-primary/5">
                <Building2 className="w-4 h-4 text-primary" />
                <Select value={entityId || ""} onValueChange={setEntityId} disabled={!(role === 'admin' || assignedEntityId === 'all') && filteredProperties.length <= 1}>
                  <SelectTrigger className="w-[130px] md:w-[180px] h-8 border-none bg-transparent p-0 focus:ring-0 shadow-none font-black text-[11px] uppercase tracking-wider text-primary">
                    <SelectValue placeholder="Property" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {filteredProperties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id} className="text-[11px] font-bold uppercase">{prop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer group">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black uppercase leading-none text-slate-800">{userName || firebaseUser?.displayName}</p>
                    <p className="text-[9px] text-muted-foreground capitalize font-black mt-1 uppercase">
                      {role === 'admin' ? "Master Admin" : role === 'owner' ? "Owner" : role}
                    </p>
                  </div>
                  <Avatar className="h-9 w-9 ring-offset-2 ring-primary transition-all group-hover:ring-2 shadow-md">
                    <AvatarFallback className="bg-primary text-white text-xs font-black uppercase">
                      {userName?.charAt(0) || firebaseUser?.displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl shadow-2xl border-none">
                <DropdownMenuItem onClick={() => router.push('/settings')} className="text-xs font-bold uppercase p-3 rounded-xl cursor-pointer">
                  <Settings className="mr-3 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onClick={handleLogout} className="text-xs font-bold uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50">
                  <LogOut className="mr-3 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

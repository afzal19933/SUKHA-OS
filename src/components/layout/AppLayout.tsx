
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
  LogOut,
  Menu,
  Users,
  User as UserIcon,
  Settings,
  WashingMachine,
  DoorOpen,
  Building2,
  Monitor,
  MessageSquare,
  Package,
  Cpu,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
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
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const { _hasHydrated, role, permissions, entityId, setEntityId, availableProperties } = useAuthStore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAdmin = role === 'admin';
  const isOwner = role === 'owner';

  // Admin sees all properties. Owner/Staff see only their assigned entity.
  const filteredProperties = useMemo(() => {
    if (isAdmin) return availableProperties;
    return availableProperties.filter(p => p.id === entityId);
  }, [availableProperties, isAdmin, entityId]);

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.restricted && !item.restricted.includes(role || "")) return false;
      if (item.name === "Dashboard") return true;
      if (isAdmin || isOwner) return true;
      return permissions?.includes(item.name);
    });
  }, [role, permissions, isAdmin, isOwner]);

  useEffect(() => {
    if (_hasHydrated && !isUserLoading && !firebaseUser && pathname !== "/login") {
      router.push("/login");
    }
  }, [_hasHydrated, firebaseUser, isUserLoading, router, pathname]);

  if (!_hasHydrated || isUserLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (pathname === "/login") return <>{children}</>;
  if (!firebaseUser) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-[#F8F9FD] overflow-hidden">
      <aside className={cn("bg-white border-r transition-all duration-300 flex flex-col", sidebarOpen ? "w-64" : "w-20")}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary h-9 w-9 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-black text-lg">S</span>
          </div>
          {sidebarOpen && <span className="font-black text-xl tracking-tighter text-primary">SUKHA OS</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className={cn(
                "flex items-center gap-3 p-3 rounded-2xl transition-all group",
                isActive ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-500 hover:bg-secondary hover:text-primary"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-primary")} />
                {sidebarOpen && <span className="font-bold text-xs uppercase tracking-tight">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)} suppressHydrationWarning>
              <Menu className="w-5 h-5" />
            </Button>

            {filteredProperties.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-xl border border-primary/5">
                <Building2 className="w-4 h-4 text-primary" />
                <Select value={entityId || ""} onValueChange={setEntityId} disabled={isOwner && filteredProperties.length <= 1}>
                  <SelectTrigger className="w-[180px] h-8 border-none bg-transparent p-0 focus:ring-0 shadow-none font-black text-[11px] uppercase tracking-wider text-primary">
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

          <div className="flex items-center gap-4">
            {isOwner && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Property View Only</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black uppercase leading-none text-slate-800">{firebaseUser?.displayName}</p>
                    <p className="text-[9px] text-muted-foreground capitalize font-black mt-1 uppercase">
                      {isAdmin ? "Master Administrator" : isOwner ? "Property Owner" : role}
                    </p>
                  </div>
                  <Avatar className="h-10 w-10 ring-offset-2 ring-primary transition-all group-hover:ring-2 shadow-md">
                    <AvatarFallback className="bg-primary text-white text-xs font-black uppercase">
                      {firebaseUser?.displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-none">
                <DropdownMenuItem onClick={() => router.push('/settings')} className="text-xs font-bold uppercase p-3 rounded-xl cursor-pointer">
                  <Settings className="mr-3 h-4 w-4" /> System Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onClick={handleLogout} className="text-xs font-bold uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50">
                  <LogOut className="mr-3 h-4 w-4" /> Terminate Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

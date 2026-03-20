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
  MessageSquare,
  Package,
  Cpu,
  Sparkles
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
import { collection, query, orderBy, limit, doc, where, getDocs, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { cn, formatAppTime } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { name: "Command Center", href: "/command-center", icon: Monitor, restricted: ["admin", "manager"] }, // Restricted for Owners
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Insights", href: "/ai-insights", icon: Cpu, restricted: ["owner", "admin"] },
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
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAdmin = role === 'admin';
  const isOwner = role === 'owner';

  // Owners cannot switch entities if they are assigned to one.
  const filteredProperties = useMemo(() => {
    if (isAdmin) return availableProperties;
    if (isOwner && entityId) {
      return availableProperties.filter(p => p.id === entityId);
    }
    return availableProperties;
  }, [availableProperties, isAdmin, isOwner, entityId]);

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      // Owners see read-only versions of almost everything except specific command modules
      if (item.restricted && !item.restricted.includes(role || "")) {
        return false;
      }
      if (item.name === "Dashboard") return true;
      if (isAdmin || isOwner) return true;
      if (permissions && permissions.length > 0) {
        return permissions.includes(item.name);
      }
      return false;
    });
  }, [role, permissions, isAdmin, isOwner]);

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

            {filteredProperties.length > 0 && pathname !== '/command-center' && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-secondary/50 rounded-lg border border-border/50">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <Select 
                  value={entityId || ""} 
                  onValueChange={(val) => setEntityId(val)}
                  disabled={isOwner && filteredProperties.length === 1} // Owner cannot switch away from their entity
                >
                  <SelectTrigger className="w-[150px] h-7 border-none bg-transparent p-0 focus:ring-0 shadow-none font-semibold text-[11px]">
                    <SelectValue placeholder="Property" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProperties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id} className="text-[11px]">
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 pl-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold leading-none">{firebaseUser?.displayName || "User"}</p>
                      <p className="text-[10px] text-muted-foreground capitalize font-black">{role || "Staff"}</p>
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
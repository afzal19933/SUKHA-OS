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
  ChevronDown
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
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const { _hasHydrated, role, permissions, entityId, setEntityId, availableProperties, theme } = useAuthStore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const isAyurveda = theme === 'ayurveda';

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", isAyurveda && "theme-ayurveda")}>
      <aside 
        className={cn(
          "bg-white border-r transition-all duration-300 ease-in-out flex flex-col",
          sidebarOpen ? "w-64" : "w-20",
          isAyurveda && "bg-[#081915] border-[#274E45]"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg">
            <span className="text-primary-foreground font-bold font-ayurveda-heading">S</span>
          </div>
          {sidebarOpen && <span className="font-bold text-xl tracking-tighter text-primary font-ayurveda-heading">SUKHA OS</span>}
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all group relative overflow-hidden",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-xl" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-primary",
                  isAyurveda && isActive && "bg-[#1B3A34] text-[#F5F3EA] border-l-4 border-[#C8A96A] rounded-l-none"
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
        <header className={cn(
          "h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-10",
          isAyurveda && "bg-[#081915]/80 backdrop-blur-lg border-[#274E45]"
        )}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} suppressHydrationWarning className="hover:bg-primary/10">
              <Menu className="w-5 h-5" />
            </Button>

            {/* Entity Selector */}
            {availableProperties.length > 0 && (
              <div className={cn(
                "hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/50",
                isAyurveda && "bg-[#122F28] border-[#274E45]"
              )}>
                <Building2 className="w-4 h-4 text-primary" />
                <Select value={entityId || ""} onValueChange={(val) => setEntityId(val)}>
                  <SelectTrigger className="w-[180px] h-8 border-none bg-transparent p-0 focus:ring-0 shadow-none font-semibold text-xs text-foreground">
                    <SelectValue placeholder="Select Property" />
                  </SelectTrigger>
                  <SelectContent className={cn(isAyurveda && "bg-[#122F28] border-[#274E45]")}>
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
            <Button variant="ghost" size="icon" className="relative hover:bg-primary/10" suppressHydrationWarning>
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
            </Button>
            
            <div className="flex items-center gap-3 pl-4 border-l border-border/50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold leading-none">{firebaseUser?.displayName || "Admin User"}</p>
                      <p className="text-xs text-muted-foreground capitalize font-manrope">{role || "Staff"}</p>
                    </div>
                    <Avatar className="ring-offset-2 ring-primary transition-all group-hover:ring-2 h-9 w-9">
                      <AvatarImage src={`https://picsum.photos/seed/${firebaseUser?.uid}/40/40`} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <UserIcon className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn("w-56", isAyurveda && "bg-[#122F28] border-[#274E45]")}>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className={cn(isAyurveda && "bg-[#274E45]")} />
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={cn(isAyurveda && "bg-[#274E45]")} />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
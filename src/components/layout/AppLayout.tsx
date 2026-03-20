
"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  Loader2,
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
import { generateGreetingAudio } from "@/ai/flows/greeting-tts-flow";
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
  const { _hasHydrated, role, permissions, entityId, assignedEntityId, setEntityId, availableProperties, userName } = useAuthStore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Welcome State
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeText, setWelcomeText] = useState("");
  const [isGlowActive, setIsGlowActive] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);
  const welcomeTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Closes the welcome overlay smoothly.
   */
  const dismissWelcome = useCallback(() => {
    setIsExiting(true);
    setIsGlowActive(false);
    setIsPulsing(false);
    
    setTimeout(() => {
      setShowWelcome(false);
      setIsExiting(false);
    }, 500); // Wait for exit animation
  }, []);

  /**
   * Premium Welcome Sequence
   * Strictly synchronized with TTS audio and real profile name.
   */
  useEffect(() => {
    // Only trigger greeting when we have a real profile name and are on dashboard
    if (firebaseUser && !isUserLoading && userName && pathname === "/dashboard") {
      const storageKey = `welcomed_v4_${firebaseUser.uid}`;
      const hasWelcomed = sessionStorage.getItem(storageKey);
      
      if (!hasWelcomed) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        
        // Strictly use Mr format as requested
        const formattedName = userName.includes("Mr") ? userName : `Mr ${userName}`;
        setWelcomeText(`${greeting}, ${formattedName}.`);
        sessionStorage.setItem(storageKey, 'true');

        // Immediately show the backdrop blur to hide the dashboard
        setShowWelcome(true);

        // Preload Audio
        generateGreetingAudio({ greeting, userName: formattedName }).then(audioUri => {
          const audio = new Audio(audioUri);
          welcomeAudioRef.current = audio;
          
          audio.oncanplaythrough = () => {
            setIsAudioReady(true);
            setIsGlowActive(true);
            
            audio.play().catch(e => {
              console.warn("Audio playback blocked", e);
            });

            // Sync pulse effect with name mention
            setTimeout(() => setIsPulsing(true), 800);
            setTimeout(() => setIsPulsing(false), 2000);

            // Audio End listener or fallback timeout
            audio.onended = () => {
              dismissWelcome();
            };

            // Safeguard timeout
            welcomeTimerRef.current = setTimeout(() => {
              dismissWelcome();
            }, 3000);
          };
        }).catch(err => {
          console.error("Welcome Greeting Failed:", err);
          dismissWelcome();
        });
      }
    }

    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      if (welcomeAudioRef.current) {
        welcomeAudioRef.current.pause();
        welcomeAudioRef.current = null;
      }
    };
  }, [firebaseUser, isUserLoading, userName, pathname, dismissWelcome]);

  const filteredProperties = useMemo(() => {
    if (role === 'admin' || assignedEntityId === 'all') return availableProperties;
    return availableProperties.filter(p => p.id === entityId);
  }, [availableProperties, role, assignedEntityId, entityId]);

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.restricted && !item.restricted.includes(role || "")) return false;
      if (item.name === "Dashboard") return true;
      if (role === 'admin' || role === 'owner') return true;
      return permissions?.includes(item.name);
    });
  }, [role, permissions]);

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
    sessionStorage.removeItem(`welcomed_v4_${firebaseUser.uid}`);
    await signOut(auth);
    router.push("/login");
  };

  const canSwitchProperty = role === 'admin' || assignedEntityId === 'all';

  return (
    <div className="flex h-screen bg-[#F8F9FD] overflow-hidden relative">
      {/* Premium Welcome Overlay */}
      {showWelcome && (
        <div className={cn(
          "fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-[40px] transition-opacity duration-500",
          isExiting ? "opacity-0" : "opacity-100"
        )}>
          {/* Subtle diffused emerald glow - triggers only when audio starts */}
          <div className={cn(
            "absolute w-[500px] h-[500px] bg-emerald-500/20 blur-[120px] rounded-full transition-all duration-700",
            isGlowActive ? "opacity-100 scale-110" : "opacity-0 scale-90"
          )} />
          
          <div className={cn(
            "bg-white border border-white/40 p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-8 relative z-10 transition-all duration-500",
            !isAudioReady ? "scale-95 opacity-0" : "scale-100 opacity-100 animate-in zoom-in-95",
            isPulsing && "scale-[1.04]",
            isExiting && "scale-90 opacity-0"
          )}>
            <div className="bg-emerald-600 p-5 rounded-3xl shadow-2xl shadow-emerald-600/30">
              <Building2 className="w-12 h-12 text-white" />
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black text-emerald-600 uppercase tracking-[0.4em]">SUKHA OS</h2>
              <div className="h-0.5 w-16 bg-emerald-600/20 mx-auto" />
              <p className="text-2xl font-bold text-slate-800 tracking-tight leading-snug max-w-sm">
                {welcomeText}
              </p>
            </div>
          </div>
        </div>
      )}

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
                <Select value={entityId || ""} onValueChange={setEntityId} disabled={!canSwitchProperty && filteredProperties.length <= 1}>
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
            {role === 'owner' && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Property View Only</span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black uppercase leading-none text-slate-800">{userName || firebaseUser?.displayName}</p>
                    <p className="text-[9px] text-muted-foreground capitalize font-black mt-1 uppercase">
                      {role === 'admin' ? "Master Administrator" : role === 'owner' ? "Property Owner (View Only)" : role}
                    </p>
                  </div>
                  <Avatar className="h-10 w-10 ring-offset-2 ring-primary transition-all group-hover:ring-2 shadow-md">
                    <AvatarFallback className="bg-primary text-white text-xs font-black uppercase">
                      {userName?.charAt(0) || firebaseUser?.displayName?.charAt(0) || "U"}
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
                  <LogOut className="mr-3 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className={cn(
          "flex-1 overflow-y-auto p-8 transition-opacity duration-500",
          showWelcome ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}

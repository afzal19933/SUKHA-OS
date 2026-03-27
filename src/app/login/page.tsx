"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, User } from "lucide-react";

/**
 * LoginPage
 * Handles authentication and initial system provisioning.
 */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const getEmailFromUsername = (u: string) => {
    let clean = u.toLowerCase().trim();
    if (clean.includes('@')) return clean;
    // Normalize: remove all spaces for the internal email part
    clean = clean.replace(/\s+/g, '');
    return `${clean}@sukha.os`;
  };

  /**
   * Provision the Master Admin account if it doesn't exist.
   */
  const initializeDefaultAdmin = async (internalEmail: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
    const user = userCredential.user;

    await updateProfile(user, { 
      displayName: "Administrator" 
    });

    const hotelId = "property-001";

    // Create Master Admin Profile
    const userProfileRef = doc(db, "user_profiles", user.uid);
    await setDoc(userProfileRef, {
      id: user.uid,
      entityId: hotelId,
      name: "Administrator",
      email: internalEmail,
      isActive: true,
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: ["Dashboard", "AI Insights", "Reservations", "Rooms", "Inventory", "Housekeeping", "Maintenance", "Laundry", "Accounting", "Team", "Settings", "Attendance", "Communications"]
    });

    // Create Initial Property
    const propertyRef = doc(db, "hotel_properties", hotelId);
    await setDoc(propertyRef, {
      id: hotelId,
      entityId: hotelId,
      name: "Sukha Retreats",
      address: "Property Management Head Office",
      phone: "919895556667",
      email: internalEmail,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "System Initialized",
      description: "Master Administrator account created.",
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    const internalEmail = getEmailFromUsername(username);
    const normalizedUsername = username.toLowerCase().trim();

    console.log(`[Auth] Attempting login for: ${normalizedUsername} as ${internalEmail}`);

    try {
      await signInWithEmailAndPassword(auth, internalEmail, password);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Auth Error:", error.code, error.message);
      
      // Auto-Provisioning logic for first-time setup (normalized check)
      const isInitialAdmin = normalizedUsername === "admin" && password === "sukha123";
      const isNotFoundError = error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/invalid-login-credentials";

      if (isInitialAdmin && isNotFoundError) {
        try {
          await initializeDefaultAdmin(internalEmail);
          router.push("/dashboard");
        } catch (initError: any) {
          console.error("Init Error:", initError);
          toast({ variant: "destructive", title: "Init Failed", description: initError.message });
          setLoading(false);
        }
      } else {
        toast({ 
          variant: "destructive", 
          title: "Authentication Failed", 
          description: error.code === 'auth/network-request-failed' 
            ? "Network error. Check your connection." 
            : "The system did not recognize these credentials. Please check your username and password." 
        });
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F3F8] p-4">
      <Card className="w-full max-w-md shadow-2xl border-none rounded-[2rem] overflow-hidden">
        <CardHeader className="space-y-1 text-center bg-white pt-10">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-4 rounded-2xl shadow-xl shadow-primary/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter text-primary uppercase">SUKHA OS</CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Professional Property Management
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-6 bg-white">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Username</Label>
              <div className="relative">
                <Input
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-12 pl-11 rounded-2xl bg-secondary/50 border-none text-sm font-bold"
                />
                <User className="absolute left-4 top-3.5 w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Password</Label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 pl-11 rounded-2xl bg-secondary/50 border-none text-sm font-bold"
                />
                <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 bg-white pb-10">
            <Button type="submit" className="w-full h-14 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={loading}>
              {loading ? "Authorizing..." : "Login to SUKHA OS"}
            </Button>
            <p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-tighter px-4">
              Restricted Access. All transactions audited in real-time.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

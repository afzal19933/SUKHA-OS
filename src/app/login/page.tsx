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

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const getEmailFromUsername = (u: string) => {
    return `${u.toLowerCase().trim()}@sukha.os`;
  };

  const initializeDefaultAdmin = async (internalEmail: string) => {
    // 1. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
    const user = userCredential.user;

    await updateProfile(user, { 
      displayName: "Master Administrator" 
    });

    // 2. Setup ID/Property context
    const hotelId = crypto.randomUUID();

    // 3. Create User Profile
    const userProfileRef = doc(db, "user_profiles", user.uid);
    const userProfileData = {
      id: user.uid,
      entityId: hotelId,
      name: "Administrator",
      email: internalEmail,
      isActive: true,
      role: "admin", // STRICTLY ADMIN
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: ["Reservations", "Rooms", "Inventory", "Housekeeping", "Maintenance", "Laundry", "Accounting", "Team", "Settings"]
    };

    await setDoc(userProfileRef, userProfileData);

    // 4. Create Property
    const propertyRef = doc(db, "hotel_properties", hotelId);
    await setDoc(propertyRef, {
      id: hotelId,
      entityId: hotelId,
      name: "Sukha Retreats",
      address: "Administrator Main Office",
      phone: "9999999999",
      email: internalEmail,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "System Initialized",
      description: "Master Administrator account created with global access.",
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const internalEmail = getEmailFromUsername(username);

    try {
      await signInWithEmailAndPassword(auth, internalEmail, password);
      router.push("/dashboard");
    } catch (error: any) {
      if (username === "admin" && password === "sukha123" && (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential")) {
        try {
          await initializeDefaultAdmin(internalEmail);
          router.push("/dashboard");
          return;
        } catch (initError: any) {
          toast({ variant: "destructive", title: "Init Failed", description: initError.message });
        }
      } else {
        toast({ variant: "destructive", title: "Login Failed", description: "Invalid credentials." });
      }
    } finally {
      setLoading(false);
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
                  className="h-12 pl-11 rounded-2xl bg-secondary/50 border-none text-sm font-bold"
                />
                <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 bg-white pb-10">
            <Button type="submit" className="w-full h-14 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={loading}>
              {loading ? "Authenticating..." : "Authorize Access"}
            </Button>
            <p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-tighter px-4">
              Access restricted to authorized personnel. Data audited in real-time.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
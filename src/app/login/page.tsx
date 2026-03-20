"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, User } from "lucide-react";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

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
      displayName: "Administrator" 
    });

    // 2. Create a New Hotel Property
    const hotelId = crypto.randomUUID();
    const propertyRef = doc(db, "hotel_properties", hotelId);
    const propertyData = {
      id: hotelId,
      entityId: hotelId,
      name: "Sukha Retreats",
      address: "Property Address TBD",
      phone: "9999999999",
      email: internalEmail,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gstin: "TBD",
      pan: "TBD"
    };
    
    setDocumentNonBlocking(propertyRef, propertyData, { merge: true });

    // 3. Create User Profile
    const userProfileRef = doc(db, "user_profiles", user.uid);
    const userProfileData = {
      id: user.uid,
      entityId: hotelId,
      name: "Administrator",
      email: internalEmail,
      isActive: true,
      role: "admin", // Initial user is now admin (full access)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(userProfileRef, userProfileData, { merge: true });

    toast({
      title: "System Initialized",
      description: "Default admin account and property have been created.",
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
      // If default admin login fails (doesn't exist yet), try to initialize
      if (username === "admin" && password === "sukha123" && (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/invalid-login-credentials")) {
        try {
          await initializeDefaultAdmin(internalEmail);
          router.push("/dashboard");
          return;
        } catch (initError: any) {
          console.error("Initialization failed", initError);
        }
      }

      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid username or password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F3F8] p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-2xl">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">SUKHA OS</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your credentials to access the PMS
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
                <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-11 font-semibold text-lg" disabled={loading}>
              {loading ? "Processing..." : "Sign In"}
            </Button>
            <p className="text-xs text-center text-muted-foreground px-4">
              Access restricted to authorized personnel only. Contact your property manager for credentials.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

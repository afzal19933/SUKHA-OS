
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, Mail, User } from "lucide-react";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        // 1. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { 
          displayName: name || email.split('@')[0] 
        });

        // 2. Create a New Hotel Property (for the first owner)
        const hotelId = crypto.randomUUID();
        const propertyRef = doc(db, "hotel_properties", hotelId);
        const propertyData = {
          id: hotelId,
          entityId: hotelId,
          name: propertyName || "My New Hotel",
          address: "TBD",
          phone: "TBD",
          email: email,
          gstin: "TBD",
          pan: "TBD",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Using non-blocking to initiate the write
        setDocumentNonBlocking(propertyRef, propertyData, { merge: true });

        // 3. Create User Profile
        const userProfileRef = doc(db, "user_profiles", user.uid);
        const userProfileData = {
          id: user.uid,
          entityId: hotelId,
          name: name || email.split('@')[0],
          email: email,
          isActive: true,
          role: "owner", // First user is the owner
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setDocumentNonBlocking(userProfileRef, userProfileData, { merge: true });

        toast({
          title: "Account created",
          description: `Welcome to Sukha OS, ${name}! Your property "${propertyData.name}" has been initialized.`,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: isSignUp ? "Registration Failed" : "Login Failed",
        description: error.message || "An error occurred. Please try again.",
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
            {isSignUp ? "Create an account to manage your property" : "Enter your credentials to access the PMS"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-11 pl-10"
                      suppressHydrationWarning
                    />
                    <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyName">Hotel/Property Name</Label>
                  <div className="relative">
                    <Input
                      id="propertyName"
                      placeholder="Grand Sukha Resort"
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      required
                      className="h-11 pl-10"
                      suppressHydrationWarning
                    />
                    <Building2 className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@sukha.os"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 pl-10"
                  suppressHydrationWarning
                />
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
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
                  suppressHydrationWarning
                />
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-11 font-semibold text-lg" disabled={loading} suppressHydrationWarning>
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
            <div className="text-center">
              <Button 
                type="button" 
                variant="link" 
                className="text-sm"
                onClick={() => setIsSignUp(!isSignUp)}
                suppressHydrationWarning
              >
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

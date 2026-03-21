"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeGreetingProps {
  userName: string | null | undefined;
}

/**
 * WelcomeGreeting Component
 * Optimized for immediate appearance after login.
 * Shows UI instantly and layers voice as it becomes ready.
 */
export function WelcomeGreeting({ userName }: WelcomeGreetingProps) {
  const [visibility, setVisibility] = useState<'hidden' | 'active' | 'exiting'>('hidden');
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  
  // Requirement: Fallback to "User" if name is missing
  const safeName = userName?.trim() || "User";
  // Identity-specific session key to allow different users to be greeted in the same browser session
  const sessionKey = `greeted_${safeName.replace(/\s+/g, '_')}`;

  // Safeguard Refs
  const isActiveRef = useRef(true);
  const greetedThisInstanceRef = useRef<string | null>(null);
  const isExitingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  
  // Timeout Refs
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exitTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = () => {
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    if (exitTransitionTimeoutRef.current) clearTimeout(exitTransitionTimeoutRef.current);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const dismiss = () => {
    if (isExitingRef.current || !isActiveRef.current) return;
    isExitingRef.current = true;
    
    setVisibility('exiting');
    
    exitTransitionTimeoutRef.current = setTimeout(() => {
      if (isActiveRef.current) setVisibility('hidden');
    }, 300);
  };

  const fetchAndPlay = async (targetName: string) => {
    try {
      const response = await fetch(`/api/tts-greeting?userName=${encodeURIComponent(targetName)}`);
      if (!response.ok) throw new Error("Audio fetch failed");
      
      const blob = await response.blob();
      if (!isActiveRef.current || isExitingRef.current) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio();
      audioRef.current = audio;
      
      audio.oncanplaythrough = () => {
        if (!isActiveRef.current || isExitingRef.current) return;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently handle autoplay blocks
          });
        }
        setIsAudioStarted(true);
      };
      
      audio.onended = dismiss;
      audio.onerror = () => {
        // Fallback: If audio fails, the visual timer will handle dismissal
      };
      
      audio.src = url;
      audio.load();

    } catch (err) {
      // Fail silent on audio, let UI timer dismiss
    }
  };

  useEffect(() => {
    isActiveRef.current = true;

    // We wait for the userName to be synchronized from Firestore before showing the UI
    // to avoid "Welcome User" flickering before the real name appears.
    // Profile sync from Firestore usually takes < 200ms.
    if (userName === null || userName === undefined) {
      setVisibility('hidden');
      return;
    }

    // Identity & Session Check
    if (sessionStorage.getItem(sessionKey) || greetedThisInstanceRef.current === safeName) {
      return;
    }

    // Reset instance state for new identity
    isExitingRef.current = false;
    greetedThisInstanceRef.current = safeName;
    sessionStorage.setItem(sessionKey, "true");
    
    // Show UI instantly
    setVisibility('active');
    
    // Start audio layering
    fetchAndPlay(safeName);

    // Hard Max Duration (3.5s) to ensure the user isn't stuck if network is slow
    maxDurationTimeoutRef.current = setTimeout(dismiss, 3500);

    return () => {
      isActiveRef.current = false;
      cleanup();
    };
  }, [userName, sessionKey, safeName]);

  if (visibility === 'hidden') return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300",
        visibility === 'exiting' ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={cn(
          "bg-white/95 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/20 transition-all duration-300 transform",
          visibility === 'active' ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
            <span className="text-white font-black text-2xl">S</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tighter text-primary uppercase">
              Welcome {safeName}
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              SUKHA OS Operational Control
            </p>
          </div>
          
          {!isAudioStarted && (
            <div className="w-12 h-1 bg-primary/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-primary/40 animate-pulse w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

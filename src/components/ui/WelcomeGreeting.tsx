
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeGreetingProps {
  userName?: string | null;
}

/**
 * WelcomeGreeting Component
 * Production-grade voice greeting system with strict synchronization and safeguards.
 */
export function WelcomeGreeting({ userName }: WelcomeGreetingProps) {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'visible' | 'exiting'>('hidden');
  const nameToUse = userName || "User";
  
  // Safeguard Refs
  const hasGreetedRef = useRef(false);
  const gatekeeperTriggeredRef = useRef(false);
  const isActiveRef = useRef(true);
  const isExitingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  
  // Timer Refs
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isActiveRef.current = true;
    
    // Session Lock
    const sessionKey = `greeted_${nameToUse}`;
    if (sessionStorage.getItem(sessionKey) || hasGreetedRef.current) {
      return;
    }

    const initGreeting = async () => {
      setStatus('loading');
      
      try {
        const response = await fetch(`/api/tts-greeting?name=${encodeURIComponent(nameToUse)}`);
        
        // Handle API Failure Fallback
        if (!response.ok || response.status === 204) {
          triggerFallback();
          return;
        }
        
        const blob = await response.blob();
        if (!isActiveRef.current) return;
        
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        
        const audio = new Audio(url);
        audioRef.current = audio;
        
        const triggerGatekeeper = () => {
          if (gatekeeperTriggeredRef.current || !isActiveRef.current) return;
          gatekeeperTriggeredRef.current = true;
          
          if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
          
          // Slight delay for smoother animation transition
          setTimeout(() => {
            if (!isActiveRef.current) return;
            setStatus('visible');
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                // Silently handle autoplay restrictions
              });
            }
            
            // Set Max Duration Timeout (3 seconds)
            maxDurationTimerRef.current = setTimeout(dismiss, 3000);
          }, 100);
        };

        const dismiss = () => {
          if (isExitingRef.current || !isActiveRef.current) return;
          isExitingRef.current = true;
          
          if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
          
          setStatus('exiting');
          exitTimerRef.current = setTimeout(() => {
            if (isActiveRef.current) {
              setStatus('hidden');
              sessionStorage.setItem(sessionKey, 'true');
              hasGreetedRef.current = true;
            }
          }, 300);
        };

        // Audio Event Listeners
        audio.oncanplaythrough = triggerGatekeeper;
        audio.onended = dismiss;
        audio.onerror = () => {
          if (isActiveRef.current) triggerGatekeeper();
        };

        // Watchdog Fallback (1000ms)
        watchdogTimerRef.current = setTimeout(triggerGatekeeper, 1000);

      } catch (err) {
        triggerFallback();
      }
    };

    const triggerFallback = () => {
      if (!isActiveRef.current) return;
      setStatus('visible');
      maxDurationTimerRef.current = setTimeout(() => {
        setStatus('exiting');
        exitTimerRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            setStatus('hidden');
            sessionStorage.setItem(sessionKey, 'true');
            hasGreetedRef.current = true;
          }
        }, 300);
      }, 3000);
    };

    initGreeting();

    // Aggressive Cleanup (Mandatory)
    return () => {
      isActiveRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.oncanplaythrough = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = "";
      }
      
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [nameToUse]);

  if (status === 'hidden' || status === 'loading') return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[999] flex items-center justify-center transition-all duration-300",
      status === 'visible' ? "opacity-100 backdrop-blur-sm bg-black/10" : "opacity-0 backdrop-blur-0 bg-transparent pointer-events-none"
    )}>
      <div className={cn(
        "bg-white p-10 rounded-[3rem] shadow-2xl border-none transition-all duration-300 transform",
        status === 'visible' ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
      )}>
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em]">SUKHA OS</h2>
          <p className="text-2xl font-black text-slate-800 tracking-tight">Welcome {nameToUse}</p>
        </div>
      </div>
    </div>
  );
}

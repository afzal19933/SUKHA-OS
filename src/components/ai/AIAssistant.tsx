
"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  X, 
  Bot, 
  MessageSquare,
  Loader2,
  Volume2,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { askAssistant, type AIAssistantOutput } from "@/ai/flows/ai-assistant-flow";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

/**
 * AIAssistant Component
 * Provides global voice and text control via Gemini AI.
 */
export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your SUKHA Concierge. How can I assist you today? Try saying 'Show me dirty rooms' or 'Go to laundry'." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        handleSend(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({ variant: "destructive", title: "Voice Recognition Error", description: "Could not access microphone." });
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setQuery("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSend = async (text: string = query) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setQuery("");
    setIsLoading(true);

    try {
      const response = await askAssistant({ 
        query: userMessage, 
        currentPath: pathname 
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);

      // Process AI Actions
      if (response.action) {
        if (response.action.type === 'navigate' && response.action.payload) {
          router.push(response.action.payload);
          toast({ title: "Navigating...", description: `Moving to ${response.action.payload}` });
        }
      }
    } catch (error) {
      toast({ variant: "destructive", title: "AI Assistant Error", description: "Could not reach the AI brain." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] no-print">
      {isOpen ? (
        <Card className="w-80 sm:w-96 h-[500px] shadow-2xl border-primary/20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="bg-primary text-white p-4 shrink-0">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 fill-white" />
                SUKHA CONCIERGE
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col bg-slate-50">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-3 rounded-2xl text-xs font-medium leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-primary text-white rounded-tr-none shadow-md" 
                        : "bg-white text-slate-800 border rounded-tl-none shadow-sm"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 items-center text-muted-foreground italic text-[10px] animate-pulse">
                    <Bot className="w-3 h-3" />
                    Assistant is thinking...
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 bg-white border-t space-y-3">
              <div className="flex gap-2">
                <Button 
                  variant={isListening ? "destructive" : "secondary"} 
                  size="icon" 
                  className={cn("shrink-0 h-10 w-10 rounded-full", isListening && "animate-pulse")}
                  onClick={toggleListening}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <div className="relative flex-1">
                  <Input 
                    placeholder={isListening ? "Listening..." : "Type a command..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="pr-10 h-10 text-xs rounded-full border-primary/20 focus-visible:ring-primary shadow-inner"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-1 top-1 h-8 w-8 text-primary"
                    onClick={() => handleSend()}
                    disabled={!query.trim() || isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['Go to Accounting', 'Room Status', 'Check Arrivals'].map((tip) => (
                  <Button 
                    key={tip} 
                    variant="outline" 
                    className="h-6 text-[9px] px-2 rounded-full whitespace-nowrap bg-slate-50 hover:bg-primary/5 hover:text-primary transition-colors"
                    onClick={() => handleSend(tip)}
                  >
                    {tip}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-2xl animate-bounce hover:scale-110 transition-transform bg-primary"
          onClick={() => setIsOpen(true)}
        >
          <Sparkles className="w-6 h-6 fill-white" />
        </Button>
      )}
    </div>
  );
}

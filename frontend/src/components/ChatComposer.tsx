"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Send, 
  Sparkles, 
  Users, 
  FileText, 
  Check, 
  RefreshCw,
  Bot,
  Layers,
  PhoneCall,
  MessageSquare,
  Mail,
  AlertCircle
} from "lucide-react";

interface SegmentData {
  name: string;
  filter_json: any;
  customer_count: number;
}

interface ChannelData {
  name: "whatsapp" | "sms" | "email";
  reason: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  segment?: SegmentData | null;
  messages?: string[] | null;
  channel?: ChannelData | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ChatComposer({ 
  prefillPrompt,
  isDrawer = false
}: { 
  prefillPrompt?: string | null;
  isDrawer?: boolean;
}) {
  const router = useRouter();
  const prefillExecutedRef = useRef(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your Maeven CRM Assistant. Describe what target segment you'd like to build or what campaign templates you'd like to compose (e.g. 'find active customers in Mumbai who spent over 400 and draft a promo')."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Prefill prompt handler for AI Optimization suggestions
  useEffect(() => {
    if (prefillPrompt && !prefillExecutedRef.current) {
      prefillExecutedRef.current = true;
      
      const sendPrefilledPrompt = async () => {
        setIsLoading(true);
        // Append user prompt message to list
        setMessages((prev) => [...prev, { role: "user", content: prefillPrompt }]);
        
        try {
          const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: prefillPrompt,
              chat_history: []
            })
          });

          if (!response.ok) {
            throw new Error("Failed to process recommendation optimization.");
          }

          const data = await response.json();
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: data.reply,
            segment: data.segment,
            messages: data.messages,
            channel: data.channel
          }]);
        } catch (err) {
          console.error("Error executing prefilled recommendation:", err);
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "Sorry, I encountered an error while trying to process the optimization request automatically. Please try typing it manually."
          }]);
        } finally {
          setIsLoading(false);
        }
      };
      sendPrefilledPrompt();
    }
  }, [prefillPrompt]);
  
  // Track selected template draft variation index for each assistant message in chat history
  const [selectedTemplates, setSelectedTemplates] = useState<Record<number, string>>({});
  // Track executing campaign message index
  const [firingCampaignIndex, setFiringCampaignIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Build conversation history matching FastAPI model expectations
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          chat_history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error("Chat assistant backend error");
      }

      const data = await response.json();
      const newIndex = messages.length + 1; // index in the updated state list

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply,
        segment: data.segment,
        messages: data.messages,
        channel: data.channel
      }]);

      // Default to selecting the first message template if drafts are present
      if (data.messages && data.messages.length > 0) {
        setSelectedTemplates(prev => ({
          ...prev,
          [newIndex]: data.messages[0]
        }));
      }

    } catch (error) {
      console.error("Chat dispatch error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm sorry, I encountered a connection issue with the processing backend. Please verify that the FastAPI server is running."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (msgIndex: number, text: string) => {
    setSelectedTemplates(prev => ({
      ...prev,
      [msgIndex]: text
    }));
  };

  const handleExecuteCampaign = async (
    msgIndex: number,
    segment: SegmentData,
    channel: ChannelData,
    templateText: string
  ) => {
    setFiringCampaignIndex(msgIndex);
    
    try {
      // 1. Create and Save the Dynamic Segment
      const segmentRes = await fetch(`${BACKEND_URL}/api/segments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: segment.name,
          description: `AI Chat generated segment: "${segment.name}"`,
          filter_json: segment.filter_json
        })
      });

      if (!segmentRes.ok) {
        throw new Error("Failed to create database segment from AI criteria");
      }
      const savedSegment = await segmentRes.json();

      // 2. Create and Save the Campaign Draft
      const campaignName = `Campaign - ${segment.name}`;
      const campaignRes = await fetch(`${BACKEND_URL}/api/campaigns/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          segment_id: savedSegment.id,
          channel: channel.name,
          message_template: templateText,
          goal: "AI Chat Assistant Trigger"
        })
      });

      if (!campaignRes.ok) {
        throw new Error("Failed to save campaign draft in database");
      }
      const savedCampaign = await campaignRes.json();

      // 3. Fire / Dispatch the campaign execution immediately
      const executionRes = await fetch(`${BACKEND_URL}/api/campaigns/${savedCampaign.id}/send`, {
        method: "POST"
      });

      if (!executionRes.ok) {
        throw new Error("Failed to dispatch campaign execution to channel stub");
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Successfully saved segment & initiated campaign **"${campaignName}"** via ${channel.name.toUpperCase()}! Redirecting you to the live Recharts tracker...`
      }]);

      // 4. Redirect to details tracking page
      setTimeout(() => {
        router.push(`/campaigns/${savedCampaign.id}`);
      }, 1800);

    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred during campaign execution");
      setFiringCampaignIndex(null);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden ${
      isDrawer 
        ? "flex-1 h-full bg-[#121212]" 
        : "h-[calc(100vh-140px)] border border-border bg-[#121212] rounded-xl shadow-2xl"
    }`}>
      {/* Messages Feed */}
      <div className={`flex-1 overflow-y-auto space-y-6 bg-[#0B0B0D] ${isDrawer ? "p-4" : "p-6"}`}>
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl flex flex-col gap-3 ${isUser ? "items-end" : "items-start"}`}>
                
                {/* Text Bubble */}
                <div 
                  className={
                    isUser 
                      ? "px-5 py-3.5 rounded-2xl rounded-br-sm border border-[#C9A96E]/20 bg-gradient-to-br from-[#C9A96E]/15 to-[#C9A96E]/5 backdrop-blur-md text-[#EAE0C8] font-light tracking-wide leading-relaxed text-sm shadow-lg shadow-black/40"
                      : "px-5 py-3.5 rounded-2xl rounded-tl-sm border border-white/5 bg-[#1A1A1A] text-gray-300 font-light leading-relaxed text-sm shadow-md shadow-black/20"
                  }
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>

                {/* Structured Data rendering for Assistant replies */}
                {!isUser && (
                  <div className="space-y-4 w-full">
                    {/* Target Audience Card */}
                    {msg.segment && (
                      <div className="premium-card bg-[#161616] border border-border/80 w-full max-w-md rounded-xl p-4.5 space-y-3 shadow-lg">
                        <div className="flex justify-between items-center border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="font-serif font-bold text-sm text-[#DFD9CE]">Target Audience</span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {msg.segment.customer_count} Customers
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-primary">{msg.segment.name}</h4>
                          <pre className="text-[10.5px] font-mono text-[#DCD6C7] bg-[#0C0C0C] border border-border/60 p-2.5 rounded-lg overflow-x-auto leading-relaxed">
                            {JSON.stringify(msg.segment.filter_json, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Suggested Copy Card */}
                    {msg.messages && msg.messages.length > 0 && (
                      <div className="premium-card bg-[#161616] border border-border/80 w-full max-w-lg rounded-xl p-4.5 space-y-3.5 shadow-lg">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-serif font-bold text-sm text-[#DFD9CE]">Suggested Copy</span>
                        </div>
                        
                        <div className="space-y-2.5">
                          {msg.messages.map((draft, idx) => {
                            const isSelected = selectedTemplates[index] === draft;
                            return (
                              <div 
                                key={idx}
                                onClick={() => handleSelectTemplate(index, draft)}
                                className={`p-3 rounded-lg border text-xs leading-relaxed transition-all cursor-pointer relative ${
                                  isSelected 
                                    ? "border-primary bg-primary/5 text-foreground" 
                                    : "border-border/60 bg-[#0F0F0F] text-muted hover:border-border hover:text-foreground"
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Variation {idx+1}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                </div>
                                <p className="whitespace-pre-wrap">{draft}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Channel Recommendation & Execution button */}
                    {msg.channel && msg.segment && msg.messages && (
                      <div className="w-full max-w-md space-y-2">
                        <button
                          onClick={() => handleExecuteCampaign(
                            index, 
                            msg.segment!, 
                            msg.channel!, 
                            selectedTemplates[index] || msg.messages![0]
                          )}
                          disabled={firingCampaignIndex === index}
                          className="premium-button-primary w-full py-3 flex items-center justify-center gap-2.5 font-bold uppercase tracking-wider text-xs shadow-lg transition-transform duration-200 hover:scale-[1.01]"
                        >
                          {firingCampaignIndex === index ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-background" />
                              <span>Executing Campaign...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Execute Campaign via {msg.channel.name}</span>
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-muted/65 italic px-1 leading-normal">
                          <strong>Recommendation:</strong> {msg.channel.reason}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {/* Pulsing loading state */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1A1A1A] border border-border px-4 py-3.5 rounded-xl text-sm text-muted flex items-center gap-3 shadow-md">
              <Bot className="w-5 h-5 text-primary animate-pulse" />
              <span className="font-semibold text-xs tracking-wider uppercase text-[#DFD9CE]">Maeven AI is composing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-border bg-[#121212]">
        <div className="flex gap-3 max-w-4xl mx-auto items-center">
          <input
            type="text"
            disabled={isLoading || firingCampaignIndex !== null}
            placeholder="E.g., Find customers in Mumbai who spent over 400 and draft a promo..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="rounded-full bg-[#141414] border border-white/10 px-6 py-4 flex-1 text-foreground placeholder:text-muted focus:outline-none focus:border-[#C9A96E]/50 transition-colors text-sm disabled:opacity-50"
          />
          <button 
            onClick={handleSendMessage}
            disabled={isLoading || firingCampaignIndex !== null || !inputValue.trim()}
            className="bg-[#C9A96E] text-black rounded-full px-6 py-4 hover:bg-[#b5955b] transition-all duration-300 shadow-[0_0_15px_rgba(201,169,110,0.2)] flex items-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatComposer from "@/components/ChatComposer";
import { supabase } from "@/lib/supabase";
import { TrendingUp } from "lucide-react";

interface CampaignStat {
  campaign_id: string;
  total_sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read_count: number;
  clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const prefillPrompt = searchParams.get("prompt");

  const [lastCampaignName, setLastCampaignName] = useState<string>("No active campaigns");
  const [stats, setStats] = useState<CampaignStat>({
    campaign_id: "",
    total_sent: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    read_count: 0,
    clicked: 0,
    delivery_rate: 0.00,
    open_rate: 0.00,
    click_rate: 0.00
  });

  // Fetch latest executed campaign stats
  useEffect(() => {
    async function fetchLatestCampaignStats() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/campaigns/`);
        if (!response.ok) return;
        const campaigns = await response.json();
        
        // Find latest executed/completed/processing campaign
        const activeCampaign = campaigns.find((c: any) => c.status !== "draft");
        if (activeCampaign) {
          setLastCampaignName(activeCampaign.name);
          const statsResponse = await fetch(`${BACKEND_URL}/api/campaigns/${activeCampaign.id}/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData);
          }
        }
      } catch (err) {
        console.error("Failed to load initial campaign stats:", err);
      }
    }
    fetchLatestCampaignStats();
  }, []);

  // Realtime campaign stats listener
  useEffect(() => {
    const channel = supabase
      .channel("live-chat-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_stats" },
        async (payload: any) => {
          console.log("Realtime campaign_stats update received in Chat Dashboard:", payload);
          const newStats = payload.new as CampaignStat;
          
          if (newStats) {
            setStats(newStats);
            try {
              const res = await fetch(`${BACKEND_URL}/api/campaigns/${newStats.campaign_id}`);
              if (res.ok) {
                const campaign = await res.json();
                setLastCampaignName(campaign.name);
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl w-full mx-auto flex flex-col h-full">
      {/* Header and Live stats inline bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
            Maeven AI Chat Composer
          </h1>
          <p className="text-sm text-muted">
            Converse with Maeven AI to compile segments, draft layouts, and execute campaigns.
          </p>
        </div>

        {/* Live campaign stats card */}
        <div className="bg-[#1A1A1A] border border-border p-4 rounded-xl flex items-center gap-6 shadow-md max-w-md w-full">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 animate-pulse text-primary" />
              <span>Live Campaign Stats</span>
            </span>
            <p className="text-xs font-serif font-bold text-foreground truncate">
              {lastCampaignName}
            </p>
          </div>
          
          <div className="flex gap-4 border-l border-border/60 pl-5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-muted font-bold uppercase">Deliv.</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {stats.delivery_rate.toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-muted font-bold uppercase">Open</span>
              <span className="text-xs font-bold font-mono text-indigo-400">
                {stats.open_rate.toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-muted font-bold uppercase">CTR</span>
              <span className="text-xs font-bold font-mono text-pink-400">
                {stats.click_rate.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Composer Area */}
      <div className="flex-1 min-h-0">
        <ChatComposer prefillPrompt={prefillPrompt} />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full py-24 text-muted">
        <span>Loading AI Chat Composer...</span>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}

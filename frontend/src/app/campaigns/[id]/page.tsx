"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { 
  Megaphone, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  BookOpen, 
  MousePointerClick,
  TrendingUp,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Award
} from "lucide-react";

const CampaignFunnelChart = dynamic(
  () => import("@/components/CampaignChart").then((mod) => mod.CampaignFunnelChart),
  { ssr: false, loading: () => <div className="h-80 bg-[#121212] animate-pulse rounded-lg" /> }
);

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  message_template: string;
  total_recipients: number;
  sent_at: string;
  completed_at: string;
}

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
  updated_at: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function CampaignDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStat | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [debriefGenerated, setDebriefGenerated] = useState(false);
  const [debriefContent, setDebriefContent] = useState<string>("");
  const [generatingDebrief, setGeneratingDebrief] = useState(false);

  // 1. Fetch Campaign and stats initial data
  async function fetchCampaignData() {
    try {
      const campRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}`);
      if (!campRes.ok) throw new Error("Campaign not found");
      const campData = await campRes.json();
      setCampaign(campData);

      const statsRes = await fetch(`${BACKEND_URL}/api/campaigns/${id}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaignData();
  }, [id]);

  // 2. Subscribe to Supabase Realtime channel for live updates on this specific campaign_id
  useEffect(() => {
    if (!id) return;

    console.log(`Subscribing to Realtime changes for campaign: ${id}`);
    const channel = supabase
      .channel(`live-campaign-stats-${id}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "campaign_stats",
          filter: `campaign_id=eq.${id}`
        },
        (payload: any) => {
          console.log("Realtime payload received for campaign stats:", payload);
          setStats(payload.new as CampaignStat);
        }
      )
      .subscribe((status) => {
        console.log(`Realtime channel status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // 3. Generate AI debrief reports based on real statistics
  useEffect(() => {
    if (stats && campaign && stats.total_sent > 0 && !debriefGenerated && !generatingDebrief) {
      generateAIDebrief();
    }
  }, [stats, campaign]);

  const generateAIDebrief = async () => {
    if (!stats || !campaign) return;
    setGeneratingDebrief(true);
    
    try {
      // Prompt Grok for debrief if key is active, or generate high-fidelity report locally
      const promptMessage = `Draft a post-campaign marketing executive debrief for the campaign "${campaign.name}" with these metrics: Sent: ${stats.total_sent}, Delivered: ${stats.delivered}, Failed: ${stats.failed}, Opened: ${stats.opened}, Read: ${stats.read_count}, Clicked: ${stats.clicked}. Delivery Rate: ${stats.delivery_rate}%, Open Rate: ${stats.open_rate}%, Click Rate: ${stats.click_rate}%. Focus on the jewelry retail context and explain copywriting success or segment responsiveness.`;

      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptMessage })
      });
      
      if (response.ok) {
        const res = await response.json();
        setDebriefContent(res.reply);
      } else {
        setDebriefContent(getLocalDebriefReport(stats, campaign));
      }
    } catch (err) {
      console.error(err);
      setDebriefContent(getLocalDebriefReport(stats, campaign));
    } finally {
      setDebriefGenerated(true);
      setGeneratingDebrief(false);
    }
  };

  const getLocalDebriefReport = (s: CampaignStat, c: Campaign) => {
    const isHighClick = s.click_rate >= 15;
    const isHighOpen = s.open_rate >= 50;
    
    return `### Executive Performance Summary
The campaign **"${c.name}"** was dispatched to a target audience size of **${s.total_sent} recipients** via **${c.channel.toUpperCase()}**.
Overall execution finished with a **delivery rate of ${s.delivery_rate}%** (${s.delivered} messages delivered successfully, ${s.failed} failures).

### Audience Engagement Analysis
- **Open Rate Response**: At **${s.open_rate}%** (${s.opened} opens), the audience segment demonstrated ${isHighOpen ? "strong receptiveness" : "moderate curiosity"}. The message subject lines aligned effectively with customer interests.
- **Conversion Conversion**: We recorded **${s.clicked} link clicks**, compiling a **click-through rate of ${s.click_rate}%** relative to sent. ${isHighClick ? "This represents an outstanding conversion, indicating the custom jewelry offers (free shipping or bundles) hit target purchase intent." : "This indicates a conversion gap; future copies should simplify links and add clear call-to-actions (e.g. code STACK10)."}

### AI Optimisation Recommendation
For our next deployment, we suggest segmenting customers who *opened* but did *not click* and triggering a secondary SMS nudge with a limited-time coupon countdown clock.`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
        <span>Loading campaign detail dashboard...</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4 max-w-lg mx-auto text-center py-24">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-serif font-bold text-foreground">Campaign Dashboard Error</h2>
        <p className="text-sm text-muted">The requested campaign record could not be found in the database.</p>
        <button onClick={() => router.push("/campaigns")} className="premium-button-primary mt-4">
          Return to Registry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl w-full mx-auto">
      {/* Breadcrumb Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-5">
        <div className="space-y-1">
          <button 
            onClick={() => router.push("/campaigns")}
            className="text-xs text-muted hover:text-primary flex items-center gap-1 mb-2 font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Campaign Registry</span>
          </button>
          
          <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
            {campaign.name}
          </h1>
          <div className="flex items-center gap-3.5 text-xs text-muted">
            <span>ID: <code className="font-mono text-primary/80">{campaign.id}</code></span>
            <span>•</span>
            <span className="uppercase font-bold text-primary">{campaign.channel}</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-[4px] uppercase text-[9px] font-bold tracking-wider ${
              campaign.status === "completed" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : campaign.status === "processing"
                ? "bg-[#bf76e9]/10 text-[#dbb8ef] border border-[#8143a5]/20"
                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
            }`}>
              {campaign.status}
            </span>
          </div>
        </div>

        {/* Action Trigger */}
        {campaign.status === "draft" && (
          <button
            onClick={async () => {
              setLoading(true);
              await fetch(`${BACKEND_URL}/api/campaigns/${id}/send`, { method: "POST" });
              await fetchCampaignData();
            }}
            className="premium-button-primary"
          >
            <Send className="w-4 h-4" />
            <span>Execute Campaign</span>
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns: Live stats counters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card bg-[#121212] flex flex-col gap-6">
            <div className="flex justify-between items-center pb-2 border-b border-border/80">
              <h2 className="text-lg font-serif font-semibold text-foreground">
                Transmission Statistics
              </h2>
              {campaign.status === "processing" && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#c5a059] animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#c5a059]" />
                  <span>Real-time updating via Supabase</span>
                </div>
              )}
            </div>

            {/* Counters grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Total Sent", val: stats?.total_sent || 0, icon: Send, color: "text-blue-400" },
                { label: "Delivered", val: stats?.delivered || 0, icon: CheckCircle2, color: "text-emerald-400" },
                { label: "Failed", val: stats?.failed || 0, icon: AlertTriangle, color: "text-amber-500" },
                { label: "Opened", val: stats?.opened || 0, icon: Eye, color: "text-indigo-400" },
                { label: "Read Count", val: stats?.read_count || 0, icon: BookOpen, color: "text-purple-400" },
                { label: "Clicked", val: stats?.clicked || 0, icon: MousePointerClick, color: "text-pink-400" }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="bg-[#181818] border border-border/80 p-4 rounded-xl flex flex-col gap-1.5 relative overflow-hidden">
                    <Icon className={`absolute right-3.5 top-3.5 w-4 h-4 ${item.color} opacity-40`} />
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{item.label}</span>
                    <span className="text-2xl font-bold font-mono text-foreground mt-1">
                      {item.val}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Conversion Funnel Chart */}
            {stats && stats.total_sent > 0 && (
              <div className="pt-4 border-t border-border/50 space-y-3">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Audience Engagement Funnel
                </h3>
                <CampaignFunnelChart stats={stats} />
              </div>
            )}

            {/* Conversion bars */}
            {stats && stats.total_sent > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/50">
                {[
                  { label: "Delivery Success Rate", pct: stats.delivery_rate, color: "bg-emerald-500", desc: "Delivered vs Total Sent" },
                  { label: "Open Response Rate", pct: stats.open_rate, color: "bg-indigo-500", desc: "Opened vs Total Sent" },
                  { label: "Click-Through Rate (CTR)", pct: stats.click_rate, color: "bg-pink-500", desc: "Clicked vs Total Sent" }
                ].map((bar) => (
                  <div key={bar.label} className="space-y-2">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-muted">{bar.label}</span>
                      <span className="font-mono font-bold text-foreground text-sm">{bar.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1A1A1A] border border-border rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color} transition-all duration-500`} style={{ width: `${bar.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 block">{bar.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Template Content View */}
          <div className="premium-card flex flex-col gap-4">
            <h2 className="text-base font-serif font-semibold text-foreground border-b border-border pb-2">
              Message Template Copy
            </h2>
            <pre className="text-xs bg-[#131313] border border-border p-4 rounded-lg text-[#DCD6C7] font-mono leading-relaxed whitespace-pre-wrap">
              {campaign.message_template}
            </pre>
          </div>
        </div>

        {/* Right Column: AI Post Campaign Debrief */}
        <div className="space-y-6">
          <div className="premium-card bg-[#1C1A17] border-primary/20 flex flex-col gap-6 relative overflow-hidden">
            {/* background aura */}
            <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-lg font-serif font-semibold gold-gradient-text">
                AI Campaign Debrief
              </h2>
            </div>

            {generatingDebrief ? (
              <div className="py-12 text-center text-muted text-xs space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <span>Maeven AI is reviewing statistics...</span>
              </div>
            ) : debriefContent ? (
              <div className="prose prose-invert prose-xs text-xs text-muted leading-relaxed space-y-4">
                <div className="whitespace-pre-line text-[#DFD9CE]">{debriefContent}</div>
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-12">
                Launch execution to generate the analytical post-campaign executive report.
              </p>
            )}

            {debriefGenerated && (
              <div className="flex gap-2 items-center justify-center p-3 bg-primary/5 border border-primary/15 text-primary rounded-lg text-xs font-semibold mt-2">
                <Award className="w-4 h-4 text-primary" />
                <span>Verified Optimization Targets</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

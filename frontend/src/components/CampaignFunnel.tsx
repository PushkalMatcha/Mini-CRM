"use client";

import React, { useEffect, useState } from "react";
import { 
  ChevronDown, 
  RefreshCw, 
  Send, 
  CheckCircle, 
  Eye, 
  MousePointerClick, 
  IndianRupee, 
  TrendingUp, 
  AlertCircle,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  goal?: string;
}

interface FunnelStats {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  attributed_revenue: number;
  estimated_orders: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// High-fidelity historical campaigns for rich initial state / default preview
const HISTORICAL_CAMPAIGNS = [
  {
    id: "hist-1",
    name: "[Historical] Minimalist Chic Promo",
    channel: "whatsapp",
    status: "completed",
    goal: "Boost collection orders in Mumbai",
    stats: {
      total_sent: 1250,
      delivered: 1180,
      opened: 980,
      clicked: 350,
      delivery_rate: 94.4,
      open_rate: 83.1,
      click_rate: 29.7,
      attributed_revenue: 297500.00,
      estimated_orders: 52
    }
  },
  {
    id: "hist-2",
    name: "[Historical] Oxidised Heritage Winback",
    channel: "sms",
    status: "completed",
    goal: "Winback dormant segments in South India",
    stats: {
      total_sent: 2450,
      delivered: 2380,
      opened: 1150,
      clicked: 180,
      delivery_rate: 97.1,
      open_rate: 48.3,
      click_rate: 7.6,
      attributed_revenue: 153000.00,
      estimated_orders: 27
    }
  },
  {
    id: "hist-3",
    name: "[Historical] Anniversary VIP Gift",
    channel: "email",
    status: "completed",
    goal: "Drive high average order values",
    stats: {
      total_sent: 850,
      delivered: 840,
      opened: 580,
      clicked: 210,
      delivery_rate: 98.8,
      open_rate: 69.0,
      click_rate: 25.0,
      attributed_revenue: 236250.00,
      estimated_orders: 35
    }
  }
];

export default function CampaignFunnel() {
  const { session } = useAuth();
  const [dbCampaigns, setDbCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("hist-1");
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch campaigns from database
  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/campaigns/`);
      if (!response.ok) throw new Error("Failed to fetch campaigns.");
      const data: Campaign[] = await response.json();
      
      // Filter campaigns that have actually run or are currently processing
      const activeCampaigns = data.filter(c => 
        c.status === "completed" || c.status === "processing" || c.status === "sent"
      );
      setDbCampaigns(activeCampaigns);
    } catch (err) {
      console.error("Could not fetch campaigns from DB, using historical only:", err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Fetch stats for the selected campaign
  useEffect(() => {
    const fetchStats = async () => {
      // Check if it's a historical campaign
      const historical = HISTORICAL_CAMPAIGNS.find(c => c.id === selectedId);
      if (historical) {
        setFunnelStats(historical.stats);
        setErrorMsg(null);
        return;
      }

      // If it's a DB campaign, fetch stats from the API
      setLoading(true);
      setErrorMsg(null);
      try {
        const response = await fetch(`${BACKEND_URL}/api/campaigns/${selectedId}/stats`);
        if (!response.ok) throw new Error("Failed to fetch campaign stats.");
        const data = await response.json();
        
        // Calculate dynamic attributed revenue
        // Assuming a conversion rate of 15% from clicks to orders, with an average ticket price of INR 6,500
        const clickedCount = data.clicked || 0;
        const estOrders = Math.round(clickedCount * 0.15);
        const estRev = estOrders * 6500;

        setFunnelStats({
          total_sent: data.total_sent,
          delivered: data.delivered,
          opened: data.opened,
          clicked: data.clicked,
          delivery_rate: parseFloat(data.delivery_rate || 0),
          open_rate: parseFloat(data.open_rate || 0),
          click_rate: parseFloat(data.click_rate || 0),
          attributed_revenue: estRev,
          estimated_orders: estOrders
        });
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Failed to load real-time campaign stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedId]);

  // Combine lists for the dropdown
  const allDropdownOptions = [
    ...HISTORICAL_CAMPAIGNS.map(c => ({ id: c.id, name: c.name, isDb: false })),
    ...dbCampaigns.map(c => ({ id: c.id, name: c.name, isDb: true }))
  ];

  const currentCampaignName = allDropdownOptions.find(o => o.id === selectedId)?.name || "Select Campaign";
  const currentCampaignChannel = [
    ...HISTORICAL_CAMPAIGNS,
    ...dbCampaigns
  ].find(c => c.id === selectedId)?.channel || "whatsapp";

  const getChannelBadgeColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "whatsapp":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "sms":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "email":
      default:
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Funnel header with Select Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-serif font-semibold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span>Campaign Performance Funnel</span>
          </h2>
          <p className="text-xs text-muted">Analyze drop-off and marketing conversion funnels</p>
        </div>

        <div className="relative inline-block text-left">
          <div className="flex items-center gap-3">
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="appearance-none bg-[#1A1A1A] border border-border/80 px-4 py-2 pr-10 rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:border-primary/60 cursor-pointer shadow-md hover:bg-[#222] transition-colors"
              >
                {allDropdownOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} {opt.isDb ? "• Live" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-3.5 w-3.5 h-3.5 text-muted pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {funnelStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left: Tapered Visual Funnel */}
          <div className="lg:col-span-2 flex flex-col gap-4 justify-center">
            
            {/* Funnel Step 1: Sent (100%) */}
            <div className="relative w-full mx-auto" style={{ maxWidth: "100%" }}>
              <div className="premium-card flex items-center justify-between py-3 px-5 border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-card shadow-sm hover:translate-x-1 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Dispatched</h4>
                    <span className="text-[10px] text-muted uppercase tracking-wider">Campaign Sent</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-foreground">{funnelStats.total_sent.toLocaleString()}</span>
                  <p className="text-[10px] text-muted">100% Target</p>
                </div>
              </div>
            </div>

            {/* Funnel Step 2: Delivered (Delivery Rate) */}
            <div className="relative w-full mx-auto" style={{ maxWidth: "92%" }}>
              <div className="premium-card flex items-center justify-between py-3 px-5 border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-card shadow-sm hover:translate-x-1 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Delivered</h4>
                    <span className="text-[10px] text-muted uppercase tracking-wider">Received on Device</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-foreground">{funnelStats.delivered.toLocaleString()}</span>
                  <p className="text-[10px] text-emerald-400 font-semibold">{funnelStats.delivery_rate}% Delivery</p>
                </div>
              </div>
            </div>

            {/* Funnel Step 3: Opened (Open Rate) */}
            <div className="relative w-full mx-auto" style={{ maxWidth: "84%" }}>
              <div className="premium-card flex items-center justify-between py-3 px-5 border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-card shadow-sm hover:translate-x-1 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Opened</h4>
                    <span className="text-[10px] text-muted uppercase tracking-wider">Interactions Viewed</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-foreground">{funnelStats.opened.toLocaleString()}</span>
                  <p className="text-[10px] text-amber-400 font-semibold">{funnelStats.open_rate}% Open Rate</p>
                </div>
              </div>
            </div>

            {/* Funnel Step 4: Clicked (Click Rate) */}
            <div className="relative w-full mx-auto" style={{ maxWidth: "76%" }}>
              <div className="premium-card flex items-center justify-between py-3 px-5 border-primary/20 bg-gradient-to-r from-primary/10 to-card shadow-sm hover:translate-x-1 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/5 rounded-lg border border-primary/25 text-primary">
                    <MousePointerClick className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Clicked</h4>
                    <span className="text-[10px] text-muted uppercase tracking-wider">CTA Links Engaged</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-primary">{funnelStats.clicked.toLocaleString()}</span>
                  <p className="text-[10px] text-primary font-semibold">{funnelStats.click_rate}% Click CTR</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right: Attributed Revenue & Value Cards */}
          <div className="flex flex-col gap-4 justify-between">
            {/* Revenue card */}
            <div className="premium-card bg-gradient-to-b from-[#181512] to-card border-primary/10 flex flex-col justify-center p-6 flex-1 gap-3">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span>Attributed Revenue</span>
              </span>
              <div className="space-y-1">
                <h3 className="text-3xl font-serif font-bold text-primary tracking-wide">
                  ₹{funnelStats.attributed_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Generated from direct CTA conversions.
                </p>
              </div>
            </div>

            {/* Conversion Details card */}
            <div className="premium-card bg-[#0D0D11] border-border/80 p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted font-medium">Channel</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${getChannelBadgeColor(currentCampaignChannel)}`}>
                  {currentCampaignChannel}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted font-medium">Conversions</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-muted" />
                  {funnelStats.estimated_orders} Orders
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted font-medium">Avg. Ticket Value</span>
                <span className="font-semibold text-foreground font-mono">
                  ₹{(funnelStats.estimated_orders > 0 
                    ? Math.round(funnelStats.attributed_revenue / funnelStats.estimated_orders) 
                    : 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="h-60 flex flex-col items-center justify-center text-muted gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-muted/40" />
          <span className="text-sm">Initializing funnel metrics...</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { 
  Megaphone, 
  Send, 
  RefreshCw, 
  Mail, 
  MessageSquare, 
  PhoneCall, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  BookOpen,
  MousePointerClick
} from "lucide-react";

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [campaignName, setCampaignName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("email");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [monitoredCampaignId, setMonitoredCampaignId] = useState<string | null>(null);

  // Mock campaigns list for Phase 1 skeleton
  const mockCampaigns = [
    {
      id: "camp-1",
      name: "Maeven Summer Winback Launch",
      segment_name: "At-Risk Gold Shoppers",
      channel: "email",
      status: "completed",
      total_recipients: 118,
      sent_at: "2026-06-11 14:00"
    },
    {
      id: "camp-2",
      name: "Jhumka Collection Early Invite",
      segment_name: "High Value Mumbai VIPs",
      channel: "whatsapp",
      status: "completed",
      total_recipients: 42,
      sent_at: "2026-06-12 09:30"
    },
    {
      id: "camp-3",
      name: "Minimalist Ring Stack Promotion",
      segment_name: "Recent Silver Churn Risk",
      channel: "sms",
      status: "draft",
      total_recipients: 0,
      sent_at: null
    }
  ];

  // Mock live metrics state for execution monitor
  const [liveStats, setLiveStats] = useState({
    total_sent: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    read: 0,
    clicked: 0,
    delivery_rate: 0.00,
    open_rate: 0.00,
    click_rate: 0.00
  });

  const handleCreateCampaign = () => {
    // Action stub
    alert("Campaign created as draft!");
  };

  const handleStartExecution = (campaignId: string) => {
    setIsExecuting(true);
    setMonitoredCampaignId(campaignId);
    
    // Simulate real-time streaming updates over 10 seconds
    let sent = 0;
    let deliv = 0;
    let fail = 0;
    let op = 0;
    let rd = 0;
    let cl = 0;
    
    const interval = setInterval(() => {
      sent += Math.min(5, 42 - sent);
      if (sent > deliv + fail) {
        if (Math.random() < 0.95) {
          deliv += Math.min(5, sent - (deliv + fail));
        } else {
          fail += Math.min(5, sent - (deliv + fail));
        }
      }
      
      if (deliv > op && Math.random() < 0.6) {
        op += Math.min(3, deliv - op);
      }
      if (op > rd && Math.random() < 0.7) {
        rd += Math.min(2, op - rd);
      }
      if (rd > cl && Math.random() < 0.2) {
        cl += Math.min(1, rd - cl);
      }
      
      const delRate = sent > 0 ? (deliv / sent) * 100 : 0;
      const opRate = sent > 0 ? (op / sent) * 100 : 0;
      const clRate = sent > 0 ? (cl / sent) * 100 : 0;

      setLiveStats({
        total_sent: sent,
        delivered: deliv,
        failed: fail,
        opened: op,
        read: rd,
        clicked: cl,
        delivery_rate: parseFloat(delRate.toFixed(2)),
        open_rate: parseFloat(opRate.toFixed(2)),
        click_rate: parseFloat(clRate.toFixed(2))
      });

      if (sent >= 42) {
        clearInterval(interval);
        setIsExecuting(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
          Campaigns Engine
        </h1>
        <p className="text-sm text-muted">
          Draft messaging templates, execute multi-channel campaigns, and inspect live performance feeds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Create Campaign Form */}
        <div className="premium-card flex flex-col gap-5 lg:col-span-1">
          <h2 className="text-lg font-serif font-semibold text-primary">
            New Campaign Composer
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-semibold uppercase">Campaign Name</label>
              <input 
                type="text" 
                placeholder="E.g., Jhumka Festive Launch" 
                className="premium-input text-sm"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted font-semibold uppercase">Target Segment</label>
              <select 
                className="premium-input text-sm"
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
              >
                <option value="">Select Audience...</option>
                <option value="s1">High Value Mumbai VIPs (42)</option>
                <option value="s2">At-Risk Gold Shoppers (118)</option>
                <option value="s3">Recent Silver Churn Risk (65)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted font-semibold uppercase">Dispatch Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "email", icon: Mail, name: "Email" },
                  { id: "sms", icon: MessageSquare, name: "SMS" },
                  { id: "whatsapp", icon: PhoneCall, name: "WhatsApp" }
                ].map((channel) => {
                  const Icon = channel.icon;
                  const isSel = selectedChannel === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-semibold transition-colors ${
                        isSel 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border bg-[#0b0b0d] text-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{channel.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs text-muted font-semibold uppercase">Message Copy Template</label>
                <button className="text-[10px] text-primary hover:underline font-semibold">
                  Generate with Grok
                </button>
              </div>
              <textarea 
                rows={5}
                placeholder="Dear {{name}}, treat yourself to our..."
                className="premium-input text-sm resize-none"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground/60 block mt-1">
                Supported placeholders: <code>{"{{name}}"}</code> for personalized dynamic replacement.
              </span>
            </div>
          </div>

          <button 
            onClick={handleCreateCampaign}
            className="premium-button-primary w-full mt-2"
          >
            Save Campaign Draft
          </button>
        </div>

        {/* Right Column: Execution Monitor & Campaigns List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Execution Monitor */}
          {monitoredCampaignId && (
            <div className="premium-card bg-[#09080c] border-[#8143a5]/10 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-[#bf76e9] ${isExecuting ? "animate-spin" : ""}`} />
                  <h2 className="text-lg font-serif font-semibold text-[#ebd5f8]">
                    Real-time Execution Monitor
                  </h2>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full ${
                  isExecuting ? "bg-[#8143a5]/25 text-[#dbb8ef]" : "bg-emerald-500/15 text-emerald-400"
                }`}>
                  {isExecuting ? "Streaming Feed" : "Finished"}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Sent", val: liveStats.total_sent, icon: Send, color: "text-blue-400" },
                  { label: "Delivered", val: liveStats.delivered, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Failed", val: liveStats.failed, icon: AlertTriangle, color: "text-amber-500" },
                  { label: "Opened", val: liveStats.opened, icon: Eye, color: "text-indigo-400" },
                  { label: "Read", val: liveStats.read, icon: BookOpen, color: "text-purple-400" },
                  { label: "Clicked", val: liveStats.clicked, icon: MousePointerClick, color: "text-pink-400" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="bg-[#0e0c12] border border-border p-3.5 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center">
                      <Icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{item.label}</span>
                      <span className="text-base font-bold font-mono">{item.val}</span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {[
                  { label: "Delivery Success Rate", pct: liveStats.delivery_rate, color: "bg-emerald-500" },
                  { label: "Audience Open Rate", pct: liveStats.open_rate, color: "bg-indigo-500" },
                  { label: "Click-Through Rate", pct: liveStats.click_rate, color: "bg-pink-500" }
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-muted">{bar.label}</span>
                      <span className="font-mono text-foreground">{bar.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#121217] border border-border rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaigns Catalog */}
          <div className="space-y-4">
            <h2 className="text-xl font-serif font-semibold text-foreground">
              Campaign Registry
            </h2>

            <div className="space-y-4">
              {mockCampaigns.map((camp) => (
                <div key={camp.id} className="premium-card flex items-center justify-between gap-6 hover:border-primary/20">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm text-foreground">
                        {camp.name}
                      </h3>
                    </div>
                    <div className="flex gap-4 items-center text-[10px] text-muted">
                      <span>Segment: <strong>{camp.segment_name}</strong></span>
                      <span>Channel: <strong className="uppercase">{camp.channel}</strong></span>
                      {camp.sent_at && <span>Executed: <strong>{camp.sent_at}</strong></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${
                      camp.status === "completed" 
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                        : "bg-border text-muted border-border"
                    }`}>
                      {camp.status}
                    </span>
                    
                    {camp.status === "completed" ? (
                      <button 
                        onClick={() => handleStartExecution(camp.id)}
                        className="premium-button-secondary text-xs py-1.5"
                      >
                        Inspect Stats
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleStartExecution(camp.id)}
                        className="premium-button-primary text-xs py-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Execute</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

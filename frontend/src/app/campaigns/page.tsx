"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Megaphone, 
  Send, 
  RefreshCw, 
  Mail, 
  MessageSquare, 
  PhoneCall
} from "lucide-react";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  filter_json?: any;
}

interface Campaign {
  id: string;
  name: string;
  segment_id: string | null;
  channel: string;
  message_template: string;
  status: string;
  total_recipients: number;
  sent_at: string | null;
  completed_at: string | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function CampaignsPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign composer states
  const [campaignName, setCampaignName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("email");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch segments and campaigns
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch segments
      const segRes = await fetch(`${BACKEND_URL}/api/segments/`);
      if (segRes.ok) {
        const segData = await segRes.json();
        setSegments(segData);
      }

      // 2. Fetch campaigns
      const campRes = await fetch(`${BACKEND_URL}/api/campaigns/`);
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData);
      }
    } catch (err) {
      console.error("Error fetching campaign page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      alert("Please enter a campaign name.");
      return;
    }
    if (!selectedSegment) {
      alert("Please select a target segment.");
      return;
    }
    if (!messageTemplate.trim()) {
      alert("Please enter a message template.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: campaignName,
        segment_id: selectedSegment,
        channel: selectedChannel,
        message_template: messageTemplate,
        goal: "Promotion"
      };

      const response = await fetch(`${BACKEND_URL}/api/campaigns/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create campaign.");
      }

      // Reset Form fields
      setCampaignName("");
      setMessageTemplate("");
      setSelectedSegment("");
      
      // Refresh list
      await fetchData();
      alert("Campaign created successfully as a draft!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartExecution = async (campaignId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/campaigns/${campaignId}/execute`, {
        method: "POST"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to execute campaign.");
      }

      // Redirect to campaign live tracking page
      router.push(`/campaigns/${campaignId}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to execute campaign.");
    }
  };

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "All Customers";
    const segment = segments.find((s) => s.id === segmentId);
    return segment ? `${segment.name} (${segment.customer_count})` : "Unknown Segment";
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

          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-semibold uppercase">Campaign Name</label>
              <input 
                type="text" 
                required
                placeholder="E.g., Jhumka Festive Launch" 
                className="premium-input text-sm"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted font-semibold uppercase">Target Segment</label>
              <select 
                required
                className="premium-input text-sm appearance-none cursor-pointer pr-8"
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                disabled={submitting}
              >
                <option value="">Select Audience...</option>
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    {seg.name} ({seg.customer_count})
                  </option>
                ))}
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
                      type="button"
                      onClick={() => setSelectedChannel(channel.id)}
                      disabled={submitting}
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
              </div>
              <textarea 
                required
                rows={5}
                placeholder="Dear {{name}}, treat yourself to our..."
                className="premium-input text-sm resize-none"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                disabled={submitting}
              />
              <span className="text-[10px] text-muted-foreground/60 block mt-1">
                Supported placeholders: <code>{"{{name}}"}</code> for personalized dynamic replacement.
              </span>
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="premium-button-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-background" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Campaign Draft</span>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Campaigns List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-serif font-semibold text-foreground">
              Campaign Registry
            </h2>

            <div className="space-y-4">
              {loading ? (
                <div className="premium-card text-center py-12 text-muted text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <span>Loading campaign catalog...</span>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="premium-card text-center py-12 text-muted text-xs">
                  No campaigns registered yet.
                </div>
              ) : (
                campaigns.map((camp) => (
                  <div key={camp.id} className="premium-card flex items-center justify-between gap-6 hover:border-primary/20 bg-[#121212]">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm text-foreground">
                          {camp.name}
                        </h3>
                      </div>
                      <div className="flex gap-4 items-center text-[10px] text-muted font-mono">
                        <span>Segment: <strong>{getSegmentName(camp.segment_id)}</strong></span>
                        <span>Channel: <strong className="uppercase">{camp.channel}</strong></span>
                        {camp.sent_at && (
                          <span>Executed: <strong>{new Date(camp.sent_at).toLocaleString()}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${
                        camp.status === "completed" 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : camp.status === "processing"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          : "bg-border text-muted border-border"
                      }`}>
                        {camp.status}
                      </span>
                      
                      {camp.status === "completed" || camp.status === "processing" ? (
                        <button 
                          onClick={() => router.push(`/campaigns/${camp.id}`)}
                          className="premium-button-secondary text-xs py-1.5 font-semibold"
                        >
                          Inspect Stats
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStartExecution(camp.id)}
                          className="premium-button-primary text-xs py-1.5 flex items-center gap-1 font-semibold"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Execute</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

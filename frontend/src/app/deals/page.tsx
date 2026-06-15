"use client";

import { useEffect, useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { 
  Briefcase, 
  Plus, 
  IndianRupee, 
  Clock, 
  User, 
  RefreshCw, 
  X, 
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface Deal {
  id: string;
  customer_id: string;
  title: string;
  value: number;
  stage: string;
  expected_close_date?: string;
  customer_name?: string;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  city?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const STAGES = [
  { id: "prospect", name: "Prospect", color: "border-blue-500/20 text-blue-400 bg-blue-500/5" },
  { id: "qualified", name: "Qualified", color: "border-indigo-500/20 text-indigo-400 bg-indigo-500/5" },
  { id: "proposal", name: "Proposal", color: "border-amber-500/20 text-amber-400 bg-amber-500/5" },
  { id: "negotiation", name: "Negotiation", color: "border-purple-500/20 text-purple-400 bg-purple-500/5" },
  { id: "closed_won", name: "Closed Won", color: "border-primary/20 text-primary bg-primary/5 font-semibold" },
  { id: "closed_lost", name: "Closed Lost", color: "border-rose-500/20 text-rose-400 bg-rose-500/5" }
];

export default function DealsPage() {
  const [mounted, setMounted] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [newDealCustomerId, setNewDealCustomerId] = useState("");
  const [newDealStage, setNewDealStage] = useState("prospect");
  const [newDealCloseDate, setNewDealCloseDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchDeals();
    fetchCustomers();
  }, []);

  // Set up Supabase Realtime Listener
  useEffect(() => {
    if (!mounted) return;

    const channel = supabase
      .channel("deals_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as Deal;
            // Fetch customer details to append customer_name
            const custResp = await supabase.from("customers").select("name").eq("id", newRow.customer_id).single();
            const customerName = custResp.data ? custResp.data.name : "Unknown Customer";
            const fullNewDeal = { ...newRow, customer_name: customerName };
            setDeals(prev => [fullNewDeal, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as Deal;
            setDeals(prev => prev.map(d => {
              if (d.id === updatedRow.id) {
                // Trigger toast notifications on stage change
                if (d.stage !== updatedRow.stage) {
                  const stageObj = STAGES.find(s => s.id === updatedRow.stage);
                  toast.success(`Deal "${updatedRow.title}" shifted to ${stageObj?.name || updatedRow.stage}`, {
                    style: {
                      background: "#1A1A1A",
                      color: "#FFFFFF",
                      border: "1px solid #C9A96E"
                    }
                  });
                }
                return { ...d, ...updatedRow };
              }
              return d;
            }));
          } else if (payload.eventType === "DELETE") {
            const deletedRow = payload.old as { id: string };
            setDeals(prev => prev.filter(d => d.id !== deletedRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted]);

  async function fetchDeals() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/deals/`);
      if (!res.ok) throw new Error("Failed to load deals");
      const data = await res.json();
      setDeals(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Deals data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/?limit=200`);
      if (!res.ok) throw new Error("Failed to load customer directory");
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Card Drag End
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dealId = draggableId;
    const targetStage = destination.droppableId;

    // Optimistically update frontend state
    const originalDeals = [...deals];
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d));

    try {
      const res = await fetch(`${BACKEND_URL}/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStage })
      });
      if (!res.ok) throw new Error("Failed to sync deal update with backend");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update deal stage. Reverting...");
      setDeals(originalDeals);
    }
  };

  // Create Deal Submit
  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealTitle.trim() || !newDealCustomerId || !newDealValue) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: newDealCustomerId,
        title: newDealTitle,
        value: parseFloat(newDealValue),
        stage: newDealStage,
        expected_close_date: newDealCloseDate ? new Date(newDealCloseDate).toISOString() : null
      };

      const res = await fetch(`${BACKEND_URL}/api/deals/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create deal");

      toast.success("Deal created successfully!");
      setIsModalOpen(false);
      
      // Reset fields
      setNewDealTitle("");
      setNewDealValue("");
      setNewDealCustomerId("");
      setNewDealStage("prospect");
      setNewDealCloseDate("");
      
      fetchDeals(); // Fallback sync
    } catch (err) {
      console.error(err);
      toast.error("Failed to create new deal");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter deals based on search
  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (deal.customer_name && deal.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate aggregates
  const getStageStats = (stageId: string) => {
    const stageDeals = filteredDeals.filter(d => d.stage === stageId);
    const count = stageDeals.length;
    const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);
    return { count, totalValue };
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 p-8 bg-[#0F0F0F] text-foreground flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-serif tracking-wide text-primary flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            <span>Sales Pipelines</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage your opportunities, track negotiations, and monitor deals in real-time.
          </p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="premium-button-primary flex items-center gap-2 px-5 py-2.5"
        >
          <Plus className="w-4 h-4 text-background" />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 shrink-0 flex items-center gap-4 bg-[#16161A] p-4 rounded-xl border border-border/40">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search deals by title or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="premium-input pl-10 pr-4 py-2 w-full text-sm"
          />
          <User className="absolute left-3.5 top-2.5 w-4 h-4 text-muted/60" />
        </div>
        
        {loading && (
          <div className="flex items-center gap-2 text-xs text-primary font-mono animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Refreshing Board...</span>
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full min-w-[1200px]">
            {STAGES.map(stage => {
              const { count, totalValue } = getStageStats(stage.id);
              const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
              
              return (
                <div key={stage.id} className="flex flex-col w-72 bg-[#141416]/50 rounded-xl border border-border/20 p-4 h-full overflow-hidden">
                  {/* Column Header */}
                  <div className="mb-4 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${stage.color}`}>
                        {stage.name}
                      </span>
                      <span className="text-xs font-mono text-muted/80 bg-[#1A1A1E] px-2 py-0.5 rounded-md border border-border/40">
                        {count}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-foreground/90 font-serif">
                      <span className="text-xs text-muted/60">Value:</span>
                      <span className="text-sm font-semibold text-primary font-mono">
                        ₹{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Drop Zone */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 rounded-lg p-1.5 transition-colors duration-200 ${
                          snapshot.isDraggingOver ? "bg-[#1C1C22]/30 border border-dashed border-primary/20" : ""
                        }`}
                      >
                        {stageDeals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`premium-card p-4 transition-all duration-200 hover:border-primary/40 active:scale-98 ${
                                  snapshot.isDragging ? "shadow-2xl border-primary bg-[#1C1C22]" : ""
                                }`}
                              >
                                <h4 className="text-sm font-medium text-foreground font-serif tracking-wide leading-snug mb-3">
                                  {deal.title}
                                </h4>

                                <div className="space-y-1.5 border-t border-border/20 pt-2.5">
                                  {deal.customer_name && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <User className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                      <span className="truncate font-sans font-medium text-muted">{deal.customer_name}</span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-between text-xs mt-2">
                                    <div className="flex items-center gap-1.5 font-mono text-primary font-semibold">
                                      <IndianRupee className="w-3 h-3 text-primary shrink-0" />
                                      <span>{Number(deal.value).toFixed(2)}</span>
                                    </div>
                                    
                                    {deal.expected_close_date && (
                                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/75 font-mono">
                                        <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                        <span>{new Date(deal.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Modal - New Opportunity */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121214] border border-primary/20 rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-foreground p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-serif text-primary tracking-wide flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Create Opportunity</span>
            </h3>

            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Opportunity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Elysian Solitaire Custom Order"
                  value={newDealTitle}
                  onChange={(e) => setNewDealTitle(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Associate Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newDealCustomerId}
                  onChange={(e) => setNewDealCustomerId(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground bg-[#1A1A1E]"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                    Deal Value (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newDealValue}
                    onChange={(e) => setNewDealValue(e.target.value)}
                    disabled={submitting}
                    className="premium-input text-sm text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                    Initial Stage
                  </label>
                  <select
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value)}
                    disabled={submitting}
                    className="premium-input text-sm text-foreground bg-[#1A1A1E]"
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block flex items-center gap-1.5">
                  <span>Expected Close Date</span>
                  <span className="text-[10px] text-muted-foreground/60">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={newDealCloseDate}
                  onChange={(e) => setNewDealCloseDate(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground font-mono"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="premium-button-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="premium-button-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-background" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Deal</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

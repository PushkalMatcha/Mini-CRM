"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { 
  Inbox, 
  Search, 
  Plus, 
  X, 
  AlertCircle, 
  User, 
  Mail, 
  Clock, 
  ChevronRight, 
  Trash2, 
  CheckCircle2,
  RefreshCw
} from "lucide-react";

interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_email?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const STATUS_BADGES = {
  open: "bg-blue-500/10 text-blue-400 border border-blue-500/25",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
  resolved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
};

const PRIORITY_BADGES = {
  low: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  medium: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  high: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  urgent: "bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold animate-pulse"
};

export default function TicketsPage() {
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchTickets();
    fetchCustomers();
  }, []);

  // Realtime integration
  useEffect(() => {
    if (!mounted) return;

    const channel = supabase
      .channel("tickets_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as Ticket;
            const custResp = await supabase.from("customers").select("name, email").eq("id", newRow.customer_id).single();
            const fullNewTicket = { 
              ...newRow, 
              customer_name: custResp.data ? custResp.data.name : "Unknown Customer",
              customer_email: custResp.data ? custResp.data.email : "unknown@maeven.com"
            };
            setTickets(prev => [fullNewTicket, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as Ticket;
            setTickets(prev => prev.map(t => {
              if (t.id === updatedRow.id) {
                const updatedTicket = { ...t, ...updatedRow };
                if (selectedTicket?.id === updatedRow.id) {
                  setSelectedTicket(updatedTicket);
                }
                return updatedTicket;
              }
              return t;
            }));
          } else if (payload.eventType === "DELETE") {
            const deletedRow = payload.old as { id: string };
            setTickets(prev => prev.filter(t => t.id !== deletedRow.id));
            if (selectedTicket?.id === deletedRow.id) {
              setSelectedTicket(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted, selectedTicket]);

  async function fetchTickets() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/`);
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/?limit=200`);
      if (!res.ok) throw new Error("Failed to load customers");
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle patch status/priority
  const handlePatchTicket = async (ticketId: string, fields: Partial<Ticket>) => {
    // Optimistic state update
    const originalTickets = [...tickets];
    const originalSelected = selectedTicket ? { ...selectedTicket } : null;

    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...fields } : t));
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...fields } : null);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      toast.success("Ticket details updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update ticket. Reverting...");
      setTickets(originalTickets);
      setSelectedTicket(originalSelected);
    }
  };

  // Handle delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to permanently delete this support ticket?")) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${ticketId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete ticket");
      
      toast.success("Ticket deleted successfully");
      setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete ticket");
    }
  };

  // Submit new ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim() || !newCustomerId) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: newCustomerId,
        subject: newSubject,
        description: newDescription,
        status: "open",
        priority: newPriority
      };

      const res = await fetch(`${BACKEND_URL}/api/tickets/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create ticket");

      toast.success("Support ticket created!");
      setIsModalOpen(false);

      // Reset
      setNewSubject("");
      setNewDescription("");
      setNewCustomerId("");
      setNewPriority("medium");

      fetchTickets();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  // Filters application
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.customer_name && ticket.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ticket.customer_email && ticket.customer_email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (!mounted) return null;

  return (
    <div className="flex-1 bg-[#0F0F0F] text-foreground flex h-screen overflow-hidden">
      {/* LEFT PANE: Ticket List */}
      <div className="w-[420px] border-r border-border flex flex-col h-full bg-[#070709] shrink-0">
        {/* Left Pane Header */}
        <div className="p-6 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-serif text-primary flex items-center gap-2">
              <Inbox className="w-6 h-6 text-primary" />
              <span>Shared Inbox</span>
            </h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="premium-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5 text-background" />
              <span>Create Ticket</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search subjects, messages or customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="premium-input pl-9 pr-4 py-2 w-full text-xs"
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted/65" />
          </div>

          {/* Filters Row */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="premium-input text-[11px] py-1 px-2.5 bg-[#121214] flex-1"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="premium-input text-[11px] py-1 px-2.5 bg-[#121214] flex-1"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Loading customer cases...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center text-muted/60 text-xs py-12">
              No tickets matched your query.
            </div>
          ) : (
            filteredTickets.map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={`premium-card p-4 cursor-pointer transition-all duration-200 hover:border-primary/30 relative flex flex-col gap-2.5 ${
                  selectedTicket?.id === t.id ? "border-primary bg-[#121115]/80 shadow" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold text-foreground font-serif tracking-wide truncate max-w-[240px]">
                    {t.subject}
                  </h4>
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[t.status as keyof typeof STATUS_BADGES]}`}>
                    {t.status}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>

                <div className="flex items-center justify-between text-[10px] text-muted/65 border-t border-border/10 pt-2 mt-1 font-sans">
                  <span className="truncate max-w-[150px] font-medium text-foreground/80">{t.customer_name || "Unknown Customer"}</span>
                  <span className="font-mono text-[9px] text-muted-foreground/60">{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANE: Ticket Reading View */}
      <div className="flex-1 flex flex-col h-full bg-[#0F0F0F]">
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Reading Pane Header */}
            <div className="p-8 border-b border-border/50 shrink-0 flex items-center justify-between bg-[#121214]/30">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full ${STATUS_BADGES[selectedTicket.status as keyof typeof STATUS_BADGES]}`}>
                    {selectedTicket.status}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full ${PRIORITY_BADGES[selectedTicket.priority as keyof typeof PRIORITY_BADGES]}`}>
                    {selectedTicket.priority} Priority
                  </span>
                </div>
                <h2 className="text-2xl font-serif text-primary tracking-wide">
                  {selectedTicket.subject}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  className="px-4 py-2 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Reading Pane Scroll Container */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Customer Profile Card */}
              <div className="bg-[#141417]/80 border border-border/30 rounded-xl p-5 flex items-start gap-4">
                <div className="bg-[#212126] border border-primary/20 p-2.5 rounded-full">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs uppercase tracking-wider font-bold text-muted-foreground/60">Submitted By</h4>
                  <p className="text-sm font-semibold font-serif text-foreground">{selectedTicket.customer_name || "Unknown Customer"}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Mail className="w-3.5 h-3.5 text-primary/70" />
                    <span>{selectedTicket.customer_email || "no-email@maeven.com"}</span>
                  </div>
                </div>
              </div>

              {/* Message Block */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span className="font-semibold text-primary/80 uppercase tracking-widest text-[10px]">Client Description</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(selectedTicket.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                </div>
                <div className="bg-[#121215] border border-border/20 rounded-xl p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans">
                    {selectedTicket.description}
                  </p>
                </div>
              </div>

              {/* Configuration panel */}
              <div className="border border-primary/15 bg-[#171612]/35 rounded-xl p-5 space-y-4 max-w-xl">
                <h4 className="text-xs uppercase tracking-wider font-bold text-primary">Ticket Operations</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted/65 block">Update Status</label>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handlePatchTicket(selectedTicket.id, { status: e.target.value })}
                      className="premium-input text-xs text-foreground bg-[#1A1A1E] w-full"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted/65 block">Update Priority</label>
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => handlePatchTicket(selectedTicket.id, { priority: e.target.value })}
                      className="premium-input text-xs text-foreground bg-[#1A1A1E] w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted p-8">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mb-4 animate-pulse" />
            <p className="text-sm font-serif italic text-muted-foreground/50">
              Select a customer ticket from the inbox directory to view its conversation timeline.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: New Ticket Creation */}
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
              <Inbox className="w-5 h-5 text-primary" />
              <span>Create Support Ticket</span>
            </h3>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Associated Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Subject / Topic <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aura Studs Tarnishing Issue"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Description / Message details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write customer inquiry message details..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Priority level
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  disabled={submitting}
                  className="premium-input text-sm text-foreground bg-[#1A1A1E]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
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
                    <span>Submit Ticket</span>
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
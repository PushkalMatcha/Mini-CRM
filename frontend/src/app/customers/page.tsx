"use client";

import { useEffect, useState } from "react";
import { 
  Search, 
  ChevronDown, 
  RefreshCw, 
  Filter, 
  MapPin, 
  ShoppingBag,
  DollarSign,
  Upload
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  age: number;
  gender: string;
  tags: string[];
  attributes: any;
  total_orders: number;
  total_spent: number;
  last_purchase_date: string;
  dormancy_status: string;
  rfm_score: number;
  rfm_segment: string;
  churn_risk: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function CustomersPage() {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  
  // Import State
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [minSpent, setMinSpent] = useState<number | "">("");

  async function fetchCustomers() {
    setLoading(true);
    try {
      let queryParams = new URLSearchParams();
      if (searchTerm.trim()) queryParams.append("search", searchTerm);
      if (selectedSegment !== "all") queryParams.append("rfm_segment", selectedSegment);
      if (selectedCity !== "all") queryParams.append("city", selectedCity);
      if (minSpent !== "") queryParams.append("min_spent", minSpent.toString());
      queryParams.append("limit", "100");

      const response = await fetch(`${BACKEND_URL}/api/customers/?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch customer directory.");
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm, selectedSegment, selectedCity, minSpent]);

  const handleRecomputeRFM = async () => {
    setRecomputing(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/customers/recompute-rfm`, {
        method: "POST",
        headers: headers
      });
      if (!response.ok) throw new Error("Failed to recompute customer RFM matrices.");
      await fetchCustomers();
      alert("RFM metrics and customer lifecycles recomputed successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to recompute RFM.");
    } finally {
      setRecomputing(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    setImportMessage(null);
    setImportError(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${BACKEND_URL}/api/customers/import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to import customers file.");
      }

      setImportMessage(data.message || "Successfully imported customer records!");
      await fetchCustomers();
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An error occurred during file import.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const getDormancyBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
      case "at_risk":
      case "warm":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/25";
      case "dormant":
      default:
        return "bg-red-500/10 text-red-400 border border-red-500/25";
    }
  };

  const getTagColor = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes("minimalist")) return "bg-[#ebd39e]/10 text-[#C9A96E] border border-[#C9A96E]/20";
    if (t.includes("floral")) return "bg-[#dfb1b2]/10 text-[#b78788] border border-[#b78788]/20";
    if (t.includes("oxidised")) return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    if (t.includes("vip")) return "bg-amber-500/10 text-amber-500 border border-amber-500/25 font-bold";
    if (t.includes("gifting")) return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    return "bg-neutral-800 text-neutral-300 border border-neutral-700/60";
  };

  return (
    <div className="space-y-8 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
            Customer Directory
          </h1>
          <p className="text-sm text-muted">
            Manage profiles, view dynamic transaction histories, and analyze RFM segments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className={`premium-button-secondary py-2 flex items-center gap-2 cursor-pointer transition-opacity ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4 text-primary" />
            <span>{importing ? "Importing..." : "Import CSV/Excel"}</span>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              className="hidden" 
              onChange={handleImportFile}
              disabled={importing}
            />
          </label>
          <button
            onClick={handleRecomputeRFM}
            disabled={recomputing}
            className="premium-button-secondary py-2 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${recomputing ? "animate-spin" : ""}`} />
            <span>{recomputing ? "Analyzing Metrics..." : "Recompute RFM Engine"}</span>
          </button>
        </div>
      </div>

      {/* Import Notification Alerts */}
      {importMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center justify-between">
          <span>{importMessage}</span>
          <button 
            onClick={() => setImportMessage(null)}
            className="text-emerald-400 hover:text-emerald-300 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-between">
          <span>{importError}</span>
          <button 
            onClick={() => setImportError(null)}
            className="text-red-400 hover:text-red-300 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="premium-card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by name, email..."
            className="premium-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* RFM segment filter */}
        <div className="relative">
          <select
            className="premium-input appearance-none pr-10 cursor-pointer"
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
          >
            <option value="all">All RFM Segments</option>
            <option value="Champions">Champions</option>
            <option value="Loyal Customers">Loyal Customers</option>
            <option value="Recent/New">Recent/New</option>
            <option value="About to Sleep">About to Sleep</option>
            <option value="Hibernating">Hibernating</option>
            <option value="Lost">Lost</option>
          </select>
          <ChevronDown className="absolute right-3 top-3.5 h-3.5 w-3.5 text-muted/50 pointer-events-none" />
        </div>

        {/* City filter */}
        <div className="relative">
          <select
            className="premium-input appearance-none pr-10 cursor-pointer"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="all">All Cities</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi">Delhi</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Chennai">Chennai</option>
            <option value="Goa">Goa</option>
          </select>
          <ChevronDown className="absolute right-3 top-3.5 h-3.5 w-3.5 text-muted/50 pointer-events-none" />
        </div>

        {/* Min Spent filter */}
        <div>
          <input
            type="number"
            placeholder="Min Spent..."
            className="premium-input"
            value={minSpent}
            onChange={(e) => setMinSpent(e.target.value ? parseFloat(e.target.value) : "")}
          />
        </div>
      </div>

      {/* Customer Table */}
      <div className="premium-card p-0 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted font-medium bg-[#131313] text-xs uppercase tracking-wider">
                <th className="py-4 px-6">Customer Profile</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6 text-center">Orders</th>
                <th className="py-4 px-6 text-right">Revenue</th>
                <th className="py-4 px-6">RFM Segment</th>
                <th className="py-4 px-6">Custom Tags</th>
                <th className="py-4 px-6 text-center">Dormancy</th>
                <th className="py-4 px-6 text-right">Churn Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <span>Loading customer data...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted">
                    No customers found matching the filters.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#151515]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-semibold text-foreground">{customer.name}</p>
                        <p className="text-xs text-muted/70">{customer.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <MapPin className="w-3.5 h-3.5 text-primary/70" />
                        <span>{customer.city}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center font-mono font-medium">
                      {customer.total_orders}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-primary font-bold">
                      ${customer.total_spent.toFixed(2)}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-[#1C1A16] border border-primary/20 text-primary rounded">
                        {customer.rfm_segment || "Recent/New"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {customer.tags && customer.tags.map((tag, idx) => (
                          <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${getTagColor(tag)}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${getDormancyBadge(customer.dormancy_status)}`}>
                        {customer.dormancy_status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{customer.churn_risk ? customer.churn_risk.toFixed(0) : "0"}%</span>
                        <div className="w-8 h-1 bg-[#222] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              customer.churn_risk < 30 
                                ? "bg-emerald-500" 
                                : customer.churn_risk < 70 
                                ? "bg-amber-500" 
                                : "bg-red-500"
                            }`}
                            style={{ width: `${customer.churn_risk || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

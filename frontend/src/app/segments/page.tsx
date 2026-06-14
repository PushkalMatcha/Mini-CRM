"use client";

import { useState, useEffect } from "react";
import { 
  Layers, 
  Sparkles, 
  Terminal, 
  Play, 
  Save, 
  Trash2,
  RefreshCw,
  Users
} from "lucide-react";

interface Segment {
  id: string;
  name: string;
  description: string;
  filter_json: any;
  nl_query: string;
  customer_count: number;
  created_at: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // NL segment builder state
  const [nlQuery, setNlQuery] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [compiledFilters, setCompiledFilters] = useState<any>(null);

  // Manual segment builder state
  const [manualName, setManualName] = useState("");
  const [selectedRFM, setSelectedRFM] = useState("");
  const [selectedDormancy, setSelectedDormancy] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [minSpent, setMinSpent] = useState<number | "">("");
  const [previewing, setPreviewing] = useState(false);
  const [manualCount, setManualCount] = useState<number | null>(null);

  async function fetchSegments() {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/segments/`);
      if (!response.ok) throw new Error("Failed to fetch segments.");
      const data = await response.json();
      setSegments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleCompileNL = async () => {
    if (!nlQuery.trim()) return;
    setIsCompiling(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `compile segment: ${nlQuery}` })
      });
      if (!response.ok) throw new Error("Compilation failed");
      const res = await response.json();
      
      if (res.preview_data) {
        setCompiledFilters(res.preview_data.filters);
        setMatchingCount(res.preview_data.matching_customers_count);
        // Default a segment name based on query keywords
        setSegmentName(segmentName || `AI Segment - ${nlQuery.slice(0, 20)}...`);
      } else {
        alert("Could not compile natural language query.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse natural language using AI.");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSaveAISegment = async () => {
    if (!segmentName.trim() || !compiledFilters) {
      alert("Please provide a name and ensure the filters are compiled.");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/segments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: segmentName,
          description: `AI-generated segment compiled from query: "${nlQuery}"`,
          filter_json: compiledFilters,
          nl_query: nlQuery
        })
      });

      if (!response.ok) throw new Error("Failed to save segment");
      
      // Reset builder
      setSegmentName("");
      setNlQuery("");
      setCompiledFilters(null);
      setMatchingCount(null);
      
      await fetchSegments();
      alert("AI Audience Segment created successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to create segment.");
    }
  };

  const buildManualFilters = () => {
    const filters: any = {};
    if (selectedRFM) filters["rfm_segment"] = selectedRFM;
    if (selectedDormancy) filters["dormancy_status"] = selectedDormancy;
    if (selectedCity) filters["city"] = selectedCity;
    if (minSpent !== "") filters["min_spent"] = minSpent;
    return filters;
  };

  const handlePreviewManual = async () => {
    setPreviewing(true);
    try {
      const filters = buildManualFilters();
      const response = await fetch(`${BACKEND_URL}/api/segments/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters)
      });
      if (!response.ok) throw new Error("Failed to evaluate manual segment.");
      const data = await response.json();
      setManualCount(data.matching_customers_count);
    } catch (err) {
      console.error(err);
      alert("Failed to preview manual segment.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveManualSegment = async () => {
    if (!manualName.trim()) {
      alert("Please provide a name for your segment.");
      return;
    }
    const filters = buildManualFilters();
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/segments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualName,
          description: "Manually constructed CRM filter rules.",
          filter_json: filters
        })
      });

      if (!response.ok) throw new Error("Failed to save segment.");
      
      // Reset form
      setManualName("");
      setSelectedRFM("");
      setSelectedDormancy("");
      setSelectedCity("");
      setMinSpent("");
      setManualCount(null);

      await fetchSegments();
      alert("Manual Segment saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save segment.");
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this segment?")) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/segments/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete segment.");
      await fetchSegments();
    } catch (err) {
      console.error(err);
      alert("Failed to delete segment.");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
          Audience Segment Builder
        </h1>
        <p className="text-sm text-muted">
          Group customers dynamically using manual filter rules or Grok natural language query compiling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: NL Interface console & builder */}
        <div className="lg:col-span-2 space-y-8">
          {/* NL search console */}
          <div className="premium-card flex flex-col gap-5 border-primary/15 bg-gradient-to-r from-card to-[#191816]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-lg font-serif font-semibold gold-gradient-text">
                AI Segment Assistant
              </h2>
            </div>
            
            <p className="text-xs text-muted leading-normal">
              Type what segment you want to build in plain English (e.g., "Active customers in Mumbai who spent over 500"). Our Grok compiler will automatically generate the schema filters for you.
            </p>

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ask Grok to build a segment..."
                className="premium-input"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
              />
              <button 
                onClick={handleCompileNL}
                disabled={isCompiling || !nlQuery.trim()}
                className="premium-button-primary whitespace-nowrap min-w-[120px]"
              >
                {isCompiling ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-background" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Run Parser</span>
                  </>
                )}
              </button>
            </div>

            {/* Console Output */}
            {matchingCount !== null && (
              <div className="border border-border bg-[#0C0C0C] rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center text-xs border-b border-border/60 pb-2">
                  <div className="flex items-center gap-1.5 font-mono text-muted">
                    <Terminal className="w-3.5 h-3.5 text-primary" />
                    <span>Grok-Beta Compiler Output</span>
                  </div>
                  <span className="text-emerald-500 font-semibold font-mono">Matched: {matchingCount} Customers</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Save Segment Name</span>
                      <input
                        type="text"
                        placeholder="Name your AI segment..."
                        className="premium-input text-xs"
                        value={segmentName}
                        onChange={(e) => setSegmentName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Compiled JSON Logic</span>
                    <pre className="text-[11px] text-primary bg-[#121212] border border-border p-2.5 rounded font-mono overflow-x-auto">
                      {JSON.stringify(compiledFilters, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setMatchingCount(null);
                      setCompiledFilters(null);
                    }} 
                    className="premium-button-secondary py-1.5 text-xs"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={handleSaveAISegment}
                    disabled={!segmentName.trim()}
                    className="premium-button-primary py-1.5 text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Segment</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Rules builder */}
          <div className="premium-card space-y-6">
            <h2 className="text-lg font-serif font-semibold text-foreground">
              Manual Filter Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-semibold uppercase">Segment Name</label>
                <input 
                  type="text" 
                  placeholder="E.g. VIP Mumbai" 
                  className="premium-input text-xs"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-semibold uppercase">RFM Segment</label>
                <select 
                  className="premium-input text-xs pr-8 cursor-pointer"
                  value={selectedRFM}
                  onChange={(e) => setSelectedRFM(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="Champions">Champions</option>
                  <option value="Loyal Customers">Loyal Customers</option>
                  <option value="Recent/New">Recent/New</option>
                  <option value="About to Sleep">About to Sleep</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-semibold uppercase">Dormancy Status</label>
                <select 
                  className="premium-input text-xs pr-8 cursor-pointer"
                  value={selectedDormancy}
                  onChange={(e) => setSelectedDormancy(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="active">Active</option>
                  <option value="at_risk">At Risk</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-semibold uppercase">City</label>
                <select 
                  className="premium-input text-xs pr-8 cursor-pointer"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Goa">Goa</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-semibold uppercase">Min Total Spent</label>
                <input 
                  type="number" 
                  placeholder="e.g. 500" 
                  className="premium-input text-xs"
                  value={minSpent}
                  onChange={(e) => setMinSpent(e.target.value ? parseFloat(e.target.value) : "")}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={handlePreviewManual}
                  disabled={previewing}
                  className="premium-button-secondary text-xs font-semibold"
                >
                  {previewing ? "Evaluating..." : "Evaluate Rules"}
                </button>
                <button 
                  onClick={handleSaveManualSegment}
                  disabled={!manualName.trim()}
                  className="premium-button-primary text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Segment</span>
                </button>
              </div>
            </div>

            {manualCount !== null && (
              <div className="bg-[#121212] border border-border p-4 rounded-lg flex items-center justify-between text-sm">
                <span className="text-muted flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Current query match preview size:</span>
                </span>
                <span className="font-mono font-bold text-primary text-base">
                  {manualCount} matching customers
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Saved Segments List */}
        <div className="space-y-6">
          <h2 className="text-xl font-serif font-semibold text-primary">
            Saved Segments
          </h2>
          
          <div className="space-y-4">
            {loading ? (
              <div className="premium-card text-center py-6 text-muted text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-2" />
                <span>Loading segments library...</span>
              </div>
            ) : segments.length === 0 ? (
              <div className="premium-card text-center py-6 text-muted text-xs">
                No segments saved yet.
              </div>
            ) : (
              segments.map((segment) => (
                <div key={segment.id} className="premium-card flex flex-col gap-4 border-border hover:border-primary/25">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      <h3 className="font-serif font-semibold text-foreground text-sm">
                        {segment.name}
                      </h3>
                    </div>
                    <button 
                      onClick={() => handleDeleteSegment(segment.id)}
                      className="text-muted/40 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <p className="text-xs text-muted leading-relaxed">
                    {segment.description}
                  </p>
                  
                  <div className="flex justify-between items-center text-[10px] text-muted/60 border-t border-border/40 pt-3 font-mono">
                    <span>Matched: <strong className="text-primary">{segment.customer_count}</strong></span>
                    <span>Created: {new Date(segment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

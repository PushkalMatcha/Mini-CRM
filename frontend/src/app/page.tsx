"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import CampaignFunnel from "@/components/CampaignFunnel";
import { 
  Users, 
  IndianRupee, 
  TrendingUp, 
  Percent, 
  ShoppingBag,
  Sparkles,
  BarChart2
} from "lucide-react";

// Dynamically load Recharts charts with SSR disabled to avoid hydration mismatches in Next.js App Router
const RevenueTrendChart = dynamic(
  () => import("@/components/DashboardChart").then((mod) => mod.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-72 bg-[#121212] animate-pulse rounded-lg" /> }
);

const CollectionShareChart = dynamic(
  () => import("@/components/DashboardChart").then((mod) => mod.CollectionShareChart),
  { ssr: false, loading: () => <div className="h-72 bg-[#121212] animate-pulse rounded-lg" /> }
);

export default function DashboardPage() {
  const stats = [
    { name: "Total Customers", value: "500", icon: Users, change: "+12.3% MoM", changeType: "positive" },
    { name: "Total Revenue Generated", value: "₹284,540.00", icon: IndianRupee, change: "+8.7% MoM", changeType: "positive" },
    { name: "Avg. Campaign Open Rate", value: "68.4%", icon: TrendingUp, change: "+4.1% MoM", changeType: "positive" },
    { name: "Avg. Segment Churn Risk", value: "32.1%", icon: Percent, change: "-2.3% MoM", changeType: "negative" },
  ];



  const handleExportReport = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    window.location.href = `${backendUrl}/api/customers/export`;
  };

  return (
    <div className="space-y-8 max-w-7xl w-full mx-auto">
      {/* Welcome Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-wide text-foreground">
            Maeven Analytics Dashboard
          </h1>
          <p className="text-sm text-muted">
            Intelligent CRM overview & real-time customer lifecycle metrics.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportReport}
            className="premium-button-primary"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="premium-card flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  {stat.name}
                </span>
                <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-sans">
                  {stat.value}
                </span>
                <span className={`text-xs font-medium ${
                  stat.changeType === "positive" ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recharts Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Trend Area Chart */}
        <div className="premium-card lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <h2 className="text-base font-serif font-semibold text-foreground">
              Sales Revenue Trend (30 Days)
            </h2>
          </div>
          <RevenueTrendChart />
        </div>

        {/* Collection Category Bar Chart */}
        <div className="premium-card flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-serif font-semibold text-foreground">
              Sales by Collection Category
            </h2>
          </div>
          <CollectionShareChart />
        </div>
      </div>

      {/* Lower Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Campaign Performance Funnel Panel */}
        <div className="premium-card lg:col-span-2">
          <CampaignFunnel />
        </div>

        {/* AI Insight Card */}
        <div className="premium-card flex flex-col gap-6 bg-gradient-to-b from-[#161412] to-card border-primary/10">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary animate-pulse" />
            <h2 className="text-lg font-serif font-semibold gold-gradient-text">
              Dormancy Alert
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            Our predictive engines show <span className="text-foreground font-semibold">142 customers</span> are on the verge of turning dormant. Most are in the <strong>"Loyal"</strong> RFM Segment who haven't placed an order in 90+ days.
          </p>
          <div className="border border-border p-4 rounded-lg bg-[#0F0F0F] space-y-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block">
              Recommended Action
            </span>
            <p className="text-xs text-muted">
              Trigger a personalized email winback campaign with an early access invite to the new 'Floral Bloom' collection.
            </p>
          </div>
          <Link href="/campaigns" className="premium-button-primary mt-auto">
            Design Campaign
          </Link>
        </div>
      </div>
    </div>
  );
}

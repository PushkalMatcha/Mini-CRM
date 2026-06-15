"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

const revenueData = [
  { date: "May 15", revenue: 2400 },
  { date: "May 18", revenue: 3600 },
  { date: "May 21", revenue: 3100 },
  { date: "May 24", revenue: 4800 },
  { date: "May 27", revenue: 5400 },
  { date: "May 30", revenue: 4900 },
  { date: "Jun 02", revenue: 6200 },
  { date: "Jun 05", revenue: 7800 },
  { date: "Jun 08", revenue: 8400 },
  { date: "Jun 12", revenue: 9500 },
];

const categoryData = [
  { name: "Necklaces", revenue: 18400 },
  { name: "Rings", revenue: 24200 },
  { name: "Earrings", revenue: 14900 },
  { name: "Bracelets", revenue: 11200 },
];

export function RevenueTrendChart() {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#C9A96E" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis dataKey="date" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A", borderRadius: "8px", color: "#F5F5F5" }}
            labelStyle={{ color: "#C9A96E", fontWeight: "bold" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#C9A96E" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CollectionShareChart() {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis dataKey="name" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A", borderRadius: "8px", color: "#F5F5F5" }}
          />
          <Bar dataKey="revenue" fill="#C9A96E" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

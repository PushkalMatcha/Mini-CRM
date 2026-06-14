"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";

interface CampaignChartProps {
  stats: {
    total_sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
}

export function CampaignFunnelChart({ stats }: CampaignChartProps) {
  const data = [
    {
      stage: "Sent",
      count: stats.total_sent,
      percentage: 100,
      fill: "#EAD4A9", // Champagne
    },
    {
      stage: "Delivered",
      count: stats.delivered,
      percentage: stats.total_sent > 0 ? Math.round((stats.delivered / stats.total_sent) * 100) : 0,
      fill: "#C9A96E", // Warm Gold
    },
    {
      stage: "Opened",
      count: stats.opened,
      percentage: stats.total_sent > 0 ? Math.round((stats.opened / stats.total_sent) * 100) : 0,
      fill: "#A38652", // Darker Gold
    },
    {
      stage: "Clicked",
      count: stats.clicked,
      percentage: stats.total_sent > 0 ? Math.round((stats.clicked / stats.total_sent) * 100) : 0,
      fill: "#7E653C", // Deep Gold / Bronze
    },
  ];

  const formatValue = (value: number) => {
    return value.toLocaleString();
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 40, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} vertical={true} />
          <XAxis 
            type="number" 
            stroke="#737373" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            dataKey="stage" 
            type="category" 
            stroke="#F5F5F5" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: "#1A1A1A", 
              borderColor: "#2A2A2A", 
              borderRadius: "8px", 
              color: "#F5F5F5",
              fontSize: "12px"
            }}
            formatter={(value: any, name: any, props: any) => [
              `${formatValue(value as number)} (${props.payload.percentage}% of sent)`,
              "Volume"
            ]}
            labelStyle={{ color: "#C9A96E", fontWeight: "bold" }}
          />
          <Bar 
            dataKey="count" 
            radius={[0, 4, 4, 0]} 
            maxBarSize={36}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            <LabelList 
              dataKey="count" 
              position="right" 
              fill="#DCD6C7" 
              fontSize={11} 
              formatter={formatValue}
              offset={10}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

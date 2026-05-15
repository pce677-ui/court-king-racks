import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend } from "recharts";
import { format } from "date-fns";

type HistoryRow = {
  player_id: string;
  points_after: number;
  created_at: string;
};

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--accent)",
];

export function LeaderboardChart({
  players,
}: {
  players: { id: string; full_name: string; ranking_points: number }[];
}) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ranking_history")
      .select("player_id,points_after,created_at")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setHistory((data as HistoryRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Top N players by current points
  const top = useMemo(
    () => [...players].sort((a, b) => b.ranking_points - a.ranking_points).slice(0, 7),
    [players],
  );

  const config: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    top.forEach((p, i) => {
      cfg[p.id] = { label: p.full_name, color: PALETTE[i % PALETTE.length] };
    });
    return cfg;
  }, [top]);

  // Build merged time series: each event becomes a row carrying the latest known
  // value for every tracked player at that timestamp.
  const data = useMemo(() => {
    const tracked = new Set(top.map((p) => p.id));
    const events = history.filter((h) => tracked.has(h.player_id));
    if (events.length === 0) return [];
    const last: Record<string, number> = {};
    top.forEach((p) => (last[p.id] = 1000));
    return events.map((e) => {
      last[e.player_id] = Number(e.points_after);
      return {
        t: new Date(e.created_at).getTime(),
        label: format(new Date(e.created_at), "MMM d"),
        ...last,
      };
    });
  }, [history, top]);

  if (loading) {
    return <div className="h-56 grid place-items-center text-xs text-muted-foreground">Loading…</div>;
  }
  if (data.length < 2) {
    return (
      <div className="h-56 grid place-items-center text-xs text-muted-foreground text-center px-6">
        Not enough history yet — once a few matches are published, every player's ranking curve will appear here.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-64 w-full aspect-auto">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} minTickGap={28} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={32} domain={["auto", "auto"]} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        {top.map((p) => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={p.id}
            name={p.full_name}
            stroke={`var(--color-${p.id})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={600}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
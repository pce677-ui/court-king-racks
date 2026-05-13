import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

type Point = { t: number; pts: number; label: string };

const config: ChartConfig = {
  pts: { label: "Points", color: "var(--primary)" },
};

export function RankingChart({ playerId, currentPoints }: { playerId: string; currentPoints: number }) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ranking_history")
      .select("points_after,created_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: true })
      .then(({ data: rows }) => {
        const pts: Point[] = (rows ?? []).map((r) => ({
          t: new Date(r.created_at).getTime(),
          pts: Number(r.points_after),
          label: format(new Date(r.created_at), "MMM d"),
        }));
        // Always pin a starting point at 1000 if no history starts there
        if (pts.length === 0) {
          pts.push({ t: Date.now(), pts: currentPoints, label: "now" });
        }
        setData(pts);
        setLoading(false);
      });
  }, [playerId, currentPoints]);

  if (loading) {
    return <div className="h-40 grid place-items-center text-xs text-muted-foreground">Loading…</div>;
  }

  if (data.length < 2) {
    return (
      <div className="h-40 grid place-items-center text-xs text-muted-foreground">
        Not enough data yet — play a few matches.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-44 w-full aspect-auto">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="rkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pts)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--color-pts)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10 }}
          minTickGap={28}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10 }}
          width={32}
          domain={["auto", "auto"]}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          type="monotone"
          dataKey="pts"
          stroke="var(--color-pts)"
          strokeWidth={2}
          fill="url(#rkFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
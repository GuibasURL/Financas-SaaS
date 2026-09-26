import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTotal } from "../../types/transaction";
import { compactThousands, monthlySeries, monthlyTooltip, TOOLTIP_STYLE } from "./chartFormat";

interface Props {
  data: MonthlyTotal[];
}

const AXIS_TICK = { fill: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10 };

export default function MonthlyTrendChart({ data }: Props) {
  const chartData = monthlySeries(data);

  if (chartData.length === 0) {
    return <p className="empty">Nenhum gasto no período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="monthlyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cyan)" stopOpacity={0.28} />
            <stop offset="1" stopColor="var(--cyan)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 4" vertical={false} />
        {/* Sem espaço para todos os meses, pula alguns, mas sempre mostra o primeiro e o último */}
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        {/* Largura para "4,5 mil" caber inteiro (com 48 cortava o começo) */}
        <YAxis tick={AXIS_TICK} tickFormatter={compactThousands} tickLine={false} axisLine={false} width={58} />
        <Tooltip
          formatter={monthlyTooltip}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "var(--muted)" }}
          cursor={{ stroke: "var(--line)", strokeDasharray: "3 3" }}
        />
        <Area
          type="linear"
          dataKey="total"
          stroke="var(--cyan)"
          strokeWidth={2.2}
          fill="url(#monthlyFill)"
          dot={{ r: 3.5, fill: "var(--bg)", stroke: "var(--cyan)", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: "var(--cyan)", stroke: "var(--bg)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

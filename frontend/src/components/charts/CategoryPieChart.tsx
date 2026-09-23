import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryTotal } from "../../types/transaction";
import { formatMoney } from "../../utils/format";
import { moneyTooltip, TOOLTIP_STYLE } from "./chartFormat";
import styles from "./Charts.module.css";

interface Props {
  data: CategoryTotal[];
  categoryColor: (name: string) => string;
}

// Da 6ª categoria em diante, junta tudo em "Outras (N)" para a rosca não virar confete
const MAX_SLICES = 5;

export default function CategoryPieChart({ data, categoryColor }: Props) {
  const sorted = data
    .map((d) => ({ name: d.category, value: Math.abs(d.total), color: categoryColor(d.category) }))
    .sort((a, b) => b.value - a.value);
  const rest = sorted.slice(MAX_SLICES);
  const slices =
    rest.length > 1
      ? [
          ...sorted.slice(0, MAX_SLICES),
          {
            name: `Outras (${rest.length})`,
            value: rest.reduce((sum, d) => sum + d.value, 0),
            color: "var(--cat-11)",
          },
        ]
      : sorted;
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (slices.length === 0) {
    return <p className="empty">Nenhum gasto categorizado no período.</p>;
  }

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={moneyTooltip}
              contentStyle={TOOLTIP_STYLE}
              itemStyle={{ color: "var(--text)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <span className={styles.donutCenter} aria-hidden="true">
          <small>Total de saídas</small>
          <b>{formatMoney(total)}</b>
        </span>
      </div>

      <ul className={styles.legend} aria-label="Gastos por categoria">
        {slices.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            <span>{s.name}</span>
            <span className={styles.value}>{formatMoney(s.value)}</span>
            <span className={styles.percent}>{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

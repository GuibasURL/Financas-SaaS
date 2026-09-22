import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyTotal } from "../../types/transaction";

interface Props {
  data: MonthlyTotal[];
}

export default function MonthlyTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    label: `${d.month}/${d.year}`,
    total: Math.abs(d.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="total" stroke="#0088FE" />
      </LineChart>
    </ResponsiveContainer>
  );
}

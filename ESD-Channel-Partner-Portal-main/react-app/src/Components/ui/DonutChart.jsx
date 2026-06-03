import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#ff6b00", "#a855f7", "#22c55e"];

const DonutChart = ({ residential, commercial, plots }) => {
  const data = [
    { name: "Residential", value: residential },
    { name: "Commercial", value: commercial },
    { name: "Plots", value: plots },
  ];

  const renderLabel = ({ name, percent }) => {
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={100}
          dataKey="value"
          label={renderLabel}
          labelLine={true}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
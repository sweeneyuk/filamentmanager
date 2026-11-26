import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function SuccessDonut({ success, failure }) {
  const total = success + failure;
  const rate = total ? Math.round((success / total) * 100) : 0;
  const data = [{ name: 'Success', value: success }, { name: 'Failed', value: failure }];
  return (
    <div className="an-donut">
      <div className="an-donut__chart" role="img" aria-label={`${rate}% of analysed prints succeeded`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              <Cell className="an-slice an-slice--ok" />
              <Cell className="an-slice an-slice--fail" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="an-donut__pct" aria-hidden="true">{rate}%</span>
      </div>
      <ul className="an-legend">
        <li><span className="an-key an-key--ok" aria-hidden="true" />Success {success}</li>
        <li><span className="an-key an-key--fail" aria-hidden="true" />Failed {failure}</li>
      </ul>
    </div>
  );
}

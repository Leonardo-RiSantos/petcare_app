import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

const CHART_HEIGHT = 160;
const PADDING_X = 40;
const PADDING_Y = 20;

export default function WeightChart({ records }) {
  if (!records || records.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Adicione pelo menos 2 registros para ver o gráfico</Text>
      </View>
    );
  }

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const weights = sorted.map(r => Number(r.weight_kg));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const rangeW = maxW - minW || 1;

  const chartW = 320;
  const innerW = chartW - PADDING_X * 2;
  const innerH = CHART_HEIGHT - PADDING_Y * 2;

  const toX = (i) => PADDING_X + (i / (sorted.length - 1)) * innerW;
  const toY = (w) => PADDING_Y + innerH - ((w - minW) / rangeW) * innerH;

  // Smooth line path
  const points = sorted.map((r, i) => ({ x: toX(i), y: toY(Number(r.weight_kg)) }));
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    pathD += ` C ${cp1x} ${points[i - 1].y}, ${cp1x} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }

  // Fill path
  const fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`;

  // Y-axis labels
  const yLabels = [minW, minW + rangeW / 2, maxW].map(w => ({
    y: toY(w),
    label: `${w.toFixed(1)}`,
  }));

  // X-axis labels (first, middle, last)
  const xIndices = [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <View style={styles.container}>
      <Svg width={chartW} height={CHART_HEIGHT + 24} viewBox={`0 0 ${chartW} ${CHART_HEIGHT + 24}`}>
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <Line key={i} x1={PADDING_X} y1={l.y} x2={chartW - 10} y2={l.y}
            stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
        ))}

        {/* Y labels */}
        {yLabels.map((l, i) => (
          <SvgText key={i} x={PADDING_X - 6} y={l.y + 4} textAnchor="end"
            fontSize="10" fill="#94A3B8">{l.label}</SvgText>
        ))}

        {/* Fill */}
        <Path d={fillD} fill="#BAE6FD" opacity="0.3" />

        {/* Line */}
        <Path d={pathD} stroke="#0EA5E9" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Points */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="4" fill="#0EA5E9" stroke="#fff" strokeWidth="2" />
        ))}

        {/* X labels */}
        {xIndices.map(i => {
          const date = sorted[i].date;
          const short = date.slice(5); // MM-DD
          return (
            <SvgText key={i} x={points[i].x} y={CHART_HEIGHT + 18}
              textAnchor="middle" fontSize="10" fill="#94A3B8">{short}</SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 8 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
});

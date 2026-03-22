import { html } from '../utils.js';

const R = 82;
const C = 2 * Math.PI * R;
const arcFraction = 290 / 360;
const arcLength = C * arcFraction;
const gapLength = C - arcLength;
const rotationDeg = 125;

const bgTransform = `rotate(${rotationDeg}deg)`;
const bgDasharray = `${arcLength} ${gapLength}`;

export function Gauge({ remaining, fraction }) {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const progressLength = arcLength * clamped;
  const restArc = C - progressLength;

  const progressDasharray = clamped <= 0.005
    ? `0 ${C}`
    : `${progressLength} ${restArc}`;

  const isOver = fraction > 1;
  const strokeColor = isOver ? '#ef5350' : '#66bb6a';
  const shadowColor = isOver
    ? 'drop-shadow(0 0 8px rgba(239,83,80,0.4))'
    : 'drop-shadow(0 0 8px rgba(102,187,106,0.4))';

  const circleStyle = {
    transform: bgTransform,
    transformOrigin: '100px 100px',
  };

  return html`
    <div class="gauge-section">
      <div class="gauge-container">
        <svg class="gauge-svg" viewBox="0 0 200 200">
          <circle
            class="gauge-bg"
            cx="100" cy="100" r="82"
            stroke-dasharray=${bgDasharray}
            stroke-dashoffset="0"
            style=${circleStyle}
          />
          <circle
            class="gauge-progress"
            cx="100" cy="100" r="82"
            stroke-dasharray=${progressDasharray}
            stroke-dashoffset="0"
            style=${{
              ...circleStyle,
              stroke: strokeColor,
              filter: shadowColor,
            }}
          />
        </svg>
        <div class="gauge-center">
          <div class="gauge-calories">${remaining}</div>
          <div class="gauge-label">осталось ккал</div>
        </div>
      </div>
    </div>
  `;
}

import { html } from '../utils.js';
import { useRef, useEffect } from 'https://esm.sh/preact@10/hooks';
import { Chart, registerables } from 'https://esm.sh/chart.js@4';
import { getTodayKey, offsetDateKey } from '../hooks/useFoods.js';

Chart.register(...registerables);

const DAYS_COUNT = 14;

function getLastDays(n) {
  const today = getTodayKey();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(offsetDateKey(today, -i));
  }
  return days;
}

function formatShort(dateKey) {
  const [, m, d] = dateKey.split('-');
  return `${d}.${m}`;
}

export function ChartScreen({ history, dailyGoal, onBack }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const days = getLastDays(DAYS_COUNT);
  const todayKey = getTodayKey();

  const values = days.map(key => {
    const foods = history[key] || [];
    return foods.reduce((sum, f) => sum + f.calories, 0);
  });

  const labels = days.map(key => {
    const label = formatShort(key);
    return key === todayKey ? label + ' ●' : label;
  });

  const barColors = values.map(v =>
    v === 0 ? 'rgba(60,60,60,0.6)' : v > dailyGoal ? 'rgba(239,83,80,0.85)' : 'rgba(102,187,106,0.85)'
  );

  const borderColors = values.map(v =>
    v === 0 ? 'rgba(80,80,80,0.4)' : v > dailyGoal ? '#ef5350' : '#66bb6a'
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    // Уничтожаем предыдущий экземпляр
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Калории',
            data: values,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            order: 2,
          },
          {
            type: 'line',
            label: 'Норма',
            data: Array(DAYS_COUNT).fill(dailyGoal),
            borderColor: 'rgba(239,83,80,0.8)',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 400 },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2a2a2a',
            titleColor: '#aaa',
            bodyColor: '#e0e0e0',
            borderColor: '#444',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label(ctx) {
                if (ctx.dataset.type === 'line') return `Норма: ${ctx.parsed.y} ккал`;
                return `${ctx.parsed.y} ккал`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: ctx2 => {
                const label = ctx2.tick.label;
                return typeof label === 'string' && label.includes('●') ? '#66bb6a' : '#555';
              },
              font: { size: 10 },
              maxRotation: 0,
            },
            grid: { color: '#1e1e1e' },
            border: { color: '#333' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#555',
              font: { size: 10 },
              maxTicksLimit: 5,
            },
            grid: { color: '#1e1e1e' },
            border: { color: '#333' },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // Статистика
  const daysWithData = values.filter(v => v > 0);
  const avg = daysWithData.length
    ? Math.round(daysWithData.reduce((s, v) => s + v, 0) / daysWithData.length)
    : null;
  const overDays = daysWithData.filter(v => v > dailyGoal).length;

  return html`
    <div class="chart-screen">
      <div class="chart-header">
        <button class="chart-back-btn" onClick=${onBack} aria-label="Назад">‹</button>
        <h1>График калорий</h1>
        <div style="width:40px"></div>
      </div>

      <div class="chart-body">
        <div class="chart-legend">
          <span class="chart-legend-goal">- - Норма: ${dailyGoal} ккал</span>
        </div>

        <div class="chart-svg-wrap">
          <canvas ref=${canvasRef}></canvas>
        </div>

        <div class="chart-summary">
          ${avg === null ? html`
            <p class="chart-no-data">Недостаточно данных</p>
          ` : html`
            <div class="chart-stat">
              <span class="chart-stat-label">Среднее за ${daysWithData.length} дн.</span>
              <span class="chart-stat-value">${avg} ккал</span>
            </div>
            <div class="chart-stat">
              <span class="chart-stat-label">Дней сверх нормы</span>
              <span class="chart-stat-value" style="color:${overDays > 0 ? '#ef5350' : '#66bb6a'}">${overDays}</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

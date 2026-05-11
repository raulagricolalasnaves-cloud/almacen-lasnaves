// =====================================================
//  GRÁFICAS — Chart.js
// =====================================================

let chartMovs = null, chartProds = null, chartStock = null;

async function cargarGraficas() {
  try {
    const [movs, prods] = await Promise.all([API.getMovimientos(200), API.getProductos()]);
    renderChartMovimientos(movs);
    renderChartProductos(movs);
    renderChartStock(prods);
  } catch (e) { toast('Error al cargar gráficas'); }
}

function renderChartMovimientos(movs) {
  const ctx = document.getElementById('chart-movimientos');
  if (!ctx) return;
  if (chartMovs) chartMovs.destroy();

  // Últimos 14 días
  const dias = [];
  const entradas = [], salidas = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const dayStr = d.toISOString().split('T')[0];
    dias.push(label);
    entradas.push(movs.filter(m => m.tipo === 'entrada' && m.created_at?.startsWith(dayStr)).length);
    salidas.push(movs.filter(m => m.tipo === 'salida'  && m.created_at?.startsWith(dayStr)).length);
  }

  chartMovs = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [
        { label: 'Entradas', data: entradas, backgroundColor: 'rgba(45,138,78,.7)', borderRadius: 4 },
        { label: 'Salidas',  data: salidas,  backgroundColor: 'rgba(192,57,43,.7)', borderRadius: 4 },
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

function renderChartProductos(movs) {
  const ctx = document.getElementById('chart-productos');
  if (!ctx) return;
  if (chartProds) chartProds.destroy();

  const conteo = {};
  movs.forEach(m => { conteo[m.nombre] = (conteo[m.nombre] || 0) + 1; });
  const sorted = Object.entries(conteo).sort((a,b) => b[1]-a[1]).slice(0,5);

  chartProds = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{ data: sorted.map(s => s[1]), backgroundColor: ['#2d8a4e','#0f2a5c','#d97706','#1a56db','#c0392b'], borderWidth: 2 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

function renderChartStock(prods) {
  const ctx = document.getElementById('chart-stock');
  if (!ctx) return;
  if (chartStock) chartStock.destroy();

  const top = prods.slice(0, 8);
  chartStock = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(p => p.nombre.length > 15 ? p.nombre.substring(0,15)+'…' : p.nombre),
      datasets: [
        { label: 'Stock actual', data: top.map(p => Number(p.stock)), backgroundColor: 'rgba(45,138,78,.7)', borderRadius: 4 },
        { label: 'Stock mínimo', data: top.map(p => Number(p.min)),   backgroundColor: 'rgba(192,57,43,.4)', borderRadius: 4 },
      ]
    },
    options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'top' } }, scales: { x: { beginAtZero: true } } }
  });
}

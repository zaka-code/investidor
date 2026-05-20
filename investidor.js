/* =============================================================
   INVESTIDOR.JS — CORTEX VISION
   Calculadora de Precificação — somente leitura para investidor
   ============================================================= */

// ──────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────
const STATE = {
  qtdRestaurantes: 4,
  taxaCambio: 7.00,
  encargos: 10,
  imposto: 15,
  precoVenda: 950,
  taxaVision: 2000,
  taxaControle: 2000,
  gpuShifts: 1,
  gpuHours: 6,
  gpuDays: 30,
};

const GPU_CAP      = 4;   // restaurantes por GPU
const VPS_CAP      = 20;  // restaurantes por VPS
const CAM_POR_REST = 3;   // câmeras por restaurante

// ──────────────────────────────────────────────
// ITENS DE INFRAESTRUTURA
// ──────────────────────────────────────────────
const infraItems = [
  { id: 'vps',         name: 'VPS: KVM 8',          value: 119.99, currency: 'BRL', billingType: 'month', shifts: 1, hoursPerShift: 1,  daysPerMonth: 30, type: 'vps',     locked: true },
  { id: 'gpu',         name: 'GPU: NVIDIA A4000',    value: 0.25,   currency: 'USD', billingType: 'hour',  shifts: 1, hoursPerShift: 6,  daysPerMonth: 30, type: 'gpu',     locked: true },
  { id: 'backblaze',   name: 'Storage: Backblaze',   value: 10.00,  currency: 'USD', billingType: 'month', shifts: 1, hoursPerShift: 1,  daysPerMonth: 30, type: 'storage', locked: true, gbPerGroup: 800, groupSize: 4 },
  { id: 'storage-gpu', name: 'Storage GPU (10 GB)',  value: 1.00,   currency: 'USD', billingType: 'month', shifts: 1, hoursPerShift: 1,  daysPerMonth: 30, type: 'gpu',     locked: true },
  { id: 'ip-gpu',      name: 'IP Público GPU',       value: 5.00,   currency: 'USD', billingType: 'month', shifts: 1, hoursPerShift: 1,  daysPerMonth: 30, type: 'gpu',     locked: true },
];

// ──────────────────────────────────────────────
// ITENS DE EQUIPE
// ──────────────────────────────────────────────
const equipeItems = [
  { id: 'devops',      name: 'DevOps (Apoio)', value: 1500.00, currency: 'BRL', billingType: 'month', shifts: 1, hoursPerShift: 1, daysPerMonth: 30, type: 'fixed', locked: true },
  { id: 'secretaria',  name: 'Secretaria',     value:  700.00, currency: 'BRL', billingType: 'month', shifts: 1, hoursPerShift: 1, daysPerMonth: 30, type: 'fixed', locked: true },
];

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const fmt    = (v)              => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toBRL  = (value, cur)     => cur === 'USD' ? value * STATE.taxaCambio : value;
const qtdGPUs = ()              => Math.ceil(STATE.qtdRestaurantes / GPU_CAP);
const qtdVPSs = ()              => Math.ceil(STATE.qtdRestaurantes / VPS_CAP);

function calcMonthlyBase(item) {
  const v = parseFloat(item.value) || 0;
  if (item.billingType === 'year')  return v / 12;
  if (item.billingType === 'day')   return v * (item.daysPerMonth || 30);
  if (item.billingType === 'hour')  return v * (item.shifts || 1) * (item.hoursPerShift || 1) * (item.daysPerMonth || 30);
  return v; // month
}

function calcVPSTotal(unitBRL) {
  const n = STATE.qtdRestaurantes;
  const qtdVPS = qtdVPSs();
  if (n === 0 || qtdVPS === 0) return 0;
  let total = 0;
  for (let i = 0; i < qtdVPS; i++) {
    const served = Math.min((i + 1) * VPS_CAP, n) - (i * VPS_CAP + 1) + 1;
    total += (unitBRL / VPS_CAP) * served;
  }
  return total;
}

function calcStorageTotal(item, monthlyBaseBRL) {
  const n = STATE.qtdRestaurantes;
  const totalGB = Math.ceil(n / (item.groupSize || 4)) * (item.gbPerGroup || 800);
  return (totalGB / 1024) * monthlyBaseBRL;
}

function gerarDescricao(item) {
  const v     = item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const moeda = item.currency === 'USD' ? '$' : 'R$';
  const base  = `${moeda}${v}`;
  if (item.billingType === 'year') return `${base} por ano`;
  if (item.billingType === 'day')  return `${base}/dia × ${item.daysPerMonth} dias/mês`;
  if (item.billingType === 'hour') return `${base}/h × ${item.shifts}t × ${item.hoursPerShift}h × ${item.daysPerMonth}d`;
  return `${base} por mês`;
}

// ──────────────────────────────────────────────
// CÁLCULO PRINCIPAL
// ──────────────────────────────────────────────
function calcular() {
  const n    = STATE.qtdRestaurantes;
  if (n <= 0) return;

  // Atualiza GPU dinamicamente com os parâmetros do usuário
  const gpuItem = infraItems.find(i => i.id === 'gpu');
  if (gpuItem) {
    gpuItem.shifts       = STATE.gpuShifts;
    gpuItem.hoursPerShift= STATE.gpuHours;
    gpuItem.daysPerMonth = STATE.gpuDays;
  }

  const gpus = qtdGPUs();
  const vpss = qtdVPSs();

  // Infra
  let totalInfraBRL = 0;
  const detalheInfra = [];

  for (const item of infraItems) {
    const base = toBRL(calcMonthlyBase(item), item.currency);
    let total  = 0;
    let nota   = '';

    if      (item.type === 'vps')         { total = calcVPSTotal(base); nota = `${vpss} VPS`; }
    else if (item.type === 'gpu')         { total = base * gpus; nota = `${gpus} GPU${gpus > 1 ? 's' : ''}`; }
    else if (item.type === 'storage')     { total = calcStorageTotal(item, base); const gb = Math.ceil(n/(item.groupSize||4))*(item.gbPerGroup||800); nota = `${gb} GB`; }
    else if (item.type === 'restaurante') { total = base * n; nota = `${n} restaurante(s)`; }
    else                                  { total = base; nota = gerarDescricao(item); }

    totalInfraBRL += total;
    detalheInfra.push({ name: item.name, nota, total });
  }

  // Equipe
  let totalEquipeBRL = 0;
  for (const item of equipeItems) {
    const base = toBRL(calcMonthlyBase(item), item.currency);
    totalEquipeBRL += item.type === 'restaurante' ? base * n : base;
  }

  // Cálculos financeiros
  const subtotal      = totalInfraBRL + totalEquipeBRL;
  const encargo       = subtotal * (STATE.encargos / 100);
  const receitaTotal  = STATE.precoVenda * n;
  const imposto       = receitaTotal * (STATE.imposto / 100);
  const total         = subtotal + encargo + imposto;

  const porRestaurante     = n > 0 ? total / n : 0;
  const porCamera          = porRestaurante / CAM_POR_REST;
  const lucroTotal         = receitaTotal - total;
  const lucroPorRestaurante= n > 0 ? lucroTotal / n : 0;
  const margem             = STATE.precoVenda > 0 ? (lucroPorRestaurante / STATE.precoVenda) * 100 : 0;
  const implementacaoTotal = (STATE.taxaVision + STATE.taxaControle) * n;

  updateDOM({ totalInfraBRL, totalEquipeBRL, subtotal, encargo, imposto, total,
              porRestaurante, porCamera, lucroTotal, lucroPorRestaurante, margem,
              implementacaoTotal, detalheInfra, gpus, vpss, n });
}

// ──────────────────────────────────────────────
// ATUALIZAR DOM
// ──────────────────────────────────────────────
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function updateDOM(r) {
  set('val-por-restaurante', fmt(r.porRestaurante));
  set('val-por-camera',      fmt(r.porCamera) + ' / câmera');
  set('val-margem-liquida',  r.margem.toFixed(1) + '%');
  set('val-margem-lucro',    fmt(r.lucroPorRestaurante) + ' / restaurante');
  set('val-infra',           fmt(r.totalInfraBRL));
  set('val-equipe',          fmt(r.totalEquipeBRL));
  set('val-subtotal',        fmt(r.subtotal));
  set('val-encargo',         fmt(r.encargo));
  set('val-imposto',         fmt(r.imposto));
  set('val-total',           fmt(r.total));

  set('label-encargos-pct',  STATE.encargos);
  set('label-imposto-pct',   STATE.imposto);

  set('metric-restaurante',  fmt(r.porRestaurante));
  set('metric-camera',       fmt(r.porCamera));
  set('metric-encargo',      fmt(r.encargo));
  set('metric-imposto',      fmt(r.imposto));
  set('metric-qtd-rest',     `${r.n} restaurante${r.n !== 1 ? 's' : ''}`);
  set('metric-encargo-pct',  `${STATE.encargos}% do subtotal`);
  set('metric-imposto-pct',  `${STATE.imposto}% da Receita Bruta`);

  set('metric-lucro-rest',   fmt(r.lucroPorRestaurante));
  set('metric-lucro-total',  fmt(r.lucroTotal));
  set('metric-margem',       `Margem: ${r.margem.toFixed(1)}%`);

  set('val-implementacao-total', fmt(r.implementacaoTotal));

  // Resource badges
  document.getElementById('resource-summary').innerHTML = `
    <div class="res-badge"><div class="res-badge-icon">⚡</div><div class="res-badge-val">${r.gpus}</div><div class="res-badge-label">GPU${r.gpus !== 1 ? 's' : ''}</div></div>
    <div class="res-badge"><div class="res-badge-icon">🖥️</div><div class="res-badge-val">${r.vpss}</div><div class="res-badge-label">VPS</div></div>
    <div class="res-badge"><div class="res-badge-icon">📷</div><div class="res-badge-val">${r.n * CAM_POR_REST}</div><div class="res-badge-label">Câmeras</div></div>
  `;

  // Infraestrutura — só total
  const infraDisplay = document.getElementById('infra-total-display');
  if (infraDisplay) infraDisplay.textContent = fmt(r.totalInfraBRL);

  // Equipe — só total
  const equipeDisplay = document.getElementById('equipe-total-display');
  if (equipeDisplay) equipeDisplay.textContent = fmt(r.totalEquipeBRL);

  const equipeBadge = document.getElementById('equipe-count-badge');
  if (equipeBadge) {
    const count = equipeItems.length;
    equipeBadge.textContent = `👤 ${count} membro${count !== 1 ? 's' : ''} da equipe`;
  }
}

// ──────────────────────────────────────────────
// BIND INPUTS
// ──────────────────────────────────────────────
function bindInputs() {
  const bind = (id, prop, isInt = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      STATE[prop] = isInt ? Math.max(1, parseInt(this.value) || 1) : (parseFloat(this.value) || 0);
      calcular();
    });
  };
  bind('qtd-restaurantes', 'qtdRestaurantes', true);
  bind('encargos',         'encargos');
  bind('imposto',          'imposto');
  bind('preco-venda',      'precoVenda');
  bind('taxa-vision',      'taxaVision');
  bind('taxa-controle',    'taxaControle');
  bind('gpu-turnos',       'gpuShifts',  true);
  bind('gpu-horas',        'gpuHours',   true);
  bind('gpu-dias',         'gpuDays',    true);
}

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────
function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');

  if (email === 'camilatanizaka@gmail.com' && pass === '22394') {
    errEl.classList.remove('visible');
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
  } else {
    errEl.classList.add('visible');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-container').style.display !== 'none') {
    handleLogin();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  bindInputs();
  calcular();
});

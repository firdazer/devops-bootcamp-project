import './style.css';
import {
  EC2,
  REGIONS,
  PRICING_MODES,
  S3_STORAGE_CLASSES,
  EBS_PRICING,
  RDS_PRICING,
  RDS_ENGINES,
  FREE_TIER,
  ec2MonthlyCost,
  s3MonthlyCost,
  ebsMonthlyCost,
  rdsMonthlyCost,
  getDataTransferPrice,
} from './pricing-data.js';

const state = {
  region: 'ap-southeast-1',
  currency: 'USD',
  ec2: [],
  s3: [],
  ebs: [],
  rds: [],
  transferGb: 0,
};

const EXCHANGE_RATES = { USD: 1, MYR: 4.35 };

let uid = 0;
const nextUid = () => ++uid;

function swapCurrency(totalUSD) {
  const rate = EXCHANGE_RATES[state.currency] || 1;
  return { value: totalUSD * rate, symbol: state.currency === 'MYR' ? 'RM' : '$' };
}

function fmtMoney(usd) {
  const { value, symbol } = swapCurrency(usd);
  return symbol + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── UI helpers ──────────────────────────────────────────────
function $el(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

function sel(options, selected, label) {
  const s = document.createElement('select');
  s.className = 'input';
  if (label) s.setAttribute('aria-label', label);
  for (const [value, text] of Object.entries(options)) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    if (value === selected) o.selected = true;
    s.appendChild(o);
  }
  return s;
}

function inputNum(value, min = 0, step = 1) {
  const i = document.createElement('input');
  i.type = 'number';
  i.className = 'input';
  i.min = min;
  i.step = step;
  i.value = value;
  return i;
}

// ── Region / currency setup ─────────────────────────────────
function setupRegion() {
  const regionSel = document.getElementById('region');
  for (const [code, name] of Object.entries(REGIONS)) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = `${name} (${code})`;
    if (code === state.region) o.selected = true;
    regionSel.appendChild(o);
  }
  regionSel.addEventListener('change', () => {
    state.region = regionSel.value;
    renderAll();
  });

  const curSel = document.getElementById('currency');
  curSel.addEventListener('change', () => {
    state.currency = curSel.value;
    renderAll();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    state.ec2 = [];
    state.s3 = [];
    state.ebs = [];
    state.rds = [];
    state.transferGb = 0;
    document.getElementById('transfer-gb').value = 0;
    renderAll();
  });

  document.getElementById('share-btn').addEventListener('click', copyShareLink);
}

// ── Tabs ────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// ── EC2 ─────────────────────────────────────────────────────
function renderEc2(container) {
  container = container || document.getElementById('compute-items');
  container.innerHTML = '';
  state.ec2.forEach(item => {
    const row = $el('div', { class: 'item-row' });

    const instanceSel = document.createElement('select');
    instanceSel.className = 'input';
    for (const k of Object.keys(EC2)) {
      const o = document.createElement('option');
      o.value = k;
      const s = EC2[k];
      o.textContent = `${k} — ${s.vcpu} vCPU / ${s.mem} GiB${s.graviton ? ' (Graviton)' : ''}`;
      if (k === item.instanceType) o.selected = true;
      instanceSel.appendChild(o);
    }
    instanceSel.addEventListener('change', () => { item.instanceType = instanceSel.value; renderEc2(); });

    const modeSel = sel(Object.fromEntries(Object.entries(PRICING_MODES)), item.mode);
    modeSel.addEventListener('change', () => { item.mode = modeSel.value; renderEc2(); });

    const qty = inputNum(item.quantity, 1, 1);
    qty.addEventListener('change', () => {
      item.quantity = Math.max(1, parseInt(qty.value, 10) || 1);
      renderEc2();
    });

    const monthly = ec2MonthlyCost(item.instanceType, state.region, item.quantity, item.mode);
    const costEl = $el('span', { class: 'row-cost' }, `${fmtMoney(monthly)}/mo`);

    const removeBtn = $el('button', { class: 'btn btn-sm btn-danger', html: 'Remove' });
    removeBtn.addEventListener('click', () => {
      state.ec2 = state.ec2.filter(e => e.id !== item.id);
      renderEc2();
    });

    row.appendChild(instanceSel);
    row.appendChild(modeSel);
    row.appendChild($el('div', { class: 'row-qty' }, ['×', qty]));
    row.appendChild(costEl);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  if (state.ec2.length === 0) {
    container.appendChild($el('p', { class: 'empty', html: '<em>No EC2 instances added. Add one below.</em>' }));
  }
}

// ── S3 ──────────────────────────────────────────────────────
function renderS3(container) {
  container = container || document.getElementById('s3-items');
  container.innerHTML = '';
  state.s3.forEach(item => {
    const row = $el('div', { class: 'item-row' });
    const name = inputNum(item.gb, 0, 1);
    name.placeholder = 'Storage (GB)';
    name.addEventListener('change', () => { item.gb = Math.max(0, parseFloat(name.value) || 0); renderS3(); });

    const clsSel = sel(Object.fromEntries(Object.entries(S3_STORAGE_CLASSES)), item.storageClass);
    clsSel.addEventListener('change', () => { item.storageClass = clsSel.value; renderS3(); });

    const monthly = s3MonthlyCost(state.region, item.storageClass, item.gb);
    const costEl = $el('span', { class: 'row-cost' }, `${fmtMoney(monthly)}/mo`);

    const removeBtn = $el('button', { class: 'btn btn-sm btn-danger', html: 'Remove' });
    removeBtn.addEventListener('click', () => {
      state.s3 = state.s3.filter(e => e.id !== item.id);
      renderS3();
    });

    row.appendChild(name);
    row.appendChild(clsSel);
    row.appendChild(costEl);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  if (state.s3.length === 0) {
    container.appendChild($el('p', { class: 'empty', html: '<em>No S3 buckets added.</em>' }));
  }
}

// ── EBS ─────────────────────────────────────────────────────
function renderEbs(container) {
  container = container || document.getElementById('ebs-items');
  container.innerHTML = '';
  state.ebs.forEach(item => {
    const row = $el('div', { class: 'item-row' });
    const size = inputNum(item.gb, 1, 1);
    size.placeholder = 'Size (GB)';
    size.addEventListener('change', () => { item.gb = Math.max(1, parseFloat(size.value) || 1); renderEbs(); });

    const typeSel = sel(Object.fromEntries(EBS_PRICING.map(v => [v.type, v.name])), item.volumeType);
    typeSel.addEventListener('change', () => { item.volumeType = typeSel.value; renderEbs(); });

    const monthly = ebsMonthlyCost(item.volumeType, item.gb, item.iops || 0);
    const costEl = $el('span', { class: 'row-cost' }, `${fmtMoney(monthly)}/mo`);

    const removeBtn = $el('button', { class: 'btn btn-sm btn-danger', html: 'Remove' });
    removeBtn.addEventListener('click', () => {
      state.ebs = state.ebs.filter(e => e.id !== item.id);
      renderEbs();
    });

    row.appendChild($el('label', { class: 'row-field' }, [typeSel]));
    row.appendChild(size);
    row.appendChild(costEl);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  if (state.ebs.length === 0) {
    container.appendChild($el('p', { class: 'empty', html: '<em>No EBS volumes added.</em>' }));
  }
}

// ── RDS ─────────────────────────────────────────────────────
function renderRds(container) {
  container = container || document.getElementById('rds-items');
  container.innerHTML = '';
  state.rds.forEach(item => {
    const row = $el('div', { class: 'item-row' });
    const instSel = sel(Object.fromEntries(Object.keys(RDS_PRICING).map(k => [k, k])), item.instanceType);
    instSel.addEventListener('change', () => { item.instanceType = instSel.value; renderRds(); });

    const qty = inputNum(item.quantity, 1, 1);
    qty.addEventListener('change', () => { item.quantity = Math.max(1, parseInt(qty.value, 10) || 1); renderRds(); });

    const azCheck = $el('input', { type: 'checkbox' });
    azCheck.checked = Boolean(item.multiAZ);
    const azLabel = $el('label', { class: 'checkbox-label' }, ['Multi-AZ', azCheck]);
    azCheck.addEventListener('change', () => { item.multiAZ = azCheck.checked; renderRds(); });

    const monthly = rdsMonthlyCost(item.instanceType, state.region, item.quantity, item.multiAZ);
    const costEl = $el('span', { class: 'row-cost' }, `${fmtMoney(monthly)}/mo`);

    const removeBtn = $el('button', { class: 'btn btn-sm btn-danger', html: 'Remove' });
    removeBtn.addEventListener('click', () => {
      state.rds = state.rds.filter(e => e.id !== item.id);
      renderRds();
    });

    row.appendChild(instSel);
    row.appendChild(qty);
    row.appendChild(azLabel);
    row.appendChild(costEl);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  if (state.rds.length === 0) {
    container.appendChild($el('p', { class: 'empty', html: '<em>No RDS instances added.</em>' }));
  }
}

// ── Transfer ────────────────────────────────────────────────
function setupTransfer() {
  const input = document.getElementById('transfer-gb');
  input.addEventListener('change', () => {
    state.transferGb = Math.max(0, parseFloat(input.value) || 0);
    renderAll();
  });
}

// ── Summary ─────────────────────────────────────────────────
function computeSummary() {
  const totals = { ec2: 0, s3: 0, ebs: 0, rds: 0, transfer: 0 };
  state.ec2.forEach(i => totals.ec2 += ec2MonthlyCost(i.instanceType, state.region, i.quantity, i.mode));
  state.s3.forEach(i => totals.s3 += s3MonthlyCost(state.region, i.storageClass, i.gb));
  state.ebs.forEach(i => totals.ebs += ebsMonthlyCost(i.volumeType, i.gb, i.iops));
  state.rds.forEach(i => totals.rds += rdsMonthlyCost(i.instanceType, state.region, i.quantity, i.multiAZ));
  totals.transfer = getDataTransferPrice(state.transferGb);
  return totals;
}

function renderSummary() {
  const costsEl = document.getElementById('summary-costs');
  const totalEl = document.getElementById('summary-total');
  costsEl.innerHTML = '';
  totalEl.innerHTML = '';

  const totals = computeSummary();
  const labels = {
    ec2: 'EC2 Compute',
    s3: 'S3 Storage',
    ebs: 'EBS Volumes',
    rds: 'RDS Databases',
    transfer: 'Data Transfer',
  };

  let grandTotal = 0;
  for (const [key, label] of Object.entries(labels)) {
    grandTotal += totals[key];
    if (totals[key] > 0) {
      costsEl.appendChild($el('div', { class: 'summary-row' }, [
        $el('span', {}, label),
        $el('span', { class: 'row-cost' }, fmtMoney(totals[key])),
      ]));
    }
  }

  if (grandTotal === 0) {
    costsEl.appendChild($el('p', { class: 'empty', html: '<em>Add services to see a cost estimate.</em>' }));
  }

  const box = $el('div', { class: 'summary-box' }, [
    $el('div', { class: 'summary-box-label' }, 'Estimated Monthly Total'),
    $el('div', { class: 'summary-box-value' }, fmtMoney(grandTotal)),
    $el('div', { class: 'summary-box-sub' }, [
      `${fmtMoney(grandTotal / 30)}/day`,
      ' · ',
      `${fmtMoney(grandTotal * 12)}/year`,
    ]),
  ]);
  totalEl.appendChild(box);

  // Free tier note
  const note = document.getElementById('free-tier-note');
  const freeHints = [];
  if (state.ec2.length && totals.ec2 === 0) freeHints.push('EC2 fits within Free Tier (750h t3.micro/t4g.micro).');
  if (state.ec2.length && totals.ec2 > 0) freeHints.push(`EC2 estimate exceeds Free Tier (${FREE_TIER.ec2.note}).`);
  if (totals.s3 === 0 && state.s3.length) freeHints.push('S3 usage fits within Free Tier (5 GB).');
  if (totals.ebs === 0 && state.ebs.length) freeHints.push('EBS fits within Free Tier (30 GB).');
  if (state.transferGb > 0 && totals.transfer === 0) freeHints.push('Data transfer fits within Free Tier (100 GB).');

  if (freeHints.length) {
    note.classList.remove('hidden');
    note.innerHTML = '<strong>Free Tier:</strong> ' + freeHints.join(' ');
  } else {
    note.classList.add('hidden');
  }
}

// ── Share link ──────────────────────────────────────────────
function buildShareLink() {
  const params = new URLSearchParams();
  params.set('region', state.region);
  params.set('cur', state.currency);
  state.ec2.forEach((e, i) => params.set(`ec2[${i}]`, `${e.instanceType}|${e.quantity}|${e.mode}`));
  state.s3.forEach((e, i) => params.set(`s3[${i}]`, `${e.gb}|${e.storageClass}`));
  state.ebs.forEach((e, i) => params.set(`ebs[${i}]`, `${e.gb}|${e.volumeType}`));
  state.rds.forEach((e, i) => params.set(`rds[${i}]`, `${e.instanceType}|${e.quantity}|${e.multiAZ}`));
  params.set('dt', state.transferGb);
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

async function copyShareLink() {
  const link = buildShareLink();
  try {
    await navigator.clipboard.writeText(link);
    const btn = document.getElementById('share-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Share Link'; }, 1500);
  } catch {
    window.prompt('Copy this share link:', link);
  }
}

function loadShareLink() {
  const params = new URLSearchParams(location.search);
  if (params.get('region')) state.region = params.get('region');
  if (params.get('cur')) state.currency = params.get('cur');
  if (params.get('dt')) state.transferGb = parseFloat(params.get('dt')) || 0;

  let i = 0;
  while (params.get(`ec2[${i}]`)) {
    const [type, q, mode] = params.get(`ec2[${i}]`).split('|');
    state.ec2.push({ id: nextUid(), instanceType: type, quantity: parseInt(q, 10) || 1, mode });
    i++;
  }
  i = 0;
  while (params.get(`s3[${i}]`)) {
    const [gb, cls] = params.get(`s3[${i}]`).split('|');
    state.s3.push({ id: nextUid(), gb: parseFloat(gb) || 0, storageClass: cls });
    i++;
  }
  i = 0;
  while (params.get(`ebs[${i}]`)) {
    const [gb, type] = params.get(`ebs[${i}]`).split('|');
    state.ebs.push({ id: nextUid(), gb: parseFloat(gb) || 1, volumeType: type });
    i++;
  }
  i = 0;
  while (params.get(`rds[${i}]`)) {
    const [type, q, az] = params.get(`rds[${i}]`).split('|');
    state.rds.push({ id: nextUid(), instanceType: type, quantity: parseInt(q, 10) || 1, multiAZ: az === 'true' });
    i++;
  }

  document.getElementById('transfer-gb').value = state.transferGb;
}

// ── Render all ──────────────────────────────────────────────
function renderAll() {
  renderEc2();
  renderS3();
  renderEbs();
  renderRds();
  renderSummary();
  const shareBtn = document.getElementById('share-btn');
  if (state.ec2.length || state.s3.length || state.ebs.length || state.rds.length || state.transferGb > 0) {
    shareBtn.disabled = false;
  } else {
    shareBtn.disabled = true;
  }
}

// ── Add buttons ─────────────────────────────────────────────
function setupAddButtons() {
  document.getElementById('add-ec2').addEventListener('click', () => {
    state.ec2.push({ id: nextUid(), instanceType: 't4g.micro', quantity: 1, mode: 'ondemand' });
    renderAll();
    document.querySelector('.tab[data-tab="compute"]').click();
  });
  document.getElementById('add-s3').addEventListener('click', () => {
    state.s3.push({ id: nextUid(), gb: 10, storageClass: 'standard' });
    renderAll();
  });
  document.getElementById('add-ebs').addEventListener('click', () => {
    state.ebs.push({ id: nextUid(), gb: 16, volumeType: 'gp3', iops: 3000 });
    renderAll();
  });
  document.getElementById('add-rds').addEventListener('click', () => {
    state.rds.push({ id: nextUid(), instanceType: 'db.t4g.micro', quantity: 1, multiAZ: false });
    renderAll();
  });
}

// ── Init ────────────────────────────────────────────────────
function init() {
  loadShareLink();
  setupRegion();
  setupTabs();
  setupTransfer();
  setupAddButtons();
  renderAll();
}

init();


const state = {
  settings: {
    electricity_cost_per_kwh: 0,
    printer_power_kw: 0.3,
    default_margin_percent: 20,
  },
  printers: [],
  filamentTypes: [],
  filamentManufacturers: [],
  filaments: [],
  calculations: [],
  selectedCalculationId: null,
  selectedFilamentIds: [],
  ui: {
    leftCollapsed: false,
    rightCollapsed: false,
    deleteModalOpen: false,
    filamentDropdownOpen: false,
    filamentDeleteModalOpen: false,
    filamentInUseModalOpen: false,
    pendingFilamentDeleteId: null,
    pendingFilamentDeleteName: '',
  },
};

const PANEL_STATE_STORAGE_KEY = 'panel_fold_state_v1';

function loadPanelState() {
  try {
    const raw = localStorage.getItem(PANEL_STATE_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.leftCollapsed === 'boolean') {
      state.ui.leftCollapsed = parsed.leftCollapsed;
    }
    if (typeof parsed.rightCollapsed === 'boolean') {
      state.ui.rightCollapsed = parsed.rightCollapsed;
    }
  } catch (_error) {
    // ignore storage errors
  }
}

function savePanelState() {
  try {
    localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify({
      leftCollapsed: state.ui.leftCollapsed,
      rightCollapsed: state.ui.rightCollapsed,
    }));
  } catch (_error) {
    // ignore storage errors
  }
}
const el = {
  appShell: document.getElementById('appShell'),
  leftPanel: document.getElementById('leftPanel'),
  rightPanel: document.getElementById('rightPanel'),
  toggleLeftPanelBtn: document.getElementById('toggleLeftPanelBtn'),
  toggleRightPanelBtn: document.getElementById('toggleRightPanelBtn'),
  savedList: document.getElementById('savedList'),
  newCalculationBtn: document.getElementById('newCalculationBtn'),
  electricityCost: document.getElementById('electricityCost'),
  printerPowerW: document.getElementById('printerPowerW'),
  defaultMargin: document.getElementById('defaultMargin'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),

  calcPrinter: document.getElementById('calcPrinter'),

  newPrinterName: document.getElementById('newPrinterName'),
  newPrinterPowerW: document.getElementById('newPrinterPowerW'),
  addPrinterBtn: document.getElementById('addPrinterBtn'),
  printerList: document.getElementById('printerList'),

  newFilamentTypeName: document.getElementById('newFilamentTypeName'),
  addFilamentTypeBtn: document.getElementById('addFilamentTypeBtn'),
  filamentTypeList: document.getElementById('filamentTypeList'),

  newFilamentManufacturerName: document.getElementById('newFilamentManufacturerName'),
  addFilamentManufacturerBtn: document.getElementById('addFilamentManufacturerBtn'),
  filamentManufacturerList: document.getElementById('filamentManufacturerList'),

  newFilamentManufacturer: document.getElementById('newFilamentManufacturer'),
  newFilamentType: document.getElementById('newFilamentType'),
  newFilamentColor: document.getElementById('newFilamentColor'),
  newFilamentCost: document.getElementById('newFilamentCost'),
  addFilamentBtn: document.getElementById('addFilamentBtn'),
  filamentList: document.getElementById('filamentList'),

  calcName: document.getElementById('calcName'),
  printTimeHours: document.getElementById('printTimeHours'),
  printTimeMinutes: document.getElementById('printTimeMinutes'),
  filamentMultiSelect: document.getElementById('filamentMultiSelect'),
  filamentDropdownBtn: document.getElementById('filamentDropdownBtn'),
  filamentDropdownMenu: document.getElementById('filamentDropdownMenu'),
  selectAllFilamentsBtn: document.getElementById('selectAllFilamentsBtn'),
  selectNoneFilamentsBtn: document.getElementById('selectNoneFilamentsBtn'),
  filamentCheckboxList: document.getElementById('filamentCheckboxList'),
  filamentUsed: document.getElementById('filamentUsed'),
  marginOverride: document.getElementById('marginOverride'),
  additionalComments: document.getElementById('additionalComments'),
  modelUrl: document.getElementById('modelUrl'),
  filamentCostOut: document.getElementById('filamentCostOut'),
  electricityCostOut: document.getElementById('electricityCostOut'),
  totalCostOut: document.getElementById('totalCostOut'),
  finalPriceOut: document.getElementById('finalPriceOut'),
  calcUpdatedInfo: document.getElementById('calcUpdatedInfo'),
  saveCalculationBtn: document.getElementById('saveCalculationBtn'),
  deleteCalculationBtn: document.getElementById('deleteCalculationBtn'),
  status: document.getElementById('status'),
  deleteModal: document.getElementById('deleteModal'),
  deleteModalText: document.getElementById('deleteModalText'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  filamentDeleteModal: document.getElementById('filamentDeleteModal'),
  filamentDeleteModalText: document.getElementById('filamentDeleteModalText'),
  cancelFilamentDeleteBtn: document.getElementById('cancelFilamentDeleteBtn'),
  confirmFilamentDeleteBtn: document.getElementById('confirmFilamentDeleteBtn'),
  filamentInUseModal: document.getElementById('filamentInUseModal'),
  filamentInUseText: document.getElementById('filamentInUseText'),
  filamentInUseList: document.getElementById('filamentInUseList'),
  closeFilamentInUseBtn: document.getElementById('closeFilamentInUseBtn'),
};

function setStatus(message, type = '') {
  el.status.textContent = message;
  el.status.className = `status ${type}`.trim();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function parseLocaleDecimal(value) {
  const raw = String(value || '').trim().replace(',', '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatFilamentCostInput(value) {
  return formatMoney(value);
}

function formatPowerW(valueKw) {
  return Math.round(Number(valueKw || 0) * 1000);
}

function getIconSvg(name) {
  const icons = {
    save: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h7.793a1.5 1.5 0 0 1 1.06.44l2.207 2.207A1.5 1.5 0 0 1 15 3.707V14.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 2 14.5v-13zM3.5 1a.5.5 0 0 0-.5.5V14.5a.5.5 0 0 0 .5.5H4V9.5A1.5 1.5 0 0 1 5.5 8h5A1.5 1.5 0 0 1 12 9.5V15h1.5a.5.5 0 0 0 .5-.5V3.707a.5.5 0 0 0-.146-.353L11.646 1.146A.5.5 0 0 0 11.293 1H10v3.5A1.5 1.5 0 0 1 8.5 6h-3A1.5 1.5 0 0 1 4 4.5V1h-.5zM5 1v3.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V1H5zm6 14V9.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V15h6z"/></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5A.5.5 0 0 0 7.5 6v6a.5.5 0 0 0 1 0V6A.5.5 0 0 0 8 5.5zm2 .5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2H5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h2.5a1 1 0 0 1 1 1zM6 2a.5.5 0 0 0-.5.5V3h5v-.5A.5.5 0 0 0 10 2H6zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z"/></svg>'
  };
  return icons[name] || '';
}

function syncPanelUI() {
  el.appShell.classList.toggle('left-collapsed', state.ui.leftCollapsed);
  el.appShell.classList.toggle('right-collapsed', state.ui.rightCollapsed);

  el.leftPanel.classList.toggle('is-collapsed', state.ui.leftCollapsed);
  el.rightPanel.classList.toggle('is-collapsed', state.ui.rightCollapsed);

  el.toggleLeftPanelBtn.textContent = state.ui.leftCollapsed ? '\u25B6' : '\u25C0';
  el.toggleLeftPanelBtn.title = state.ui.leftCollapsed ? 'Unfold left panel' : 'Fold left panel';
  el.toggleLeftPanelBtn.setAttribute('aria-label', el.toggleLeftPanelBtn.title);

  el.toggleRightPanelBtn.textContent = state.ui.rightCollapsed ? '\u25C0' : '\u25B6';
  el.toggleRightPanelBtn.title = state.ui.rightCollapsed ? 'Unfold right panel' : 'Fold right panel';
  el.toggleRightPanelBtn.setAttribute('aria-label', el.toggleRightPanelBtn.title);

  savePanelState();
}

function setupRightPanelCardFolding() {
  const cards = el.rightPanel.querySelectorAll('.card');

  cards.forEach((card) => {
    if (card.dataset.collapsibleInit === '1') {
      return;
    }
    card.dataset.collapsibleInit = '1';

    let header = card.querySelector(':scope > .section-header');
    if (!header) {
      const heading = card.querySelector(':scope > h2');
      if (!heading) {
        return;
      }
      header = document.createElement('div');
      header.className = 'section-header';
      card.insertBefore(header, heading);
      header.appendChild(heading);
    }

    const content = document.createElement('div');
    content.className = 'card-collapsible-content';

    Array.from(card.children).forEach((child) => {
      if (child !== header) {
        content.appendChild(child);
      }
    });
    card.appendChild(content);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-icon card-toggle-btn';

    const syncToggleState = () => {
      const collapsed = card.classList.contains('is-collapsed');
      toggleBtn.textContent = collapsed ? '\u25B8' : '\u25BE';
      toggleBtn.setAttribute('aria-label', collapsed ? 'Expand section' : 'Collapse section');
      toggleBtn.title = collapsed ? 'Expand section' : 'Collapse section';
    };

    const toggleCard = () => {
      card.classList.toggle('is-collapsed');
      syncToggleState();
    };

    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCard();
    });

    header.addEventListener('click', (event) => {
      if (event.target === toggleBtn || toggleBtn.contains(event.target)) {
        return;
      }
      toggleCard();
    });

    header.appendChild(toggleBtn);

    card.classList.add('collapsible-card', 'is-collapsed');
    syncToggleState();
  });
}
function normalizeTimePart(value, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.floor(numeric)));
}

function getPrintTimeHoursFromForm() {
  const hours = normalizeTimePart(el.printTimeHours.value || 0, 99);
  const minutes = normalizeTimePart(el.printTimeMinutes.value || 0, 59);
  return hours + (minutes / 60);
}

function setPrintTimeFields(totalHours) {
  const safeTotalHours = Number.isFinite(Number(totalHours)) ? Math.max(0, Number(totalHours)) : 0;
  const totalMinutes = Math.round(safeTotalHours * 60);
  const hoursPart = Math.min(99, Math.floor(totalMinutes / 60));
  const minutesPart = totalMinutes % 60;

  el.printTimeHours.value = hoursPart;
  el.printTimeMinutes.value = minutesPart;
}

function normalizeTimeInputs() {
  if (el.printTimeHours.value !== '') {
    el.printTimeHours.value = normalizeTimePart(el.printTimeHours.value, 99);
  }
  if (el.printTimeMinutes.value !== '') {
    el.printTimeMinutes.value = normalizeTimePart(el.printTimeMinutes.value, 59);
  }
}

function syncMarginOverridePlaceholder() {
  const defaultMargin = Number(state.settings.default_margin_percent || 0);
  el.marginOverride.placeholder = `Default: ${defaultMargin}%`;
}

function setFilamentDropdownOpen(open) {
  state.ui.filamentDropdownOpen = open;
  el.filamentDropdownMenu.classList.toggle('hidden', !open);
}

function getSelectedFilaments() {
  return state.filaments.filter((f) => state.selectedFilamentIds.includes(f.id));
}

function getSelectedPrinterPowerKw() {
  const printerId = Number(el.calcPrinter.value || 0);
  const selected = state.printers.find((p) => p.id === printerId);
  return selected ? Number(selected.power_kw || 0) : Number(state.settings.printer_power_kw || 0);
}

function updateFilamentDropdownButton() {
  const selected = getSelectedFilaments();
  if (selected.length === 0) {
    el.filamentDropdownBtn.textContent = 'No filament selected';
    return;
  }
  if (selected.length <= 2) {
    el.filamentDropdownBtn.textContent = selected.map((f) => f.name).join(', ');
    return;
  }
  el.filamentDropdownBtn.textContent = `${selected.length} filaments selected`;
}
function setSelectOptions(selectNode, items, placeholder) {
  selectNode.innerHTML = '';

  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    selectNode.appendChild(option);
  }

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = item.name;
    selectNode.appendChild(option);
  });
}

function renderPrinterSelect() {
  const current = el.calcPrinter.value;
  el.calcPrinter.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Default (global setting)';
  el.calcPrinter.appendChild(defaultOption);

  state.printers.forEach((printer) => {
    const option = document.createElement('option');
    option.value = String(printer.id);
    option.textContent = `${printer.name} (${formatPowerW(printer.power_kw)} W)`;
    el.calcPrinter.appendChild(option);
  });

  el.calcPrinter.value = current || '';
}

function renderFilamentReferenceSelects() {
  setSelectOptions(el.newFilamentManufacturer, state.filamentManufacturers, 'Manufacturer');
  setSelectOptions(el.newFilamentType, state.filamentTypes, 'Type');
  el.addFilamentBtn.disabled = state.filamentManufacturers.length === 0 || state.filamentTypes.length === 0;
}

function renderFilamentCheckboxes() {
  el.filamentCheckboxList.innerHTML = '';
  if (state.filaments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No filaments available.';
    el.filamentCheckboxList.appendChild(empty);
    updateFilamentDropdownButton();
    return;
  }

  state.filaments.forEach((filament) => {
    const label = document.createElement('label');
    label.className = 'multi-select-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedFilamentIds.includes(filament.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!state.selectedFilamentIds.includes(filament.id)) {
          state.selectedFilamentIds.push(filament.id);
        }
      } else {
        state.selectedFilamentIds = state.selectedFilamentIds.filter((id) => id !== filament.id);
      }
      updateFilamentDropdownButton();
      computePreview();
    });

    const text = document.createElement('span');
    text.textContent = `${filament.name} (${formatMoney(filament.cost_per_kg)} PLN/kg)`;

    label.appendChild(checkbox);
    label.appendChild(text);
    el.filamentCheckboxList.appendChild(label);
  });

  updateFilamentDropdownButton();
}

function readCalculationForm() {
  return {
    name: el.calcName.value,
    additional_comments: el.additionalComments.value,
    model_url: el.modelUrl.value,
    print_time_hours: getPrintTimeHoursFromForm(),
    printer_id: el.calcPrinter.value === '' ? null : Number(el.calcPrinter.value),
    filament_ids: state.selectedFilamentIds,
    filament_used_grams: el.filamentUsed.value || 0,
    margin_override_percent: el.marginOverride.value === '' ? null : Number(el.marginOverride.value),
  };
}

function buildScenarioRowsFromSelection() {
  const printTime = getPrintTimeHoursFromForm();
  const filamentUsed = Number(el.filamentUsed.value || 0);
  const overrideMargin = el.marginOverride.value === '' ? null : Number(el.marginOverride.value);

  const electricityCostPerKwh = Number(state.settings.electricity_cost_per_kwh || 0);
  const printerPowerKw = getSelectedPrinterPowerKw();
  const electricityCost = printTime * electricityCostPerKwh * printerPowerKw;

  const margin = overrideMargin === null || Number.isNaN(overrideMargin)
    ? Number(state.settings.default_margin_percent || 0)
    : overrideMargin;

  const selectedFilaments = getSelectedFilaments();
  if (selectedFilaments.length === 0) {
    const totalCost = electricityCost;
    return {
      electricityCost,
      rows: [{ name: 'No filament', filamentCost: 0, totalCost, finalPrice: totalCost * (1 + margin / 100) }],
    };
  }

  const rows = selectedFilaments.map((filament) => {
    const filamentCost = (filamentUsed / 1000) * Number(filament.cost_per_kg || 0);
    const totalCost = filamentCost + electricityCost;
    return {
      name: filament.name,
      filamentCost,
      totalCost,
      finalPrice: totalCost * (1 + margin / 100),
    };
  });

  return { electricityCost, rows };
}

function setResultLines(node, rows, valueKey) {
  node.innerHTML = '';
  rows.forEach((row) => {
    const line = document.createElement('div');
    line.className = 'line';
    const label = document.createElement('span');
    label.className = 'line-label';
    label.textContent = `${row.name} - `;
    const value = document.createElement('span');
    value.className = 'price-value';
    value.textContent = formatMoney(row[valueKey]);
    line.appendChild(label);
    line.appendChild(value);
    node.appendChild(line);
  });
}

function computePreview() {
  const scenario = buildScenarioRowsFromSelection();
  el.electricityCostOut.textContent = formatMoney(scenario.electricityCost);
  setResultLines(el.filamentCostOut, scenario.rows, 'filamentCost');
  setResultLines(el.totalCostOut, scenario.rows, 'totalCost');
  setResultLines(el.finalPriceOut, scenario.rows, 'finalPrice');
}

function renderPrinters() {
  el.printerList.innerHTML = '';
  if (state.printers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No printers yet.';
    el.printerList.appendChild(empty);
    return;
  }

  state.printers.forEach((printer) => {
    const row = document.createElement('div');
    row.className = 'printer-row';

    const nameInput = document.createElement('input');
    nameInput.value = printer.name;

    const powerGroup = document.createElement('div');
    powerGroup.className = 'input-addon-group';
    const powerInput = document.createElement('input');
    powerInput.type = 'number';
    powerInput.min = '0';
    powerInput.step = '1';
    powerInput.value = String(formatPowerW(printer.power_kw));
    const powerAddon = document.createElement('span');
    powerAddon.className = 'input-addon';
    powerAddon.textContent = 'W';
    powerGroup.appendChild(powerInput);
    powerGroup.appendChild(powerAddon);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-icon-only';
    saveBtn.type = 'button';
    saveBtn.innerHTML = getIconSvg('save');
    saveBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/printers/${printer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value, power_w: Number(powerInput.value || 0) }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Printer updated.', 'ok');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-icon-only';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = getIconSvg('trash');
    deleteBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/printers/${printer.id}`, { method: 'DELETE' });
      if (!result.ok) return handleApiError(result);
      if (String(el.calcPrinter.value) === String(printer.id)) {
        el.calcPrinter.value = '';
      }
      await loadState();
      setStatus('Printer deleted.', 'ok');
    });

    row.appendChild(nameInput);
    row.appendChild(powerGroup);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);
    el.printerList.appendChild(row);
  });
}
function renderFilamentTypes() {
  el.filamentTypeList.innerHTML = '';
  if (state.filamentTypes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No types yet.';
    el.filamentTypeList.appendChild(empty);
    return;
  }

  state.filamentTypes.forEach((type) => {
    const row = document.createElement('div');
    row.className = 'simple-crud-row';
    const input = document.createElement('input');
    input.value = type.name;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-icon-only';
    saveBtn.type = 'button';
    saveBtn.innerHTML = getIconSvg('save');
    saveBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/filament-types/${type.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Filament type updated.', 'ok');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-icon-only';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = getIconSvg('trash');
    deleteBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/filament-types/${type.id}`, { method: 'DELETE' });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Filament type deleted.', 'ok');
    });

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);
    el.filamentTypeList.appendChild(row);
  });
}

function renderFilamentManufacturers() {
  el.filamentManufacturerList.innerHTML = '';
  if (state.filamentManufacturers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No manufacturers yet.';
    el.filamentManufacturerList.appendChild(empty);
    return;
  }

  state.filamentManufacturers.forEach((manufacturer) => {
    const row = document.createElement('div');
    row.className = 'simple-crud-row';
    const input = document.createElement('input');
    input.value = manufacturer.name;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-icon-only';
    saveBtn.type = 'button';
    saveBtn.innerHTML = getIconSvg('save');
    saveBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/filament-manufacturers/${manufacturer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Filament manufacturer updated.', 'ok');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-icon-only';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = getIconSvg('trash');
    deleteBtn.addEventListener('click', async () => {
      const result = await fetch(`/api/filament-manufacturers/${manufacturer.id}`, { method: 'DELETE' });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Filament manufacturer deleted.', 'ok');
    });

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);
    el.filamentManufacturerList.appendChild(row);
  });
}

function renderFilaments() {
  el.filamentList.innerHTML = '';
  if (state.filaments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No filaments yet.';
    el.filamentList.appendChild(empty);
    return;
  }

  state.filaments.forEach((filament) => {
    const row = document.createElement('div');
    row.className = 'filament-row';

    const manufacturerSelect = document.createElement('select');
    setSelectOptions(manufacturerSelect, state.filamentManufacturers);
    manufacturerSelect.value = String(filament.manufacturer_id);

    const typeSelect = document.createElement('select');
    setSelectOptions(typeSelect, state.filamentTypes);
    typeSelect.value = String(filament.type_id);

    const colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.value = filament.color || '';

    const costGroup = document.createElement('div');
    costGroup.className = 'input-addon-group';
    const costInput = document.createElement('input');
    costInput.type = 'text';
    costInput.inputMode = 'decimal';
    costInput.value = formatFilamentCostInput(filament.cost_per_kg);
    const costAddon = document.createElement('span');
    costAddon.className = 'input-addon';
    costAddon.textContent = 'PLN/kg';
    costGroup.appendChild(costInput);
    costGroup.appendChild(costAddon);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-icon-only';
    saveBtn.type = 'button';
    saveBtn.innerHTML = getIconSvg('save');
    saveBtn.addEventListener('click', async () => {
      const parsedCost = parseLocaleDecimal(costInput.value);
      const result = await fetch(`/api/filaments/${filament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer_id: Number(manufacturerSelect.value),
          type_id: Number(typeSelect.value),
          color: colorInput.value,
          cost_per_kg: parsedCost,
        }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
      setStatus('Filament updated.', 'ok');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-icon-only';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = getIconSvg('trash');
    deleteBtn.addEventListener('click', () => openFilamentDeleteModal(filament.id, filament.name));

    row.appendChild(manufacturerSelect);
    row.appendChild(typeSelect);
    row.appendChild(colorInput);
    row.appendChild(costGroup);
    row.appendChild(saveBtn);
    row.appendChild(deleteBtn);
    el.filamentList.appendChild(row);
  });
}

function getSavedFilamentSnapshots(calc) {
  if (Array.isArray(calc.selected_filaments_snapshot) && calc.selected_filaments_snapshot.length > 0) {
    return calc.selected_filaments_snapshot;
  }
  if (calc.filament_name_snapshot || calc.filament_cost_per_kg_snapshot !== null) {
    return [{ name: calc.filament_name_snapshot || 'Filament', cost_per_kg: Number(calc.filament_cost_per_kg_snapshot || 0) }];
  }
  return [{ name: 'No filament', cost_per_kg: 0 }];
}

function getSavedPriceRange(calc) {
  const printTime = Number(calc.print_time_hours || 0);
  const filamentUsed = Number(calc.filament_used_grams || 0);
  const electricity = printTime * Number(calc.electricity_cost_per_kwh_snapshot || 0) * Number(calc.printer_power_kw_snapshot || 0);
  const margin = calc.margin_override_percent === null || calc.margin_override_percent === undefined
    ? Number(calc.default_margin_percent_snapshot || 0)
    : Number(calc.margin_override_percent || 0);

  const prices = getSavedFilamentSnapshots(calc).map((f) => {
    const filamentCost = (filamentUsed / 1000) * Number(f.cost_per_kg || 0);
    const total = filamentCost + electricity;
    return total * (1 + margin / 100);
  });

  return prices.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...prices), max: Math.max(...prices) };
}
function renderCalculationsList() {
  el.savedList.innerHTML = '';
  if (state.calculations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No saved calculations yet.';
    el.savedList.appendChild(empty);
    return;
  }

  state.calculations.forEach((calc) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `saved-item ${calc.id === state.selectedCalculationId ? 'active' : ''}`;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = calc.name || 'Untitled';

    const meta = document.createElement('span');
    meta.className = 'meta';
    const snapshotsCount = getSavedFilamentSnapshots(calc).length;
    const range = getSavedPriceRange(calc);
    const prefix = document.createElement('span');
    prefix.className = 'meta-label';
    prefix.textContent = 'Final price: ';
    const price = document.createElement('span');
    price.className = 'price-value';
    price.textContent = snapshotsCount > 1 || Math.abs(range.max - range.min) > 0.000001
      ? `${formatMoney(range.min)} - ${formatMoney(range.max)} PLN`
      : `${formatMoney(range.min)} PLN`;

    meta.appendChild(prefix);
    meta.appendChild(price);
    item.appendChild(name);
    item.appendChild(meta);
    item.addEventListener('click', () => {
      state.selectedCalculationId = calc.id;
      loadCalculationToForm(calc);
      renderCalculationsList();
      setStatus('Loaded calculation.', 'ok');
    });

    el.savedList.appendChild(item);
  });
}

function updateCalculationInfo(calc) {
  el.calcUpdatedInfo.textContent = calc ? `Updated: ${new Date(calc.updated_at).toLocaleString()}` : '';
}

function loadCalculationToForm(calc) {
  el.calcName.value = calc.name || '';
  el.additionalComments.value = calc.additional_comments || '';
  el.modelUrl.value = calc.model_url || '';
  setPrintTimeFields(calc.print_time_hours);
  el.filamentUsed.value = calc.filament_used_grams;
  el.marginOverride.value = calc.margin_override_percent ?? '';
  el.calcPrinter.value = calc.printer_id ? String(calc.printer_id) : '';

  const fromArray = Array.isArray(calc.selected_filament_ids) ? calc.selected_filament_ids : [];
  if (fromArray.length > 0) {
    state.selectedFilamentIds = fromArray.filter((id) => state.filaments.some((f) => f.id === id));
  } else if (calc.filament_id && state.filaments.some((f) => f.id === calc.filament_id)) {
    state.selectedFilamentIds = [calc.filament_id];
  } else {
    state.selectedFilamentIds = [];
  }

  renderFilamentCheckboxes();
  el.deleteCalculationBtn.disabled = false;
  updateCalculationInfo(calc);
  computePreview();
}

function resetForm() {
  state.selectedCalculationId = null;
  el.calcName.value = '';
  el.additionalComments.value = '';
  el.modelUrl.value = '';
  el.printTimeHours.value = '';
  el.printTimeMinutes.value = '';
  el.filamentUsed.value = '';
  el.marginOverride.value = '';
  el.calcPrinter.value = '';
  state.selectedFilamentIds = [];
  renderFilamentCheckboxes();
  el.deleteCalculationBtn.disabled = true;
  updateCalculationInfo(null);
  renderCalculationsList();
  computePreview();
  setStatus('Ready for a new calculation.', 'ok');
}

function openDeleteModal() {
  if (!state.selectedCalculationId) return;
  const calc = state.calculations.find((c) => c.id === state.selectedCalculationId);
  const calcName = calc && calc.name ? calc.name : 'this calculation';
  el.deleteModalText.textContent = `Delete ${calcName}? This action cannot be undone.`;
  el.deleteModal.classList.remove('hidden');
  state.ui.deleteModalOpen = true;
}

function closeDeleteModal() {
  el.deleteModal.classList.add('hidden');
  state.ui.deleteModalOpen = false;
}

function getCalculationsUsingFilament(filamentId) {
  return state.calculations.filter((calc) => {
    const selected = Array.isArray(calc.selected_filament_ids) ? calc.selected_filament_ids : [];
    return calc.filament_id === filamentId || selected.includes(filamentId);
  });
}

function openFilamentDeleteModal(filamentId, filamentName) {
  state.ui.pendingFilamentDeleteId = filamentId;
  state.ui.pendingFilamentDeleteName = filamentName || 'this filament';
  el.filamentDeleteModalText.textContent = `Delete ${state.ui.pendingFilamentDeleteName}? This action cannot be undone.`;
  el.filamentDeleteModal.classList.remove('hidden');
  state.ui.filamentDeleteModalOpen = true;
}

function closeFilamentDeleteModal() {
  el.filamentDeleteModal.classList.add('hidden');
  state.ui.filamentDeleteModalOpen = false;
}

function openFilamentInUseModal(filamentName, calculations) {
  el.filamentInUseText.textContent = `${filamentName} is used by saved items and cannot be deleted.`;
  el.filamentInUseList.innerHTML = '';
  calculations.forEach((calc) => {
    const item = document.createElement('li');
    item.textContent = calc.name || `Untitled (${calc.id})`;
    el.filamentInUseList.appendChild(item);
  });
  el.filamentInUseModal.classList.remove('hidden');
  state.ui.filamentInUseModalOpen = true;
}

function closeFilamentInUseModal() {
  el.filamentInUseModal.classList.add('hidden');
  state.ui.filamentInUseModalOpen = false;
}

async function confirmFilamentDelete() {
  const filamentId = state.ui.pendingFilamentDeleteId;
  const filamentName = state.ui.pendingFilamentDeleteName || 'This filament';
  if (!filamentId) {
    closeFilamentDeleteModal();
    return;
  }

  const usage = getCalculationsUsingFilament(filamentId);
  if (usage.length > 0) {
    closeFilamentDeleteModal();
    openFilamentInUseModal(filamentName, usage);
    return;
  }

  const result = await fetch(`/api/filaments/${filamentId}`, { method: 'DELETE' });
  if (!result.ok) {
    closeFilamentDeleteModal();
    return handleApiError(result);
  }

  closeFilamentDeleteModal();
  state.selectedFilamentIds = state.selectedFilamentIds.filter((id) => id !== filamentId);
  await loadState();
  setStatus('Filament deleted.', 'ok');
}

async function confirmDeleteCalculation() {
  if (!state.selectedCalculationId) {
    closeDeleteModal();
    return;
  }
  const result = await fetch(`/api/calculations/${state.selectedCalculationId}`, { method: 'DELETE' });
  if (!result.ok) {
    closeDeleteModal();
    return handleApiError(result);
  }
  closeDeleteModal();
  await loadState();
  resetForm();
  setStatus('Calculation deleted.', 'ok');
}

async function handleApiError(response) {
  let message = 'Request failed.';
  try {
    const body = await response.json();
    if (body && body.error) message = body.error;
  } catch (_error) {
    // ignore
  }
  setStatus(message, 'error');
}

async function loadState() {
  const result = await fetch('/api/state');
  if (!result.ok) return handleApiError(result);

  const data = await result.json();
  state.settings = data.settings;
  state.printers = Array.isArray(data.printers) ? data.printers : [];
  state.filamentTypes = Array.isArray(data.filament_types) ? data.filament_types : [];
  state.filamentManufacturers = Array.isArray(data.filament_manufacturers) ? data.filament_manufacturers : [];
  state.filaments = data.filaments;
  state.calculations = data.calculations;

  el.electricityCost.value = state.settings.electricity_cost_per_kwh;
  el.printerPowerW.value = formatPowerW(state.settings.printer_power_kw);
  el.defaultMargin.value = state.settings.default_margin_percent;

  renderPrinterSelect();
  renderPrinters();
  renderFilamentReferenceSelects();
  renderFilamentTypes();
  renderFilamentManufacturers();
  renderFilamentCheckboxes();
  renderFilaments();
  renderCalculationsList();

  if (state.selectedCalculationId) {
    const selected = state.calculations.find((c) => c.id === state.selectedCalculationId);
    if (selected) {
      loadCalculationToForm(selected);
    } else {
      resetForm();
    }
  }

  syncMarginOverridePlaceholder();
  computePreview();
}
el.toggleLeftPanelBtn.addEventListener('click', () => {
  state.ui.leftCollapsed = !state.ui.leftCollapsed;
  syncPanelUI();
});

el.toggleRightPanelBtn.addEventListener('click', () => {
  state.ui.rightCollapsed = !state.ui.rightCollapsed;
  syncPanelUI();
});

el.filamentDropdownBtn.addEventListener('click', () => setFilamentDropdownOpen(!state.ui.filamentDropdownOpen));
el.calcPrinter.addEventListener('change', computePreview);

el.selectAllFilamentsBtn.addEventListener('click', () => {
  state.selectedFilamentIds = state.filaments.map((f) => f.id);
  renderFilamentCheckboxes();
  computePreview();
});

el.selectNoneFilamentsBtn.addEventListener('click', () => {
  state.selectedFilamentIds = [];
  renderFilamentCheckboxes();
  computePreview();
});

el.saveSettingsBtn.addEventListener('click', async () => {
  const result = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      electricity_cost_per_kwh: Number(el.electricityCost.value || 0),
      printer_power_kw: Number(el.printerPowerW.value || 0) / 1000,
      default_margin_percent: Number(el.defaultMargin.value || 0),
    }),
  });
  if (!result.ok) return handleApiError(result);
  const data = await result.json();
  state.settings = data.settings;
  syncMarginOverridePlaceholder();
  computePreview();
  setStatus('Settings saved.', 'ok');
});

el.addPrinterBtn.addEventListener('click', async () => {
  const result = await fetch('/api/printers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: el.newPrinterName.value, power_w: Number(el.newPrinterPowerW.value || 0) }),
  });
  if (!result.ok) return handleApiError(result);
  el.newPrinterName.value = '';
  el.newPrinterPowerW.value = '';
  await loadState();
  setStatus('Printer added.', 'ok');
});

el.addFilamentTypeBtn.addEventListener('click', async () => {
  const result = await fetch('/api/filament-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: el.newFilamentTypeName.value }),
  });
  if (!result.ok) return handleApiError(result);
  el.newFilamentTypeName.value = '';
  await loadState();
  setStatus('Filament type added.', 'ok');
});

el.addFilamentManufacturerBtn.addEventListener('click', async () => {
  const result = await fetch('/api/filament-manufacturers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: el.newFilamentManufacturerName.value }),
  });
  if (!result.ok) return handleApiError(result);
  el.newFilamentManufacturerName.value = '';
  await loadState();
  setStatus('Filament manufacturer added.', 'ok');
});

el.addFilamentBtn.addEventListener('click', async () => {
  const parsedCost = parseLocaleDecimal(el.newFilamentCost.value);
  const result = await fetch('/api/filaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      manufacturer_id: Number(el.newFilamentManufacturer.value),
      type_id: Number(el.newFilamentType.value),
      color: el.newFilamentColor.value,
      cost_per_kg: parsedCost,
    }),
  });
  if (!result.ok) return handleApiError(result);
  el.newFilamentColor.value = '';
  el.newFilamentCost.value = '';
  await loadState();
  setStatus('Filament added.', 'ok');
});

el.newFilamentCost.addEventListener('blur', () => {
  const parsed = parseLocaleDecimal(el.newFilamentCost.value);
  if (Number.isFinite(parsed)) el.newFilamentCost.value = formatFilamentCostInput(parsed);
});

el.newCalculationBtn.addEventListener('click', resetForm);

el.saveCalculationBtn.addEventListener('click', async () => {
  const payload = readCalculationForm();
  const isEdit = Number.isInteger(state.selectedCalculationId) && state.selectedCalculationId > 0;
  const result = await fetch(isEdit ? `/api/calculations/${state.selectedCalculationId}` : '/api/calculations', {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!result.ok) return handleApiError(result);
  const data = await result.json();
  state.selectedCalculationId = data.calculation.id;
  await loadState();
  setStatus(isEdit ? 'Calculation updated.' : 'Calculation saved.', 'ok');
});

el.deleteCalculationBtn.addEventListener('click', openDeleteModal);
el.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
el.confirmDeleteBtn.addEventListener('click', confirmDeleteCalculation);
el.cancelFilamentDeleteBtn.addEventListener('click', closeFilamentDeleteModal);
el.confirmFilamentDeleteBtn.addEventListener('click', confirmFilamentDelete);
el.closeFilamentInUseBtn.addEventListener('click', closeFilamentInUseModal);

el.deleteModal.addEventListener('click', (event) => {
  if (event.target === el.deleteModal) closeDeleteModal();
});
el.filamentDeleteModal.addEventListener('click', (event) => {
  if (event.target === el.filamentDeleteModal) closeFilamentDeleteModal();
});
el.filamentInUseModal.addEventListener('click', (event) => {
  if (event.target === el.filamentInUseModal) closeFilamentInUseModal();
});

document.addEventListener('click', (event) => {
  if (!el.filamentMultiSelect.contains(event.target)) setFilamentDropdownOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.ui.deleteModalOpen) closeDeleteModal();
  if (state.ui.filamentDeleteModalOpen) closeFilamentDeleteModal();
  if (state.ui.filamentInUseModalOpen) closeFilamentInUseModal();
  if (state.ui.filamentDropdownOpen) setFilamentDropdownOpen(false);
});

[el.printTimeHours, el.printTimeMinutes].forEach((node) => {
  node.addEventListener('input', () => {
    normalizeTimeInputs();
    computePreview();
  });
  node.addEventListener('change', () => {
    normalizeTimeInputs();
    computePreview();
  });
});

[el.filamentUsed, el.marginOverride].forEach((node) => {
  node.addEventListener('input', computePreview);
  node.addEventListener('change', computePreview);
});

setupRightPanelCardFolding();
loadPanelState();
syncPanelUI();
loadState().then(() => {
  resetForm();
}).catch((error) => {
  setStatus(error.message || 'Failed to load app state.', 'error');
});






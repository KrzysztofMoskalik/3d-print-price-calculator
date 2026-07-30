
const state = {
  settings: {
    electricity_cost_per_kwh: 0,
    printer_power_kw: 0.3,
    default_margin_percent: 20,
    rounding_mode: 'none',
    currency: 'PLN',
    default_printer_id: null,
  },
  printers: [],
  filamentTypes: [],
  filamentManufacturers: [],
  filaments: [],
  calculations: [],
  features: { auth_enabled: false, import_export_enabled: false },
  user: null,
  selectedCalculationId: null,
  selectedFilamentIds: [],
  filamentSlots: Array.from({ length: 4 }, () => ({ filament_id: null, used_grams: '' })),
  galleryImages: [],
  galleryViewerIndex: 0,
  ui: {
    leftCollapsed: false,
    deleteModalOpen: false,
    settingsModalOpen: false,
    savedItemsModalOpen: false,
    printersModalOpen: false,
    filamentsModalOpen: false,
    accountMenuOpen: false,
    authRegisterMode: false,
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
  } catch (_error) {
    // ignore storage errors
  }
}

function savePanelState() {
  try {
    localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify({
      leftCollapsed: state.ui.leftCollapsed,
    }));
  } catch (_error) {
    // ignore storage errors
  }
}
const el = {
  appShell: document.getElementById('appShell'),
  pageShell: document.querySelector('.page-shell'),
  leftPanel: document.getElementById('leftPanel'),
  toggleLeftPanelBtn: document.getElementById('toggleLeftPanelBtn'),
  openSettingsModalBtn: document.getElementById('openSettingsModalBtn'),
  openSavedItemsModalBtn: document.getElementById('openSavedItemsModalBtn'),
  openPrintersModalBtn: document.getElementById('openPrintersModalBtn'),
  openFilamentsModalBtn: document.getElementById('openFilamentsModalBtn'),
  accountMenuBtn: document.getElementById('accountMenuBtn'),
  accountMenu: document.getElementById('accountMenu'),
  loginMenuItem: document.getElementById('loginMenuItem'),
  accountSettingsMenuItem: document.getElementById('accountSettingsMenuItem'),
  registerMenuItem: document.getElementById('registerMenuItem'),
  logoutMenuItem: document.getElementById('logoutMenuItem'),
  accountUserEmail: document.getElementById('accountUserEmail'),
  authModal: document.getElementById('authModal'),
  galleryImageFiles: document.getElementById('galleryImageFiles'),
  galleryFilePicker: document.querySelector('.gallery-file-picker'),
  addGalleryImageBtn: document.getElementById('addGalleryImageBtn'),
  galleryGrid: document.getElementById('galleryGrid'),
  galleryViewer: document.getElementById('galleryViewer'),
  galleryViewerImage: document.getElementById('galleryViewerImage'),
  galleryPrevBtn: document.getElementById('galleryPrevBtn'),
  galleryNextBtn: document.getElementById('galleryNextBtn'),
  galleryCloseBtn: document.getElementById('galleryCloseBtn'),
  authModalTitle: document.getElementById('authModalTitle'),
  authForm: document.getElementById('authForm'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authSwitchBtn: document.getElementById('authSwitchBtn'),
  accountSettingsModal: document.getElementById('accountSettingsModal'),
  changePasswordForm: document.getElementById('changePasswordForm'),
  currentPassword: document.getElementById('currentPassword'),
  newPassword: document.getElementById('newPassword'),
  confirmPassword: document.getElementById('confirmPassword'),
  settingsModal: document.getElementById('settingsModal'),
  importExportSection: document.getElementById('importExportSection'),
  exportDataBtn: document.getElementById('exportDataBtn'),
  importDataFile: document.getElementById('importDataFile'),
  savedItemsModal: document.getElementById('savedItemsModal'),
  savedCalculationsSearch: document.getElementById('savedCalculationsSearch'),
  savedCommercialFilter: document.getElementById('savedCommercialFilter'),
  savedCalculationsSort: document.getElementById('savedCalculationsSort'),
  printersModal: document.getElementById('printersModal'),
  filamentsModal: document.getElementById('filamentsModal'),
  savedList: document.getElementById('savedList'),
  newCalculationBtn: document.getElementById('newCalculationBtn'),
  electricityCost: document.getElementById('electricityCost'),
  printerPowerW: document.getElementById('printerPowerW'),
  defaultMargin: document.getElementById('defaultMargin'),
  roundingMode: document.getElementById('roundingMode'),
  currency: document.getElementById('currency'),
  electricityCurrencyAddon: document.getElementById('electricityCurrencyAddon'),

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
  filamentSlots: document.getElementById('filamentSlots'),
  printParts: document.getElementById('printParts'),
  addPrintPartBtn: document.getElementById('addPrintPartBtn'),
  marginOverride: document.getElementById('marginOverride'),
  roundingOverride: document.getElementById('roundingOverride'),
  additionalComments: document.getElementById('additionalComments'),
  modelUrl: document.getElementById('modelUrl'),
  openModelUrlBtn: document.getElementById('openModelUrlBtn'),
  commercialUseAllowed: document.getElementById('commercialUseAllowed'),
  saveCalculationBtn: document.getElementById('saveCalculationBtn'),
  clearCalculationBtn: document.getElementById('clearCalculationBtn'),
  filamentCostOut: document.getElementById('filamentCostOut'),
  filamentCostTotalOut: document.getElementById('filamentCostTotalOut'),
  electricityCostOut: document.getElementById('electricityCostOut'),
  electricityTotalOut: document.getElementById('electricityTotalOut'),
  totalCostOut: document.getElementById('totalCostOut'),
  finalPriceOut: document.getElementById('finalPriceOut'),
  calcUpdatedInfo: document.getElementById('calcUpdatedInfo'),
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

let toastContainer = null;
let saveSettingsTimeout = null;
let calculationSaveTimeout = null;
let calculationSaveInFlight = false;
let calculationSavePending = false;

function ensureToastContainer() {
  if (toastContainer) {
    return toastContainer;
  }
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'false');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function setStatus(message, type = '') {
  if (!message) {
    return;
  }

  el.status.textContent = '';
  el.status.className = 'status';

  const container = ensureToastContainer();
  const toast = document.createElement('div');
  const tone = type === 'error' ? 'error' : type === 'ok' ? 'ok' : 'info';
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const ttl = tone === 'error' ? 5000 : 3200;
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  }, ttl);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function currencyCode() {
  return state.settings.currency || 'PLN';
}

function formatCurrency(value) {
  return `${formatMoney(value)} ${currencyCode()}`;
}

function syncCurrencyLabels() {
  const code = currencyCode();
  el.electricityCurrencyAddon.textContent = `${code}/kWh`;
  document.querySelectorAll('.filament-currency-addon').forEach((node) => { node.textContent = `${code}/kg`; });
}

async function loadGalleryImages() {
  if (!state.selectedCalculationId) {
    state.galleryImages = [];
    renderGallery();
    return;
  }
  try {
    const result = await fetch(`/api/calculations/${state.selectedCalculationId}/gallery`);
    if (!result.ok) throw new Error('Unable to load gallery.');
    state.galleryImages = (await result.json()).images || [];
  } catch (_error) {
    state.galleryImages = [];
    setStatus('Unable to load gallery images.', 'error');
  }
  renderGallery();
}

function renderGallery() {
  if (!el.galleryGrid) return;
  el.galleryGrid.innerHTML = '';
  state.galleryImages.forEach((imageData, index) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    const image = document.createElement('img');
    image.src = imageData.url;
    image.alt = imageData.original_name || `Gallery image ${index + 1}`;
    image.addEventListener('click', () => openGalleryViewer(index));
    const defaultButton = document.createElement('button');
    defaultButton.className = `gallery-default btn btn-icon-only${Number(imageData.is_default) ? ' is-default' : ''}`;
    defaultButton.type = 'button';
    defaultButton.innerHTML = getIconSvg('star');
    defaultButton.title = Number(imageData.is_default) ? 'Default image' : 'Set as default image';
    defaultButton.setAttribute('aria-label', defaultButton.title);
    defaultButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (Number(imageData.is_default)) return;
      defaultButton.disabled = true;
      const result = await fetch(`/api/gallery-images/${imageData.id}/default`, { method: 'PUT' });
      if (!result.ok) {
        defaultButton.disabled = false;
        return setStatus('Unable to set default image.', 'error');
      }
      state.galleryImages.forEach((entry) => { entry.is_default = Number(entry.id) === Number(imageData.id) ? 1 : 0; });
      renderGallery();
      syncSavedCalculationGalleryPreview();
    });
    const remove = document.createElement('button');
    remove.className = 'gallery-remove btn btn-icon-only';
    remove.type = 'button';
    remove.innerHTML = getIconSvg('trash');
    remove.title = 'Remove image';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      const result = await fetch(`/api/gallery-images/${imageData.id}`, { method: 'DELETE' });
      if (!result.ok) { remove.disabled = false; return setStatus('Unable to remove image.', 'error'); }
      state.galleryImages.splice(index, 1);
      renderGallery();
      syncSavedCalculationGalleryPreview();
    });
    item.append(image, defaultButton, remove);
    el.galleryGrid.appendChild(item);
  });
  if (el.galleryFilePicker) el.galleryGrid.appendChild(el.galleryFilePicker);
}

function syncSavedCalculationGalleryPreview() {
  const calculation = state.calculations.find((entry) => Number(entry.id) === Number(state.selectedCalculationId));
  if (!calculation) return;
  const defaultImage = state.galleryImages.find((entry) => Number(entry.is_default));
  calculation.default_gallery_image_url = defaultImage?.url || null;
  renderCalculationsList();
}

function openGalleryViewer(index) {
  if (!state.galleryImages.length) return;
  state.galleryViewerIndex = index;
  el.galleryViewerImage.src = state.galleryImages[index].url;
  el.galleryViewer.classList.remove('hidden');
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

function roundFinalPrice(value, mode) {
  const amount = Number(value || 0);
  if (mode === 'tenth') return Math.ceil(amount * 10 - 1e-9) / 10;
  if (mode === 'half') return Math.ceil(amount * 2 - 1e-9) / 2;
  if (mode === 'integer') return Math.ceil(amount - 1e-9);
  if (mode === 'five') return Math.ceil((amount / 5) - 1e-9) * 5;
  return amount;
}

function syncRoundingOverrideDisplay() {
  const labels = {
    none: 'No rounding',
    tenth: 'Up to 0.1',
    half: 'Up to 0.50',
    integer: 'Up to whole units',
    five: 'Up to multiples of 5',
  };
  const globalMode = state.settings.rounding_mode || 'none';
  el.roundingOverride.options[0].textContent = `Default (global: ${labels[globalMode] || labels.none})`;
  if (el.roundingOverride.dataset.usesDefault === '1') {
    el.roundingOverride.value = '';
  }
}

function getIconSvg(name) {
  const icons = {
    save: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h7.793a1.5 1.5 0 0 1 1.06.44l2.207 2.207A1.5 1.5 0 0 1 15 3.707V14.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 2 14.5v-13zM3.5 1a.5.5 0 0 0-.5.5V14.5a.5.5 0 0 0 .5.5H4V9.5A1.5 1.5 0 0 1 5.5 8h5A1.5 1.5 0 0 1 12 9.5V15h1.5a.5.5 0 0 0 .5-.5V3.707a.5.5 0 0 0-.146-.353L11.646 1.146A.5.5 0 0 0 11.293 1H10v3.5A1.5 1.5 0 0 1 8.5 6h-3A1.5 1.5 0 0 1 4 4.5V1h-.5zM5 1v3.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V1H5zm6 14V9.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V15h6z"/></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5.5A.5.5 0 0 0 7.5 6v6a.5.5 0 0 0 1 0V6A.5.5 0 0 0 8 5.5zm2 .5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0V6z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2H5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h2.5a1 1 0 0 1 1 1zM6 2a.5.5 0 0 0-.5.5V3h5v-.5A.5.5 0 0 0 10 2H6zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4z"/></svg>',
    star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.3l2.06 4.18 4.61.67-3.34 3.25.79 4.59L8 11.82l-4.12 2.17.79-4.59L1.33 6.15l4.61-.67L8 1.3z"/></svg>'
  };
  return icons[name] || '';
}

function syncPanelUI() {
  el.appShell.classList.toggle('left-collapsed', state.ui.leftCollapsed);

  el.leftPanel.classList.toggle('is-collapsed', state.ui.leftCollapsed);

  el.toggleLeftPanelBtn.textContent = state.ui.leftCollapsed ? '\u25B6' : '\u25C0';
  el.toggleLeftPanelBtn.title = state.ui.leftCollapsed ? 'Unfold left panel' : 'Fold left panel';
  el.toggleLeftPanelBtn.setAttribute('aria-label', el.toggleLeftPanelBtn.title);

  savePanelState();
}

function setManagementModalOpen(name, open) {
  const modal = el[name];
  if (!modal) return;
  modal.classList.toggle('hidden', !open);
  state.ui[`${name}Open`] = open;
}

function showWelcome(show) {
  if (show) window.location.assign('/login');
}

function setAuthModalOpen(open, register = false) {
  state.ui.authRegisterMode = register;
  el.authModalTitle.textContent = register ? 'Register' : 'Log in';
  el.authSubmitBtn.textContent = register ? 'Register' : 'Log in';
  el.authSwitchBtn.textContent = register ? 'Already have an account' : 'Create an account';
  el.authPassword.autocomplete = register ? 'new-password' : 'current-password';
  if (register) {
    el.authPassword.setAttribute('pattern', '(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}');
  } else {
    el.authPassword.removeAttribute('pattern');
  }
  el.authModal.classList.toggle('hidden', !open);
}

function syncAccountMenu() {
  const enabled = state.features.auth_enabled;
  el.accountMenuBtn.disabled = !enabled;
  el.loginMenuItem.classList.toggle('hidden', !enabled || Boolean(state.user));
  el.registerMenuItem.classList.toggle('hidden', !enabled || Boolean(state.user));
  el.accountSettingsMenuItem.classList.toggle('hidden', !enabled || !state.user);
  el.logoutMenuItem.classList.toggle('hidden', !enabled || !state.user);
  el.accountMenuBtn.title = state.user ? state.user.email : 'Account';
  el.accountUserEmail.textContent = state.user ? state.user.email : '';
  el.accountUserEmail.classList.toggle('hidden', !state.user);
}

function setFilamentTab(panelId) {
  document.querySelectorAll('[data-filament-tab]').forEach((tab) => {
    const active = tab.dataset.filamentTab === panelId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== panelId);
  });
}

function setAccountMenuOpen(open) {
  state.ui.accountMenuOpen = open;
  el.accountMenu.classList.toggle('hidden', !open);
  el.accountMenuBtn.setAttribute('aria-expanded', String(open));
}

function bindAutoSave(inputs, save) {
  let timeout = null;
  const schedule = () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(save, 400);
  };

  inputs.forEach((input) => {
    input.addEventListener('input', schedule);
    input.addEventListener('change', schedule);
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
  return Array.from(document.querySelectorAll('.print-part')).reduce((total, part) => {
    const hours = normalizeTimePart(part.querySelector('.print-part-hours')?.value || 0, 99);
    const minutes = normalizeTimePart(part.querySelector('.print-part-minutes')?.value || 0, 59);
    return total + hours + (minutes / 60);
  }, 0);
}

function getPrintPartsFromForm() {
  return Array.from(document.querySelectorAll('.print-part')).map((part, partIndex) => ({
    name: part.querySelector('.print-part-name')?.value.trim() || `Print Part ${partIndex + 1}`,
    print_time_hours: normalizeTimePart(part.querySelector('.print-part-hours')?.value || 0, 99)
      + normalizeTimePart(part.querySelector('.print-part-minutes')?.value || 0, 59) / 60,
    printer_id: part.querySelector('.print-part-printer')?.value || null,
    filament_details: Array.from(part.querySelectorAll('.filament-slot')).map((slot) => ({
      filament_id: slot.querySelector('.filament-slot-select')?.value || null,
      used_grams: slot.querySelector('.filament-slot-used')?.value || 0,
    })),
  }));
}

function setPrintTimeFields(totalHours) {
  const safeTotalHours = Number.isFinite(Number(totalHours)) ? Math.max(0, Number(totalHours)) : 0;
  const totalMinutes = Math.round(safeTotalHours * 60);
  const hoursPart = Math.min(99, Math.floor(totalMinutes / 60));
  const minutesPart = totalMinutes % 60;

  const firstPart = document.querySelector('.print-part');
  const hoursInput = firstPart?.querySelector('.print-part-hours');
  const minutesInput = firstPart?.querySelector('.print-part-minutes');
  if (hoursInput) hoursInput.value = hoursPart;
  if (minutesInput) minutesInput.value = minutesPart;
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

function getSelectedFilaments() {
  const ids = Array.from(document.querySelectorAll('.filament-slot-select'))
    .map((select) => Number(select.value))
    .filter((id) => Number.isInteger(id) && id > 0);
  return state.filaments.filter((f) => ids.includes(f.id));
}

function getSelectedPrinterPowerKw() {
  const printerId = Number(el.calcPrinter.value || 0);
  const selected = printerId ? state.printers.find((p) => p.id === printerId) : getDefaultPrinter();
  return selected ? Number(selected.power_kw || 0) : Number(state.settings.printer_power_kw || 0);
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
  defaultOption.textContent = getDefaultPrinterLabel();
  el.calcPrinter.appendChild(defaultOption);

  state.printers.forEach((printer) => {
    const option = document.createElement('option');
    option.value = String(printer.id);
    option.textContent = `${printer.name} (${formatPowerW(printer.power_kw)} W)`;
    el.calcPrinter.appendChild(option);
  });

  el.calcPrinter.value = current || '';
  syncPrinterDefaultDisplay();
}

function syncPrinterDefaultDisplay() {
  const label = getDefaultPrinterLabel();
  document.querySelectorAll('.print-part-printer').forEach((select) => {
    const defaultOption = select.querySelector('option[value=""]');
    if (defaultOption) defaultOption.textContent = label;
  });
}

function getDefaultPrinter() {
  const configured = state.printers.find((printer) => printer.id === Number(state.settings.default_printer_id));
  return configured || state.printers[0] || null;
}

function getDefaultPrinterLabel() {
  const printer = getDefaultPrinter();
  return printer ? `Default printer (${printer.name})` : 'Default printer (none configured)';
}

function renderFilamentReferenceSelects() {
  setSelectOptions(el.newFilamentManufacturer, state.filamentManufacturers, 'Manufacturer');
  setSelectOptions(el.newFilamentType, state.filamentTypes, 'Type');
  el.addFilamentBtn.disabled = state.filamentManufacturers.length === 0 || state.filamentTypes.length === 0;
}

function syncSelectedFilamentIds() {
  state.filamentSlots.forEach((slot) => {
    if (!state.filaments.some((filament) => filament.id === Number(slot.filament_id))) {
      slot.filament_id = null;
    }
  });
  state.selectedFilamentIds = state.filamentSlots
    .map((slot) => Number(slot.filament_id))
    .filter((id, index, ids) => Number.isInteger(id) && id > 0 && ids.indexOf(id) === index);
}

function renderFilamentSlots() {
  syncSelectedFilamentIds();
  el.filamentSlots.innerHTML = '';
  if (state.filaments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No filaments available. Add filament types first.';
    el.filamentSlots.appendChild(empty);
    return;
  }

  state.filamentSlots.forEach((slot, index) => {
    const card = document.createElement('div');
    card.className = 'filament-slot';

    const filamentLabel = document.createElement('label');
    filamentLabel.textContent = `Filament ${index + 1}`;
    const filamentSelect = document.createElement('select');
    filamentSelect.className = 'filament-slot-select';
    setSelectOptions(filamentSelect, state.filaments, 'Choose filament');
    filamentSelect.value = slot.filament_id ? String(slot.filament_id) : '';
    filamentSelect.addEventListener('change', () => {
      slot.filament_id = filamentSelect.value ? Number(filamentSelect.value) : null;
      syncSelectedFilamentIds();
      computePreview();
      scheduleCalculationSave();
    });
    filamentLabel.appendChild(filamentSelect);

    const usedLabel = document.createElement('label');
    usedLabel.textContent = 'Filament Used';
    const usedGroup = document.createElement('div');
    usedGroup.className = 'input-addon-group';
    const usedInput = document.createElement('input');
    usedInput.className = 'filament-slot-used';
    usedInput.type = 'number';
    usedInput.min = '0';
    usedInput.step = '0.1';
    usedInput.placeholder = '0';
    usedInput.value = slot.used_grams;
    usedInput.addEventListener('input', () => {
      slot.used_grams = usedInput.value;
      computePreview();
      scheduleCalculationSave();
    });
    const usedAddon = document.createElement('span');
    usedAddon.className = 'input-addon';
    usedAddon.textContent = 'g';
    usedGroup.appendChild(usedInput);
    usedGroup.appendChild(usedAddon);
    usedLabel.appendChild(usedGroup);

    card.appendChild(filamentLabel);
    card.appendChild(usedLabel);
    const removeButton = document.createElement('button');
    removeButton.className = 'btn filament-slot-clear';
    removeButton.type = 'button';
    removeButton.title = 'Clear filament';
    removeButton.setAttribute('aria-label', 'Clear filament');
    removeButton.textContent = 'Clear';
    removeButton.addEventListener('click', () => {
      state.filamentSlots[index] = { filament_id: null, used_grams: '' };
      syncSelectedFilamentIds();
      renderFilamentSlots();
      computePreview();
      scheduleCalculationSave();
    });
    card.appendChild(removeButton);
    el.filamentSlots.appendChild(card);
  });
}

function readCalculationForm() {
  const printParts = getPrintPartsFromForm();
  const filamentIds = [...new Set(printParts.flatMap((part) => part.filament_details
    .map((detail) => Number(detail.filament_id))
    .filter((id) => Number.isInteger(id) && id > 0)))];
  return {
    name: el.calcName.value,
    additional_comments: el.additionalComments.value,
    model_url: el.modelUrl.value,
    commercial_use_allowed: el.commercialUseAllowed.checked,
    print_parts: printParts,
    print_time_hours: getPrintTimeHoursFromForm(),
    printer_id: el.calcPrinter.value === '' ? null : Number(el.calcPrinter.value),
    filament_ids: filamentIds,
    filament_details: printParts.flatMap((part) => part.filament_details),
    filament_used_grams: state.filamentSlots[0]?.used_grams || 0,
    margin_override_percent: el.marginOverride.value === '' ? null : Number(el.marginOverride.value),
    rounding_override: el.roundingOverride.dataset.usesDefault === '1' ? null : (el.roundingOverride.value || null),
  };
}

function buildScenarioRowsFromSelection() {
  const printTime = getPrintTimeHoursFromForm();
  const filamentUsedById = new Map();
  document.querySelectorAll('.filament-slot').forEach((slot) => {
    const id = Number(slot.querySelector('.filament-slot-select')?.value || 0);
    const used = Number(slot.querySelector('.filament-slot-used')?.value || 0);
    if (id > 0) filamentUsedById.set(id, (filamentUsedById.get(id) || 0) + used);
  });
  const overrideMargin = el.marginOverride.value === '' ? null : Number(el.marginOverride.value);

  const electricityCostPerKwh = Number(state.settings.electricity_cost_per_kwh || 0);
  const electricityByPrinter = new Map();
  Array.from(document.querySelectorAll('.print-part')).forEach((part) => {
    const partHours = normalizeTimePart(part.querySelector('.print-part-hours')?.value || 0, 99)
      + normalizeTimePart(part.querySelector('.print-part-minutes')?.value || 0, 59) / 60;
    const selectedPrinterId = Number(part.querySelector('.print-part-printer')?.value || 0);
    const printer = selectedPrinterId ? state.printers.find((item) => item.id === selectedPrinterId) : getDefaultPrinter();
    const powerKw = printer ? Number(printer.power_kw || 0) : Number(state.settings.printer_power_kw || 0);
    const name = printer ? printer.name : 'Default printer';
    const cost = partHours * electricityCostPerKwh * powerKw;
    const existing = electricityByPrinter.get(name) || 0;
    electricityByPrinter.set(name, existing + cost);
  });
  const electricityRows = [...electricityByPrinter.entries()].map(([name, electricityCost]) => ({ name, electricityCost }));
  const electricityCost = electricityRows.reduce((total, row) => total + row.electricityCost, 0);

  const margin = overrideMargin === null || Number.isNaN(overrideMargin)
    ? Number(state.settings.default_margin_percent || 0)
    : overrideMargin;
  const roundingMode = el.roundingOverride.value || state.settings.rounding_mode || 'none';

  const selectedFilaments = getSelectedFilaments();
  if (selectedFilaments.length === 0) {
    const totalCost = electricityCost;
    return {
      electricityCost,
      electricityRows,
      margin,
      roundingMode,
      rows: [{ name: 'No filament', filamentCost: 0, totalCost, finalPrice: roundFinalPrice(totalCost * (1 + margin / 100), roundingMode) }],
    };
  }

  const rows = selectedFilaments.map((filament) => {
    const filamentCost = (Number(filamentUsedById.get(filament.id) || 0) / 1000) * Number(filament.cost_per_kg || 0);
    const totalCost = filamentCost + electricityCost;
    return {
      name: filament.name,
      filamentCost,
      totalCost,
      finalPrice: roundFinalPrice(totalCost * (1 + margin / 100), roundingMode),
    };
  });

  return { electricityCost, electricityRows, margin, roundingMode, rows };
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
    value.textContent = formatCurrency(row[valueKey]);
    line.appendChild(label);
    line.appendChild(value);
    node.appendChild(line);
  });
}

function computePreview() {
  const scenario = buildScenarioRowsFromSelection();
  setResultLines(el.electricityCostOut, scenario.electricityRows, 'electricityCost');
  el.electricityTotalOut.textContent = formatCurrency(scenario.electricityCost);
  setResultLines(el.filamentCostOut, scenario.rows, 'filamentCost');
  el.filamentCostTotalOut.textContent = formatCurrency(scenario.rows.reduce((total, row) => total + Number(row.filamentCost || 0), 0));
  const combinedTotal = scenario.electricityCost
    + scenario.rows.reduce((total, row) => total + Number(row.filamentCost || 0), 0);
  el.totalCostOut.textContent = formatCurrency(combinedTotal);
  el.finalPriceOut.textContent = formatCurrency(roundFinalPrice(combinedTotal * (1 + scenario.margin / 100), scenario.roundingMode));
  if (state.selectedCalculationId) renderCalculationsList();
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

    bindAutoSave([nameInput, powerInput], async () => {
      const result = await fetch(`/api/printers/${printer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value, power_w: Number(powerInput.value || 0) }),
      });
      if (!result.ok) return handleApiError(result);
      // Do not reload the whole application here: rebuilding the printer list
      // replaces the focused input, which made typing (especially spaces)
      // appear to lose focus while autosave was running.
      const data = await result.json();
      const updatedPrinter = data.printer;
      const printerIndex = state.printers.findIndex((item) => Number(item.id) === Number(printer.id));
      if (printerIndex >= 0 && updatedPrinter) state.printers[printerIndex] = updatedPrinter;
      renderPrinterSelect();
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

    const defaultBtn = document.createElement('button');
    const isDefault = Number(state.settings.default_printer_id) === Number(printer.id);
    defaultBtn.className = `btn btn-icon-only printer-default-btn${isDefault ? ' is-default' : ''}`;
    defaultBtn.style.setProperty('color', isDefault ? '#f2c94c' : '#a3b0c2', 'important');
    if (isDefault) defaultBtn.style.setProperty('background-color', 'rgba(242, 201, 76, 0.16)', 'important');
    defaultBtn.type = 'button';
    const starColor = isDefault ? '#f2c94c' : '#a3b0c2';
    defaultBtn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="${isDefault ? starColor : 'none'}" stroke="${starColor}" stroke-width="${isDefault ? '0' : '1.2'}" d="m8 1.2 2.05 4.16 4.59.67-3.32 3.24.78 4.57L8 11.68l-4.1 2.16.78-4.57L1.36 6.03l4.59-.67L8 1.2z"/></svg>`;
    defaultBtn.title = isDefault ? 'Default printer' : 'Set as default printer';
    defaultBtn.setAttribute('aria-label', defaultBtn.title);
    defaultBtn.addEventListener('click', async () => {
      state.settings.default_printer_id = printer.id;
      renderPrinters();
      renderPrinterSelect();
      computePreview();
      const result = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electricity_cost_per_kwh: Number(el.electricityCost.value || 0),
          printer_power_kw: Number(el.printerPowerW.value || 0) / 1000,
          default_margin_percent: Number(el.defaultMargin.value || 0),
          rounding_mode: el.roundingMode.value,
          currency: el.currency.value,
          default_printer_id: printer.id,
        }),
      });
      if (!result.ok) {
        await loadState();
        return handleApiError(result);
      }
      const data = await result.json();
      state.settings = data.settings;
      renderPrinters();
      renderPrinterSelect();
      computePreview();
      setStatus('Default printer updated.', 'ok');
    });

    row.appendChild(nameInput);
    row.appendChild(powerGroup);
    row.appendChild(defaultBtn);
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

    bindAutoSave([input], async () => {
      const result = await fetch(`/api/filament-types/${type.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
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

    bindAutoSave([input], async () => {
      const result = await fetch(`/api/filament-manufacturers/${manufacturer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value }),
      });
      if (!result.ok) return handleApiError(result);
      await loadState();
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
    costAddon.className = 'input-addon filament-currency-addon';
    costAddon.textContent = `${currencyCode()}/kg`;
    costGroup.appendChild(costInput);
    costGroup.appendChild(costAddon);

    bindAutoSave([manufacturerSelect, typeSelect, colorInput, costInput], async () => {
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
  const electricity = printTime * Number(calc.electricity_cost_per_kwh_snapshot || 0) * Number(calc.printer_power_kw_snapshot || 0);
  const margin = calc.margin_override_percent === null || calc.margin_override_percent === undefined
    ? Number(calc.default_margin_percent_snapshot || 0)
    : Number(calc.margin_override_percent || 0);

  const details = Array.isArray(calc.filament_details) ? calc.filament_details : [];
  const filamentCost = getSavedFilamentSnapshots(calc).reduce((totalCost, f) => {
    const detail = details.find((item) => Number(item.filament_id) === Number(f.id));
    const filamentUsed = detail ? Number(detail.used_grams || 0) : Number(calc.filament_used_grams || 0);
    return totalCost + (filamentUsed / 1000) * Number(f.cost_per_kg || 0);
  }, 0);
  const finalPrice = roundFinalPrice(
    (filamentCost + electricity) * (1 + margin / 100),
    calc.rounding_override || state.settings.rounding_mode || 'none',
  );

  return { min: finalPrice, max: finalPrice };
}
function renderCalculationsList() {
  el.savedList.innerHTML = '';
  const query = (el.savedCalculationsSearch?.value || '').trim().toLowerCase();
  const licenseFilter = el.savedCommercialFilter?.value || 'all';
  const savedCalculations = state.calculations.filter((calc) => {
    const name = typeof calc.name === 'string' ? calc.name.trim() : '';
    const commercialAllowed = Boolean(Number(calc.commercial_use_allowed || 0));
    const matchesLicense = licenseFilter === 'all'
      || (licenseFilter === 'allowed' && commercialAllowed)
      || (licenseFilter === 'restricted' && !commercialAllowed);
    return name && matchesLicense && (!query || name.toLowerCase().includes(query));
  });
  const sortMode = el.savedCalculationsSort?.value || 'newest';
  savedCalculations.sort((a, b) => {
    if (sortMode === 'name-asc' || sortMode === 'name-desc') {
      const comparison = String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
      return sortMode === 'name-asc' ? comparison : -comparison;
    }
    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
    return sortMode === 'oldest' ? aDate - bDate : bDate - aDate;
  });
  if (savedCalculations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = query ? 'No matching calculations found.' : 'No saved calculations yet.';
    el.savedList.appendChild(empty);
    return;
  }

  savedCalculations.forEach((calc) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `saved-item ${calc.id === state.selectedCalculationId ? 'active' : ''}`;
    if (calc.default_gallery_image_url) item.style.setProperty('--saved-image', `url("${calc.default_gallery_image_url}")`);

    const licenseIcon = document.createElement('span');
    const commercialAllowed = Boolean(Number(calc.commercial_use_allowed || 0));
    licenseIcon.className = `saved-license-icon ${commercialAllowed ? 'commercial-allowed' : 'commercial-restricted'}`;
    licenseIcon.title = commercialAllowed ? 'Commercial use allowed' : 'Commercial use not allowed';
    licenseIcon.setAttribute('aria-label', licenseIcon.title);
    licenseIcon.innerHTML = commercialAllowed
      ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2 13 3v3.7c0 3.3-2.1 6.2-5 7.9-2.9-1.7-5-4.6-5-7.9V3l5-1.8zm-1 8.9 4-4-.9-.9L7 8.3 5.9 7.2l-.9.9L7 10.1z"/></svg>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2 13 3v3.7c0 3.3-2.1 6.2-5 7.9-2.9-1.7-5-4.6-5-7.9V3l5-1.8zM6.1 6.1l3.8 3.8.9-.9L7 5.2l-.9.9zM7 9.9l3.8-3.8-.9-.9-3.8 3.8.9.9z"/></svg>';
    item.appendChild(licenseIcon);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = calc.name || 'Untitled';

    const meta = document.createElement('span');
    meta.className = 'meta';
    let range = getSavedPriceRange(calc);
    if (calc.id === state.selectedCalculationId) {
      const scenario = buildScenarioRowsFromSelection();
      const liveTotal = scenario.electricityCost + scenario.rows.reduce((total, row) => total + Number(row.filamentCost || 0), 0);
      const liveFinalPrice = roundFinalPrice(liveTotal * (1 + scenario.margin / 100), scenario.roundingMode);
      range = { min: liveFinalPrice, max: liveFinalPrice };
    }
    const price = document.createElement('span');
    price.className = 'price-value';
    price.textContent = Math.abs(range.max - range.min) > 0.000001
      ? `${formatCurrency(range.min)} - ${formatCurrency(range.max)}`
      : formatCurrency(range.min);

    meta.appendChild(price);
    const updated = document.createElement('span');
    updated.className = 'saved-item-date';
    const updatedAt = calc.updated_at || calc.created_at;
    updated.textContent = updatedAt ? new Date(updatedAt).toLocaleString() : '';
    item.appendChild(name);
    item.appendChild(meta);
    item.appendChild(updated);
    item.addEventListener('click', () => {
      state.selectedCalculationId = calc.id;
      loadCalculationToForm(calc);
      syncCalculationUrl(calc);
      renderCalculationsList();
      setManagementModalOpen('savedItemsModal', false);
      setStatus('Loaded calculation.', 'ok');
    });

    el.savedList.appendChild(item);
  });
}

function calculationSlug(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function syncModelUrlButton() {
  el.openModelUrlBtn.disabled = !el.modelUrl.value.trim();
}

function syncCalculationUrl(calc) {
  const path = calc && calc.name
    ? `/calculations/${calculationSlug(calc.name)}`
    : '/';
  window.history.replaceState({}, '', path);
}

function updateCalculationInfo(calc) {
  el.calcUpdatedInfo.textContent = calc ? `Updated: ${new Date(calc.updated_at).toLocaleString()}` : '';
}

function loadCalculationToForm(calc) {
  el.calcName.value = calc.name || '';
  el.additionalComments.value = calc.additional_comments || '';
  el.modelUrl.value = calc.model_url || '';
  syncModelUrlButton();
  el.commercialUseAllowed.checked = Boolean(Number(calc.commercial_use_allowed));
  setPrintTimeFields(calc.print_time_hours);
  el.marginOverride.value = calc.margin_override_percent ?? '';
  el.roundingOverride.dataset.usesDefault = calc.rounding_override ? '0' : '1';
  el.roundingOverride.value = calc.rounding_override || '';
  syncRoundingOverrideDisplay();
  el.calcPrinter.value = calc.printer_id ? String(calc.printer_id) : '';

  const savedParts = Array.isArray(calc.print_parts) && calc.print_parts.length > 0 ? calc.print_parts : [];
  const fromArray = Array.isArray(calc.selected_filament_ids) ? calc.selected_filament_ids : [];
  const details = Array.isArray(savedParts[0]?.filament_details)
    ? savedParts[0].filament_details
    : Array.isArray(calc.filament_details) ? calc.filament_details : [];
  if (details.length > 0) {
    state.filamentSlots = details.map((slot) => ({
      filament_id: state.filaments.some((f) => f.id === Number(slot.filament_id)) ? Number(slot.filament_id) : null,
      used_grams: slot.used_grams ?? '',
    }));
  } else if (fromArray.length > 0) {
    state.filamentSlots = fromArray
      .filter((id) => state.filaments.some((f) => f.id === id))
      .map((id) => ({ filament_id: id, used_grams: calc.filament_used_grams || '' }));
  } else if (calc.filament_id && state.filaments.some((f) => f.id === calc.filament_id)) {
    state.filamentSlots = [{ filament_id: calc.filament_id, used_grams: calc.filament_used_grams || '' }];
  } else {
    state.filamentSlots = [];
  }

  while (state.filamentSlots.length < 4) {
    state.filamentSlots.push({ filament_id: null, used_grams: '' });
  }

  syncSelectedFilamentIds();
  renderFilamentSlots();
  while (el.printParts.querySelectorAll('.print-part').length < savedParts.length) {
    el.addPrintPartBtn.click();
  }
  savedParts.forEach((savedPart, partIndex) => {
    const part = el.printParts.querySelectorAll('.print-part')[partIndex];
    if (!part) return;
    const nameInput = part.querySelector('.print-part-name');
    nameInput.placeholder = `Print Part ${partIndex + 1}`;
    nameInput.value = savedPart.name || '';
    const totalMinutes = Math.round(Number(savedPart.print_time_hours || 0) * 60);
    part.querySelector('.print-part-hours').value = Math.floor(totalMinutes / 60);
    part.querySelector('.print-part-minutes').value = totalMinutes % 60;
    part.querySelector('.print-part-printer').value = savedPart.printer_id ? String(savedPart.printer_id) : '';
    const savedDetails = Array.isArray(savedPart.filament_details) ? savedPart.filament_details : [];
    const slots = part.querySelectorAll('.filament-slot');
    savedDetails.forEach((detail, slotIndex) => {
      if (slotIndex >= slots.length) return;
      slots[slotIndex].querySelector('.filament-slot-select').value = detail.filament_id ? String(detail.filament_id) : '';
      slots[slotIndex].querySelector('.filament-slot-used').value = detail.used_grams ?? '';
    });
  });
  el.deleteCalculationBtn.disabled = false;
  updateCalculationInfo(calc);
  loadGalleryImages();
  computePreview();
}

function resetForm() {
  window.clearTimeout(calculationSaveTimeout);
  calculationSavePending = false;
  el.printParts.querySelectorAll('.print-part').forEach((part, index) => {
    if (index > 0) part.remove();
  });
  const firstPartName = el.printParts.querySelector('.print-part-name');
  if (firstPartName) {
    firstPartName.value = '';
    firstPartName.placeholder = 'Print Part 1';
  }
  state.selectedCalculationId = null;
  state.galleryImages = [];
  renderGallery();
  syncCalculationUrl(null);
  el.calcName.value = '';
  el.additionalComments.value = '';
  el.modelUrl.value = '';
  syncModelUrlButton();
  el.commercialUseAllowed.checked = false;
  el.printTimeHours.value = '';
  el.printTimeMinutes.value = '';
  el.marginOverride.value = '';
  el.roundingOverride.dataset.usesDefault = '1';
  syncRoundingOverrideDisplay();
  el.calcPrinter.value = '';
  state.filamentSlots = Array.from({ length: 4 }, () => ({ filament_id: null, used_grams: '' }));
  syncSelectedFilamentIds();
  renderFilamentSlots();
  el.deleteCalculationBtn.disabled = true;
  updateCalculationInfo(null);
  renderCalculationsList();
  computePreview();
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
  el.filamentInUseText.textContent = `${filamentName} is used by saved calculations and cannot be deleted.`;
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
  if (response.status === 401) {
    showWelcome(true);
    window.history.replaceState({}, '', '/login');
  }
  let message = 'Request failed.';
  try {
    const body = await response.json();
    if (body && body.error) message = body.error;
  } catch (_error) {
    // ignore
  }
  setStatus(message, 'error');
}

async function saveCalculation() {
  if (!el.calcName.value.trim()) {
    setStatus('Calculation name is required before saving.', 'error');
    return;
  }
  if (calculationSaveInFlight) {
    calculationSavePending = true;
    return;
  }

  calculationSaveInFlight = true;
  const payload = readCalculationForm();
  const isEdit = Number.isInteger(state.selectedCalculationId) && state.selectedCalculationId > 0;

  try {
    const result = await fetch(isEdit ? `/api/calculations/${state.selectedCalculationId}` : '/api/calculations', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!result.ok) return handleApiError(result);
    const data = await result.json();
    state.selectedCalculationId = data.calculation.id;
    syncCalculationUrl(data.calculation);
    const savedCalculation = {
      ...data.calculation,
      selected_filament_ids: payload.filament_ids,
      filament_details: payload.filament_details,
      print_parts: payload.print_parts,
      selected_filaments_snapshot: getSelectedFilaments().map((filament) => ({
        id: filament.id,
        name: filament.name,
        cost_per_kg: filament.cost_per_kg,
      })),
    };
    const savedIndex = state.calculations.findIndex((calc) => calc.id === savedCalculation.id);
    if (savedIndex >= 0) state.calculations[savedIndex] = savedCalculation;
    else state.calculations.push(savedCalculation);
    renderCalculationsList();
    el.deleteCalculationBtn.disabled = false;
    setStatus(isEdit ? 'Calculation updated.' : 'Calculation saved.', 'ok');
  } finally {
    calculationSaveInFlight = false;
    if (calculationSavePending) {
      calculationSavePending = false;
      scheduleCalculationSave();
    }
  }
}

function scheduleCalculationSave() {
  // Calculation persistence is manual; field changes only update the preview.
}

async function loadState() {
  const result = await fetch('/api/state');
  if (!result.ok) {
    if (result.status === 401) {
      showWelcome(true);
      return false;
    }
    return handleApiError(result);
  }

  const data = await result.json();
  state.settings = data.settings;
  state.features = data.features || { auth_enabled: false, import_export_enabled: false };
  el.importExportSection?.classList.toggle('hidden', !state.features.import_export_enabled);
  state.user = data.user || null;
  showWelcome(state.features.auth_enabled && !state.user);
  syncAccountMenu();
  if (!state.features.auth_enabled) setAccountMenuOpen(false);
  state.printers = Array.isArray(data.printers) ? data.printers : [];
  state.filamentTypes = Array.isArray(data.filament_types) ? data.filament_types : [];
  state.filamentManufacturers = Array.isArray(data.filament_manufacturers) ? data.filament_manufacturers : [];
  state.filaments = data.filaments;
  state.calculations = data.calculations;

  el.electricityCost.value = state.settings.electricity_cost_per_kwh;
  el.printerPowerW.value = formatPowerW(state.settings.printer_power_kw);
  el.defaultMargin.value = state.settings.default_margin_percent;
  el.roundingMode.value = state.settings.rounding_mode || 'none';
  el.currency.value = state.settings.currency || 'PLN';
  syncCurrencyLabels();

  renderPrinterSelect();
  renderPrinters();
  renderFilamentReferenceSelects();
  renderFilamentTypes();
  renderFilamentManufacturers();
  renderFilamentSlots();
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
  renderCalculationsList();
}
el.toggleLeftPanelBtn.addEventListener('click', () => {
  state.ui.leftCollapsed = !state.ui.leftCollapsed;
  syncPanelUI();
});

el.openSettingsModalBtn.addEventListener('click', () => setManagementModalOpen('settingsModal', true));
el.exportDataBtn?.addEventListener('click', async () => {
  el.exportDataBtn.disabled = true;
  try {
    const response = await fetch('/api/import-export/export');
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Unable to export data.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '3d-print-calculator-export.zip';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Export downloaded.', 'ok');
  } catch (error) { setStatus(error.message, 'error'); }
  finally { el.exportDataBtn.disabled = false; }
});
el.importDataFile?.addEventListener('change', async () => {
  const file = el.importDataFile.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('archive', file, file.name);
  try {
    const response = await fetch('/api/import-export/import', { method: 'POST', body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Unable to import data.');
    setStatus(payload.message || 'Import completed.', 'ok');
    setTimeout(() => window.location.reload(), 700);
  } catch (error) { setStatus(error.message, 'error'); }
  finally { el.importDataFile.value = ''; }
});
el.openSavedItemsModalBtn.addEventListener('click', () => setManagementModalOpen('savedItemsModal', true));
el.savedCalculationsSearch.addEventListener('input', renderCalculationsList);
el.savedCommercialFilter.addEventListener('change', renderCalculationsList);
el.savedCalculationsSort.addEventListener('change', renderCalculationsList);
el.openPrintersModalBtn.addEventListener('click', () => setManagementModalOpen('printersModal', true));
el.openFilamentsModalBtn.addEventListener('click', () => setManagementModalOpen('filamentsModal', true));
el.accountMenuBtn.addEventListener('click', () => setAccountMenuOpen(!state.ui.accountMenuOpen));
el.loginMenuItem.addEventListener('click', () => { setAccountMenuOpen(false); setAuthModalOpen(true, false); });
el.accountSettingsMenuItem.addEventListener('click', () => { setAccountMenuOpen(false); setManagementModalOpen('accountSettingsModal', true); });
el.registerMenuItem.addEventListener('click', () => { setAccountMenuOpen(false); setAuthModalOpen(true, true); });
el.authSwitchBtn.addEventListener('click', () => setAuthModalOpen(true, !state.ui.authRegisterMode));
el.logoutMenuItem.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  state.user = null;
  syncAccountMenu();
  window.location.assign('/login');
  setAccountMenuOpen(false);
  setStatus('Logged out.', 'ok');
});
el.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const endpoint = state.ui.authRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: el.authEmail.value, password: el.authPassword.value }) });
  if (!result.ok) return handleApiError(result);
  const data = await result.json();
  if (data.access_token) localStorage.setItem('access_token', data.access_token);
  state.user = data.user;
  syncAccountMenu();
  showWelcome(false);
  setAuthModalOpen(false);
  el.authForm.reset();
  setStatus(state.ui.authRegisterMode ? 'Account created.' : 'Logged in.', 'ok');
});
el.changePasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (el.newPassword.value !== el.confirmPassword.value) return setStatus('New passwords do not match.', 'error');
  const result = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: el.currentPassword.value, new_password: el.newPassword.value }) });
  if (!result.ok) return handleApiError(result);
  el.changePasswordForm.reset();
  setManagementModalOpen('accountSettingsModal', false);
  setStatus('Password changed.', 'ok');
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => setManagementModalOpen(button.dataset.closeModal, false));
});

document.querySelectorAll('.modal-backdrop').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) setManagementModalOpen(modal.id, false);
  });
});

document.querySelectorAll('[data-filament-tab]').forEach((tab) => {
  tab.addEventListener('click', () => setFilamentTab(tab.dataset.filamentTab));
});

el.calcPrinter.addEventListener('change', () => {
  computePreview();
  scheduleCalculationSave();
});

el.addPrintPartBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const source = el.printParts.querySelector('.print-part');
  if (!source) return;
  const part = source.cloneNode(true);
  const index = el.printParts.querySelectorAll('.print-part').length + 1;
  const removePartButton = document.createElement('button');
  removePartButton.className = 'btn btn-danger btn-icon-only print-part-remove';
  removePartButton.type = 'button';
  removePartButton.title = 'Remove print part';
  removePartButton.setAttribute('aria-label', 'Remove print part');
  removePartButton.innerHTML = getIconSvg('trash');
  part.querySelector('.print-part-actions').appendChild(removePartButton);
  part.querySelectorAll('input').forEach((input) => {
    input.value = '';
  });
  part.querySelectorAll('select').forEach((select) => {
    select.value = '';
  });
  part.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  part.querySelectorAll('.filament-slot').forEach((slot) => {
    slot.querySelector('.filament-slot-select').value = '';
    slot.querySelector('.filament-slot-used').value = '';
  });
  const nameInput = part.querySelector('.print-part-name');
  nameInput.value = '';
  nameInput.placeholder = `Print Part ${index}`;
  el.printParts.appendChild(part);
  el.printParts.parentElement.appendChild(el.addPrintPartBtn);
  computePreview();
});

document.addEventListener('input', (event) => {
  if (event.target.closest('.print-part')) {
    computePreview();
    scheduleCalculationSave();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.closest('.print-part')) {
    computePreview();
    scheduleCalculationSave();
  }
});

document.addEventListener('click', (event) => {
  const clearPartButton = event.target.closest('.print-part-clear');
  if (clearPartButton) {
    const part = clearPartButton.closest('.print-part');
    const partIndex = Array.from(el.printParts.querySelectorAll('.print-part')).indexOf(part);
    const nameInput = part.querySelector('.print-part-name');
    nameInput.value = '';
    nameInput.placeholder = `Print Part ${partIndex + 1}`;
    part.querySelector('.print-part-hours').value = '';
    part.querySelector('.print-part-minutes').value = '';
    part.querySelector('.print-part-printer').value = '';
    part.querySelectorAll('.filament-slot').forEach((slot) => {
      slot.querySelector('.filament-slot-select').value = '';
      slot.querySelector('.filament-slot-used').value = '';
    });
    computePreview();
    return;
  }
  const removePartButton = event.target.closest('.print-part-remove');
  if (removePartButton) {
    removePartButton.closest('.print-part').remove();
    computePreview();
    scheduleCalculationSave();
    return;
  }

  const clearButton = event.target.closest('.filament-slot-clear');
  if (clearButton && !clearButton.closest('.print-part')?.querySelector('#filamentSlots')) {
    const slot = clearButton.closest('.filament-slot');
    slot.querySelector('.filament-slot-select').value = '';
    slot.querySelector('.filament-slot-used').value = '';
    computePreview();
    scheduleCalculationSave();
  }
});

async function saveSettings() {
  state.settings.rounding_mode = el.roundingMode.value;
  computePreview();
  const result = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      electricity_cost_per_kwh: Number(el.electricityCost.value || 0),
      printer_power_kw: Number(el.printerPowerW.value || 0) / 1000,
      default_margin_percent: Number(el.defaultMargin.value || 0),
      rounding_mode: el.roundingMode.value,
      currency: el.currency.value,
      default_printer_id: state.settings.default_printer_id || null,
    }),
  });
  if (!result.ok) return handleApiError(result);
  const data = await result.json();
  state.settings = data.settings;
  if (['PLN', 'EUR', 'USD'].includes(state.settings.currency)) {
    el.currency.value = state.settings.currency;
  } else {
    state.settings.currency = el.currency.value || 'PLN';
  }
  syncCurrencyLabels();
  renderPrinterSelect();
  syncMarginOverridePlaceholder();
  computePreview();
}

function scheduleSettingsSave() {
  window.clearTimeout(saveSettingsTimeout);
  saveSettingsTimeout = window.setTimeout(() => {
    saveSettings();
  }, 400);
}

[el.electricityCost, el.printerPowerW, el.defaultMargin, el.roundingMode, el.currency].forEach((node) => {
  node.addEventListener('input', scheduleSettingsSave);
  node.addEventListener('change', scheduleSettingsSave);
});

el.currency.addEventListener('change', () => {
  state.settings.currency = el.currency.value;
  syncCurrencyLabels();
  computePreview();
  renderCalculationsList();
});

el.roundingMode.addEventListener('change', () => {
  state.settings.rounding_mode = el.roundingMode.value;
  syncRoundingOverrideDisplay();
  if (el.roundingOverride.dataset.usesDefault === '1') computePreview();
});

el.roundingOverride.addEventListener('change', () => {
  el.roundingOverride.dataset.usesDefault = '0';
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

// A space pressed while editing a printer name must be treated as text input.
// Keep it from bubbling to any page-level keyboard shortcut or focused control
// without preventing the browser from inserting the space into the field.
el.newPrinterName.addEventListener('keydown', (event) => {
  if (event.key === ' ') event.stopPropagation();
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

el.newCalculationBtn.addEventListener('click', () => {
  resetForm();
  setManagementModalOpen('savedItemsModal', false);
});
el.openModelUrlBtn.addEventListener('click', () => {
  const value = el.modelUrl.value.trim();
  if (!value) return setStatus('Enter a model URL first.', 'error');
  try {
    const url = new URL(value);
    window.open(url.href, '_blank', 'noopener,noreferrer');
  } catch (_error) {
    setStatus('Enter a valid model URL.', 'error');
  }
});
el.modelUrl.addEventListener('input', syncModelUrlButton);
el.saveCalculationBtn.addEventListener('click', saveCalculation);
el.clearCalculationBtn.addEventListener('click', resetForm);
el.addGalleryImageBtn.addEventListener('click', () => {
  if (!state.selectedCalculationId) return setStatus('Save the calculation before adding gallery images.', 'error');
  const files = Array.from(el.galleryImageFiles.files || []);
  if (!files.length) return setStatus('Choose at least one image.', 'error');
  el.addGalleryImageBtn.disabled = true;
  Promise.all(files.map(async (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    const result = await fetch(`/api/calculations/${state.selectedCalculationId}/gallery`, { method: 'POST', body: formData });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(payload.error || 'Unable to upload image.');
    return payload.image;
  })).then((images) => {
    state.galleryImages.push(...images);
    el.galleryImageFiles.value = '';
    renderGallery();
    syncSavedCalculationGalleryPreview();
    setStatus(`${images.length} image${images.length === 1 ? '' : 's'} uploaded.`, 'ok');
  }).catch((error) => {
    setStatus(error.message || 'Unable to upload image.', 'error');
  }).finally(() => {
    el.addGalleryImageBtn.disabled = false;
  });
});

el.galleryImageFiles.addEventListener('change', () => {
  const count = el.galleryImageFiles.files.length;
  if (count) el.addGalleryImageBtn.click();
});
el.galleryCloseBtn.addEventListener('click', () => el.galleryViewer.classList.add('hidden'));
el.galleryViewer.addEventListener('click', (event) => { if (event.target === el.galleryViewer) el.galleryViewer.classList.add('hidden'); });
el.galleryPrevBtn.addEventListener('click', () => openGalleryViewer((state.galleryViewerIndex - 1 + state.galleryImages.length) % state.galleryImages.length));
el.galleryNextBtn.addEventListener('click', () => openGalleryViewer((state.galleryViewerIndex + 1) % state.galleryImages.length));
document.addEventListener('keydown', (event) => {
  if (el.galleryViewer.classList.contains('hidden')) return;
  if (event.key === 'Escape') {
    el.galleryViewer.classList.add('hidden');
  } else if (event.key === 'ArrowLeft' && state.galleryImages.length > 1) {
    event.preventDefault();
    openGalleryViewer((state.galleryViewerIndex - 1 + state.galleryImages.length) % state.galleryImages.length);
  } else if (event.key === 'ArrowRight' && state.galleryImages.length > 1) {
    event.preventDefault();
    openGalleryViewer((state.galleryViewerIndex + 1) % state.galleryImages.length);
  }
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
[el.settingsModal, el.printersModal, el.filamentsModal].forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) setManagementModalOpen(modal.id, false);
  });
});

document.addEventListener('click', (event) => {
  if (!el.accountMenuBtn.contains(event.target) && !el.accountMenu.contains(event.target)) setAccountMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.ui.deleteModalOpen) closeDeleteModal();
  if (state.ui.filamentDeleteModalOpen) closeFilamentDeleteModal();
  if (state.ui.filamentInUseModalOpen) closeFilamentInUseModal();
  if (state.ui.settingsModalOpen) setManagementModalOpen('settingsModal', false);
  if (state.ui.printersModalOpen) setManagementModalOpen('printersModal', false);
  if (state.ui.filamentsModalOpen) setManagementModalOpen('filamentsModal', false);
  if (state.ui.accountMenuOpen) setAccountMenuOpen(false);
});

[el.printTimeHours, el.printTimeMinutes].forEach((node) => {
  node.addEventListener('input', () => {
    normalizeTimeInputs();
    computePreview();
    scheduleCalculationSave();
  });
  node.addEventListener('change', () => {
    normalizeTimeInputs();
    computePreview();
    scheduleCalculationSave();
  });
});

[el.calcName, el.marginOverride, el.roundingOverride, el.additionalComments, el.modelUrl, el.commercialUseAllowed].forEach((node) => {
  node.addEventListener('input', () => {
    computePreview();
    scheduleCalculationSave();
  });
  node.addEventListener('change', () => {
    computePreview();
    scheduleCalculationSave();
  });
});

loadPanelState();
syncPanelUI();
loadState().then((loaded) => {
  if (loaded === false) return;
  const routeMatch = window.location.pathname.match(/^\/calculations\/([^/]+)\/?$/);
  const requestedSlug = routeMatch ? decodeURIComponent(routeMatch[1]) : null;
  resetForm();
  if (requestedSlug) {
    const requestedCalculation = state.calculations.find((calc) => calculationSlug(calc.name) === requestedSlug);
    if (requestedCalculation) {
      state.selectedCalculationId = requestedCalculation.id;
      loadCalculationToForm(requestedCalculation);
      syncCalculationUrl(requestedCalculation);
    }
  }
  if (state.features.auth_enabled && (window.location.pathname === '/login' || window.location.pathname === '/register')) {
    setAuthModalOpen(true, window.location.pathname === '/register');
  }
}).catch((error) => {
  setStatus(error.message || 'Failed to load app state.', 'error');
});

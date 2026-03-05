const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = process.env.PORT || 3000;

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function parseNumber(value, fieldName, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a number.`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(`${fieldName} must be >= ${options.min}.`);
  }
  return number;
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function composeFilamentName(manufacturerName, typeName, color) {
  return [manufacturerName, typeName, color]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      electricity_cost_per_kwh REAL NOT NULL DEFAULT 0,
      printer_power_kw REAL NOT NULL DEFAULT 0.3,
      default_margin_percent REAL NOT NULL DEFAULT 20,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filament_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filament_manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS printers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      power_kw REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      manufacturer_id INTEGER,
      type_id INTEGER,
      color TEXT,
      cost_per_kg REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manufacturer_id) REFERENCES filament_manufacturers(id),
      FOREIGN KEY (type_id) REFERENCES filament_types(id)
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      additional_comments TEXT,
      model_url TEXT,
      print_time_hours REAL NOT NULL,
      filament_id INTEGER,
      printer_id INTEGER,
      selected_filament_ids_json TEXT NOT NULL DEFAULT '[]',
      filament_used_grams REAL NOT NULL,
      margin_override_percent REAL,
      electricity_cost_per_kwh_snapshot REAL NOT NULL,
      printer_power_kw_snapshot REAL NOT NULL DEFAULT 0.3,
      printer_name_snapshot TEXT,
      default_margin_percent_snapshot REAL NOT NULL,
      filament_name_snapshot TEXT,
      filament_cost_per_kg_snapshot REAL,
      selected_filaments_snapshot_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (filament_id) REFERENCES filaments(id),
      FOREIGN KEY (printer_id) REFERENCES printers(id)
    );

    INSERT INTO app_settings (id, electricity_cost_per_kwh, printer_power_kw, default_margin_percent)
    SELECT 1, 0, 0.3, 20
    WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
  `);

  const settingsCols = db.prepare('PRAGMA table_info(app_settings)').all().map((c) => c.name);
  if (!settingsCols.includes('printer_power_kw')) {
    db.exec('ALTER TABLE app_settings ADD COLUMN printer_power_kw REAL NOT NULL DEFAULT 0.3');
  }

  const filamentCols = db.prepare('PRAGMA table_info(filaments)').all().map((c) => c.name);
  if (!filamentCols.includes('manufacturer_id')) {
    db.exec('ALTER TABLE filaments ADD COLUMN manufacturer_id INTEGER');
  }
  if (!filamentCols.includes('type_id')) {
    db.exec('ALTER TABLE filaments ADD COLUMN type_id INTEGER');
  }
  if (!filamentCols.includes('color')) {
    db.exec('ALTER TABLE filaments ADD COLUMN color TEXT');
  }
  if (!filamentCols.includes('name')) {
    db.exec('ALTER TABLE filaments ADD COLUMN name TEXT');
  }

  const calcCols = db.prepare('PRAGMA table_info(calculations)').all().map((c) => c.name);
  if (!calcCols.includes('printer_power_kw_snapshot')) {
    db.exec('ALTER TABLE calculations ADD COLUMN printer_power_kw_snapshot REAL NOT NULL DEFAULT 0.3');
  }
  if (!calcCols.includes('additional_comments')) {
    db.exec('ALTER TABLE calculations ADD COLUMN additional_comments TEXT');
  }
  if (!calcCols.includes('model_url')) {
    db.exec('ALTER TABLE calculations ADD COLUMN model_url TEXT');
  }
  if (!calcCols.includes('selected_filament_ids_json')) {
    db.exec("ALTER TABLE calculations ADD COLUMN selected_filament_ids_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!calcCols.includes('selected_filaments_snapshot_json')) {
    db.exec("ALTER TABLE calculations ADD COLUMN selected_filaments_snapshot_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!calcCols.includes('printer_id')) {
    db.exec('ALTER TABLE calculations ADD COLUMN printer_id INTEGER');
  }
  if (!calcCols.includes('printer_name_snapshot')) {
    db.exec('ALTER TABLE calculations ADD COLUMN printer_name_snapshot TEXT');
  }

  const insertType = db.prepare(`
    INSERT INTO filament_types (name, updated_at)
    SELECT ?, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM filament_types WHERE lower(name) = lower(?))
  `);
  ['PLA', 'PET-G', 'TPU', 'Generic'].forEach((name) => insertType.run(name, name));

  const insertManufacturer = db.prepare(`
    INSERT INTO filament_manufacturers (name, updated_at)
    SELECT ?, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM filament_manufacturers WHERE lower(name) = lower(?))
  `);
  insertManufacturer.run('Unknown', 'Unknown');

  const unknownManufacturer = db.prepare('SELECT id FROM filament_manufacturers WHERE lower(name) = lower(?)').get('Unknown');
  const genericType = db.prepare('SELECT id FROM filament_types WHERE lower(name) = lower(?)').get('Generic');

  if (unknownManufacturer && genericType) {
    db.prepare('UPDATE filaments SET manufacturer_id = ? WHERE manufacturer_id IS NULL').run(unknownManufacturer.id);
    db.prepare('UPDATE filaments SET type_id = ? WHERE type_id IS NULL').run(genericType.id);
    db.prepare("UPDATE filaments SET color = COALESCE(NULLIF(trim(name), ''), 'Unknown') WHERE color IS NULL OR trim(color) = ''").run();
  }

  db.prepare(`
    INSERT INTO printers (name, power_kw, updated_at)
    SELECT 'Default printer', 0.3, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM printers)
  `).run();

  db.prepare(`
    UPDATE app_settings
    SET printer_power_kw = 0.3
    WHERE abs(printer_power_kw - 0.12) < 0.000001 OR printer_power_kw IS NULL
  `).run();
}

initDb();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getSettings() {
  return db.prepare('SELECT electricity_cost_per_kwh, printer_power_kw, default_margin_percent FROM app_settings WHERE id = 1').get();
}

function getFilamentTypes() {
  return db.prepare('SELECT id, name FROM filament_types ORDER BY name COLLATE NOCASE').all();
}

function getFilamentManufacturers() {
  return db.prepare('SELECT id, name FROM filament_manufacturers ORDER BY name COLLATE NOCASE').all();
}

function getPrinters() {
  const rows = db.prepare('SELECT id, name, power_kw FROM printers ORDER BY name COLLATE NOCASE').all();
  return rows.map((row) => ({
    ...row,
    power_w: row.power_kw * 1000,
  }));
}

function getFilaments() {
  const rows = db.prepare(`
    SELECT
      f.id,
      f.manufacturer_id,
      f.type_id,
      f.color,
      f.cost_per_kg,
      m.name AS manufacturer_name,
      t.name AS type_name
    FROM filaments f
    LEFT JOIN filament_manufacturers m ON m.id = f.manufacturer_id
    LEFT JOIN filament_types t ON t.id = f.type_id
    ORDER BY m.name COLLATE NOCASE, t.name COLLATE NOCASE, f.color COLLATE NOCASE
  `).all();

  return rows.map((row) => ({
    ...row,
    name: composeFilamentName(row.manufacturer_name || 'Unknown', row.type_name || 'Generic', row.color || 'Unknown'),
  }));
}

function getFilamentById(id) {
  const row = db.prepare(`
    SELECT
      f.id,
      f.manufacturer_id,
      f.type_id,
      f.color,
      f.cost_per_kg,
      m.name AS manufacturer_name,
      t.name AS type_name
    FROM filaments f
    LEFT JOIN filament_manufacturers m ON m.id = f.manufacturer_id
    LEFT JOIN filament_types t ON t.id = f.type_id
    WHERE f.id = ?
  `).get(id);

  if (!row) {
    return null;
  }

  return {
    ...row,
    name: composeFilamentName(row.manufacturer_name || 'Unknown', row.type_name || 'Generic', row.color || 'Unknown'),
  };
}

function getCalculations() {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.additional_comments,
      c.model_url,
      c.print_time_hours,
      c.filament_id,
      c.printer_id,
      c.selected_filament_ids_json,
      c.filament_used_grams,
      c.margin_override_percent,
      c.electricity_cost_per_kwh_snapshot,
      c.printer_power_kw_snapshot,
      c.printer_name_snapshot,
      c.default_margin_percent_snapshot,
      c.filament_name_snapshot,
      c.filament_cost_per_kg_snapshot,
      c.selected_filaments_snapshot_json,
      c.created_at,
      c.updated_at
    FROM calculations c
    ORDER BY datetime(c.updated_at) DESC, c.id DESC
  `).all();

  return rows.map((row) => ({
    ...row,
    selected_filament_ids: parseJsonArray(row.selected_filament_ids_json),
    selected_filaments_snapshot: parseJsonArray(row.selected_filaments_snapshot_json),
  }));
}

app.get('/api/state', (_req, res) => {
  res.json({
    settings: getSettings(),
    printers: getPrinters(),
    filament_types: getFilamentTypes(),
    filament_manufacturers: getFilamentManufacturers(),
    filaments: getFilaments(),
    calculations: getCalculations(),
  });
});

app.put('/api/settings', (req, res) => {
  try {
    const electricityCost = parseNumber(req.body.electricity_cost_per_kwh, 'electricity_cost_per_kwh', { min: 0 });
    const printerPowerKw = parseNumber(req.body.printer_power_kw, 'printer_power_kw', { min: 0 });
    const defaultMargin = parseNumber(req.body.default_margin_percent, 'default_margin_percent', { min: 0 });

    db.prepare(`
      UPDATE app_settings
      SET electricity_cost_per_kwh = ?,
          printer_power_kw = ?,
          default_margin_percent = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(electricityCost, printerPowerKw, defaultMargin);

    res.json({ settings: getSettings() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/printers', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }
    const powerW = parseNumber(req.body.power_w, 'power_w', { min: 0 });

    const result = db.prepare(`
      INSERT INTO printers (name, power_kw, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(name, powerW / 1000);

    const printer = db.prepare('SELECT id, name, power_kw FROM printers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ printer: { ...printer, power_w: printer.power_kw * 1000 } });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Printer name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/printers/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }
    const powerW = parseNumber(req.body.power_w, 'power_w', { min: 0 });

    const existing = db.prepare('SELECT id FROM printers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Printer not found.' });
    }

    db.prepare(`
      UPDATE printers
      SET name = ?, power_kw = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, powerW / 1000, id);

    const printer = db.prepare('SELECT id, name, power_kw FROM printers WHERE id = ?').get(id);
    res.json({ printer: { ...printer, power_w: printer.power_kw * 1000 } });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Printer name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/printers/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const usedBy = db.prepare('SELECT COUNT(*) AS count FROM calculations WHERE printer_id = ?').get(id);
    if (usedBy.count > 0) {
      return res.status(400).json({ error: `Printer cannot be deleted because ${usedBy.count} saved item(s) use it.` });
    }

    const result = db.prepare('DELETE FROM printers WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Printer not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/filament-types', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }

    const result = db.prepare(`
      INSERT INTO filament_types (name, updated_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `).run(name);

    const filamentType = db.prepare('SELECT id, name FROM filament_types WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ filament_type: filamentType });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Type name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/filament-types/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }

    const existing = db.prepare('SELECT id FROM filament_types WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Filament type not found.' });
    }

    db.prepare(`
      UPDATE filament_types
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, id);

    const filamentType = db.prepare('SELECT id, name FROM filament_types WHERE id = ?').get(id);
    res.json({ filament_type: filamentType });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Type name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/filament-types/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const usedBy = db.prepare('SELECT COUNT(*) AS count FROM filaments WHERE type_id = ?').get(id);
    if (usedBy.count > 0) {
      return res.status(400).json({ error: `Type cannot be deleted because ${usedBy.count} filament(s) use it.` });
    }

    const result = db.prepare('DELETE FROM filament_types WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Filament type not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/filament-manufacturers', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }

    const result = db.prepare(`
      INSERT INTO filament_manufacturers (name, updated_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `).run(name);

    const filamentManufacturer = db.prepare('SELECT id, name FROM filament_manufacturers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ filament_manufacturer: filamentManufacturer });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Manufacturer name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/filament-manufacturers/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }

    const existing = db.prepare('SELECT id FROM filament_manufacturers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Filament manufacturer not found.' });
    }

    db.prepare(`
      UPDATE filament_manufacturers
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, id);

    const filamentManufacturer = db.prepare('SELECT id, name FROM filament_manufacturers WHERE id = ?').get(id);
    res.json({ filament_manufacturer: filamentManufacturer });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Manufacturer name must be unique.' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/filament-manufacturers/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const usedBy = db.prepare('SELECT COUNT(*) AS count FROM filaments WHERE manufacturer_id = ?').get(id);
    if (usedBy.count > 0) {
      return res.status(400).json({ error: `Manufacturer cannot be deleted because ${usedBy.count} filament(s) use it.` });
    }

    const result = db.prepare('DELETE FROM filament_manufacturers WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Filament manufacturer not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/filaments', (req, res) => {
  try {
    const manufacturerId = parsePositiveInt(req.body.manufacturer_id, 'manufacturer_id');
    const typeId = parsePositiveInt(req.body.type_id, 'type_id');
    const color = String(req.body.color || '').trim();
    if (!color) {
      throw new Error('color is required.');
    }
    const costPerKg = parseNumber(req.body.cost_per_kg, 'cost_per_kg', { min: 0 });

    const manufacturer = db.prepare('SELECT id, name FROM filament_manufacturers WHERE id = ?').get(manufacturerId);
    if (!manufacturer) {
      throw new Error('manufacturer_id does not exist.');
    }

    const filamentType = db.prepare('SELECT id, name FROM filament_types WHERE id = ?').get(typeId);
    if (!filamentType) {
      throw new Error('type_id does not exist.');
    }

    const filamentName = composeFilamentName(manufacturer.name, filamentType.name, color);

    const result = db.prepare(`
      INSERT INTO filaments (name, manufacturer_id, type_id, color, cost_per_kg, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(filamentName, manufacturerId, typeId, color, costPerKg);

    const filament = getFilamentById(result.lastInsertRowid);
    res.status(201).json({ filament });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/filaments/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');

    const existing = db.prepare('SELECT id FROM filaments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Filament not found.' });
    }

    const manufacturerId = parsePositiveInt(req.body.manufacturer_id, 'manufacturer_id');
    const typeId = parsePositiveInt(req.body.type_id, 'type_id');
    const color = String(req.body.color || '').trim();
    if (!color) {
      throw new Error('color is required.');
    }
    const costPerKg = parseNumber(req.body.cost_per_kg, 'cost_per_kg', { min: 0 });

    const manufacturer = db.prepare('SELECT id, name FROM filament_manufacturers WHERE id = ?').get(manufacturerId);
    if (!manufacturer) {
      throw new Error('manufacturer_id does not exist.');
    }

    const filamentType = db.prepare('SELECT id, name FROM filament_types WHERE id = ?').get(typeId);
    if (!filamentType) {
      throw new Error('type_id does not exist.');
    }

    const filamentName = composeFilamentName(manufacturer.name, filamentType.name, color);

    db.prepare(`
      UPDATE filaments
      SET name = ?,
          manufacturer_id = ?,
          type_id = ?,
          color = ?,
          cost_per_kg = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(filamentName, manufacturerId, typeId, color, costPerKg, id);

    const filament = getFilamentById(id);
    res.json({ filament });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/filaments/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const result = db.prepare('DELETE FROM filaments WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Filament not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function buildCalculationPayload(input) {
  const settings = getSettings();

  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : null;
  const additionalComments = typeof input.additional_comments === 'string' && input.additional_comments.trim()
    ? input.additional_comments.trim()
    : null;
  const modelUrl = typeof input.model_url === 'string' && input.model_url.trim()
    ? input.model_url.trim()
    : null;
  const printTimeHours = parseNumber(input.print_time_hours, 'print_time_hours', { min: 0 });
  const filamentUsedGrams = parseNumber(input.filament_used_grams, 'filament_used_grams', { min: 0 });

  const hasOverride = input.margin_override_percent !== null
    && input.margin_override_percent !== undefined
    && String(input.margin_override_percent).trim() !== '';
  const marginOverride = hasOverride ? parseNumber(input.margin_override_percent, 'margin_override_percent', { min: 0 }) : null;

  const rawFilamentIds = Array.isArray(input.filament_ids) ? input.filament_ids : [];
  const uniqueIds = [...new Set(rawFilamentIds.map((id) => Number(id)))].filter((id) => Number.isInteger(id) && id > 0);

  const selectedFilaments = [];
  for (const id of uniqueIds) {
    const filament = getFilamentById(id);
    if (!filament) {
      throw new Error(`Selected filament ${id} does not exist.`);
    }
    selectedFilaments.push({
      id: filament.id,
      name: filament.name,
      cost_per_kg: filament.cost_per_kg,
    });
  }

  let printerId = null;
  let printerName = null;
  let printerPowerKw = Number(settings.printer_power_kw || 0.3);
  if (input.printer_id !== null && input.printer_id !== undefined && String(input.printer_id).trim() !== '') {
    printerId = parsePositiveInt(input.printer_id, 'printer_id');
    const printer = db.prepare('SELECT id, name, power_kw FROM printers WHERE id = ?').get(printerId);
    if (!printer) {
      throw new Error(`Selected printer ${printerId} does not exist.`);
    }
    printerName = printer.name;
    printerPowerKw = Number(printer.power_kw || printerPowerKw);
  }

  const firstFilament = selectedFilaments[0] || null;

  return {
    name,
    additionalComments,
    modelUrl,
    printTimeHours,
    printerId,
    printerName,
    filamentIdsJson: JSON.stringify(selectedFilaments.map((f) => f.id)),
    filamentId: firstFilament ? firstFilament.id : null,
    filamentUsedGrams,
    marginOverride,
    electricityCostSnapshot: settings.electricity_cost_per_kwh,
    printerPowerKwSnapshot: printerPowerKw,
    defaultMarginSnapshot: settings.default_margin_percent,
    filamentSnapshotName: firstFilament ? firstFilament.name : null,
    filamentSnapshotCost: firstFilament ? firstFilament.cost_per_kg : null,
    selectedFilamentsSnapshotJson: JSON.stringify(selectedFilaments),
  };
}

app.post('/api/calculations', (req, res) => {
  try {
    const payload = buildCalculationPayload(req.body);

    const result = db.prepare(`
      INSERT INTO calculations (
        name,
        additional_comments,
        model_url,
        print_time_hours,
        filament_id,
        printer_id,
        selected_filament_ids_json,
        filament_used_grams,
        margin_override_percent,
        electricity_cost_per_kwh_snapshot,
        printer_power_kw_snapshot,
        printer_name_snapshot,
        default_margin_percent_snapshot,
        filament_name_snapshot,
        filament_cost_per_kg_snapshot,
        selected_filaments_snapshot_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      payload.name,
      payload.additionalComments,
      payload.modelUrl,
      payload.printTimeHours,
      payload.filamentId,
      payload.printerId,
      payload.filamentIdsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.electricityCostSnapshot,
      payload.printerPowerKwSnapshot,
      payload.printerName,
      payload.defaultMarginSnapshot,
      payload.filamentSnapshotName,
      payload.filamentSnapshotCost,
      payload.selectedFilamentsSnapshotJson,
    );

    const calculation = db.prepare('SELECT * FROM calculations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ calculation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/calculations/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');

    const existing = db.prepare('SELECT id FROM calculations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Calculation not found.' });
    }

    const payload = buildCalculationPayload(req.body);

    db.prepare(`
      UPDATE calculations
      SET name = ?,
          additional_comments = ?,
          model_url = ?,
          print_time_hours = ?,
          filament_id = ?,
          printer_id = ?,
          selected_filament_ids_json = ?,
          filament_used_grams = ?,
          margin_override_percent = ?,
          electricity_cost_per_kwh_snapshot = ?,
          printer_power_kw_snapshot = ?,
          printer_name_snapshot = ?,
          default_margin_percent_snapshot = ?,
          filament_name_snapshot = ?,
          filament_cost_per_kg_snapshot = ?,
          selected_filaments_snapshot_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payload.name,
      payload.additionalComments,
      payload.modelUrl,
      payload.printTimeHours,
      payload.filamentId,
      payload.printerId,
      payload.filamentIdsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.electricityCostSnapshot,
      payload.printerPowerKwSnapshot,
      payload.printerName,
      payload.defaultMarginSnapshot,
      payload.filamentSnapshotName,
      payload.filamentSnapshotCost,
      payload.selectedFilamentsSnapshotJson,
      id,
    );

    const calculation = db.prepare('SELECT * FROM calculations WHERE id = ?').get(id);
    res.json({ calculation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/calculations/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const result = db.prepare('DELETE FROM calculations WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Calculation not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`3D print calculator running at http://localhost:${port}`);
});



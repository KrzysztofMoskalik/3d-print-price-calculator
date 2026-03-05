const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = process.env.PORT || 3000;

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      electricity_cost_per_kwh REAL NOT NULL DEFAULT 0,
      printer_power_kw REAL NOT NULL DEFAULT 0.12,
      default_margin_percent REAL NOT NULL DEFAULT 20,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS filaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost_per_kg REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      additional_comments TEXT,
      model_url TEXT,
      print_time_hours REAL NOT NULL,
      filament_id INTEGER,
      selected_filament_ids_json TEXT NOT NULL DEFAULT '[]',
      filament_used_grams REAL NOT NULL,
      margin_override_percent REAL,
      electricity_cost_per_kwh_snapshot REAL NOT NULL,
      printer_power_kw_snapshot REAL NOT NULL DEFAULT 0.12,
      default_margin_percent_snapshot REAL NOT NULL,
      filament_name_snapshot TEXT,
      filament_cost_per_kg_snapshot REAL,
      selected_filaments_snapshot_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (filament_id) REFERENCES filaments(id)
    );

    INSERT INTO app_settings (id, electricity_cost_per_kwh, printer_power_kw, default_margin_percent)
    SELECT 1, 0, 0.12, 20
    WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
  `);

  const settingsCols = db.prepare('PRAGMA table_info(app_settings)').all().map((c) => c.name);
  if (!settingsCols.includes('printer_power_kw')) {
    db.exec('ALTER TABLE app_settings ADD COLUMN printer_power_kw REAL NOT NULL DEFAULT 0.12');
  }

  const calcCols = db.prepare('PRAGMA table_info(calculations)').all().map((c) => c.name);
  if (!calcCols.includes('printer_power_kw_snapshot')) {
    db.exec('ALTER TABLE calculations ADD COLUMN printer_power_kw_snapshot REAL NOT NULL DEFAULT 0.12');
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
}

initDb();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function getSettings() {
  return db.prepare('SELECT electricity_cost_per_kwh, printer_power_kw, default_margin_percent FROM app_settings WHERE id = 1').get();
}

function getFilaments() {
  return db.prepare('SELECT id, name, cost_per_kg FROM filaments ORDER BY name COLLATE NOCASE').all();
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
      c.selected_filament_ids_json,
      c.filament_used_grams,
      c.margin_override_percent,
      c.electricity_cost_per_kwh_snapshot,
      c.printer_power_kw_snapshot,
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

app.get('/api/state', (req, res) => {
  res.json({
    settings: getSettings(),
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

app.post('/api/filaments', (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }
    const costPerKg = parseNumber(req.body.cost_per_kg, 'cost_per_kg', { min: 0 });

    const result = db.prepare(`
      INSERT INTO filaments (name, cost_per_kg, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(name, costPerKg);

    const filament = db.prepare('SELECT id, name, cost_per_kg FROM filaments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ filament });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/filaments/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('invalid filament id.');
    }

    const existing = db.prepare('SELECT id FROM filaments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Filament not found.' });
    }

    const name = (req.body.name || '').trim();
    if (!name) {
      throw new Error('name is required.');
    }

    const costPerKg = parseNumber(req.body.cost_per_kg, 'cost_per_kg', { min: 0 });

    db.prepare(`
      UPDATE filaments
      SET name = ?,
          cost_per_kg = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, costPerKg, id);

    const filament = db.prepare('SELECT id, name, cost_per_kg FROM filaments WHERE id = ?').get(id);
    res.json({ filament });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/filaments/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid filament id.' });
  }

  const result = db.prepare('DELETE FROM filaments WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Filament not found.' });
  }

  res.json({ success: true });
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

  const hasOverride = input.margin_override_percent !== null && input.margin_override_percent !== undefined && String(input.margin_override_percent).trim() !== '';
  const marginOverride = hasOverride ? parseNumber(input.margin_override_percent, 'margin_override_percent', { min: 0 }) : null;

  const rawFilamentIds = Array.isArray(input.filament_ids) ? input.filament_ids : [];
  const uniqueIds = [...new Set(rawFilamentIds.map((id) => Number(id)))].filter((id) => Number.isInteger(id) && id > 0);

  const selectedFilaments = [];
  for (const id of uniqueIds) {
    const filament = db.prepare('SELECT id, name, cost_per_kg FROM filaments WHERE id = ?').get(id);
    if (!filament) {
      throw new Error(`Selected filament ${id} does not exist.`);
    }
    selectedFilaments.push(filament);
  }

  const firstFilament = selectedFilaments[0] || null;

  return {
    name,
    additionalComments,
    modelUrl,
    printTimeHours,
    filamentIdsJson: JSON.stringify(selectedFilaments.map((f) => f.id)),
    filamentId: firstFilament ? firstFilament.id : null,
    filamentUsedGrams,
    marginOverride,
    electricityCostSnapshot: settings.electricity_cost_per_kwh,
    printerPowerKwSnapshot: settings.printer_power_kw,
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
        selected_filament_ids_json,
        filament_used_grams,
        margin_override_percent,
        electricity_cost_per_kwh_snapshot,
        printer_power_kw_snapshot,
        default_margin_percent_snapshot,
        filament_name_snapshot,
        filament_cost_per_kg_snapshot,
        selected_filaments_snapshot_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      payload.name,
      payload.additionalComments,
      payload.modelUrl,
      payload.printTimeHours,
      payload.filamentId,
      payload.filamentIdsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.electricityCostSnapshot,
      payload.printerPowerKwSnapshot,
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
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('invalid calculation id.');
    }

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
          selected_filament_ids_json = ?,
          filament_used_grams = ?,
          margin_override_percent = ?,
          electricity_cost_per_kwh_snapshot = ?,
          printer_power_kw_snapshot = ?,
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
      payload.filamentIdsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.electricityCostSnapshot,
      payload.printerPowerKwSnapshot,
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
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid calculation id.' });
  }

  const result = db.prepare('DELETE FROM calculations WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Calculation not found.' });
  }

  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`3D print calculator running at http://localhost:${port}`);
});

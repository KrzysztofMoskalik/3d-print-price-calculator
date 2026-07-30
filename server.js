const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const childProcess = require('child_process');
const jwt = require('jsonwebtoken');
const express = require('express');
const MySql = require('sync-mysql');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    // Values injected by Docker/systemd/the shell take precedence over the
    // local .env file. The file only supplies values that are not already in
    // the process environment.
    if (match && !Object.prototype.hasOwnProperty.call(process.env, match[1])) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  });
}

loadEnvFile();

const app = express();
const port = process.env.PORT || 3000;
const authEnabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.AUTH_ENABLED || 'false').toLowerCase());
const emailVerificationEnabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.EMAIL_VERIFICATION_ENABLED || 'false').toLowerCase());
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-this-secret';
const openApiEnabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.OPENAPI_ENABLED || 'false').toLowerCase());
const importExportEnabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.IMPORT_EXPORT_ENABLED || 'false').toLowerCase());
const galleryRoot = path.join(__dirname, 'uploads', 'gallery');

function mysqlType(sql) {
  return sql.replace(/COLLATE\s+NOCASE/gi, '').replace(/email\s+TEXT/gi, 'email VARCHAR(320)').replace(/token\s+TEXT/gi, 'token VARCHAR(128)').replace(/expires_at\s+INTEGER/gi, 'expires_at BIGINT').replace(/TEXT\s+NOT NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP').replace(/\bTEXT\b/gi, 'VARCHAR(255)').replace(/(\w+_json)\s+VARCHAR\(255\)\s+NOT NULL\s+DEFAULT\s+'\[\]'/gi, '$1 TEXT').replace(/(\w+_json)\s+VARCHAR\(255\)/gi, '$1 TEXT').replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INT AUTO_INCREMENT PRIMARY KEY').replace(/INTEGER/gi, 'INT').replace(/REAL/gi, 'DOUBLE');
}

class MySqlCompat {
  constructor() {
    this.connection = new MySql({
      host: process.env.MYSQL_HOST || 'mysql',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'calculator',
      password: process.env.MYSQL_PASSWORD || 'calculator',
      database: process.env.MYSQL_DATABASE || 'calculator',
      multipleStatements: true,
    });
  }
  exec(sql) { return this.connection.query(mysqlType(sql)); }
  pragma() {}
  prepare(sql) {
    const pragmaMatch = sql.match(/^\s*PRAGMA\s+table_info\(([^)]+)\)/i);
    if (pragmaMatch) {
      const table = pragmaMatch[1].replace(/[^A-Za-z0-9_]/g, '');
      return { all: () => this.connection.query('SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [table]) || [] };
    }
    const normalized = mysqlType(sql).replace(/ON CONFLICT\(([^)]+)\) DO UPDATE SET code = excluded\.code, expires_at = excluded\.expires_at/i, 'ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at)');
    return {
      all: (...params) => this.connection.query(normalized, params) || [],
      get: (...params) => (this.connection.query(normalized, params) || [])[0],
      run: (...params) => {
        const result = this.connection.query(normalized, params) || {};
        return { changes: result.affectedRows || 0, lastInsertRowid: result.insertId };
      },
    };
  }
}

const db = new MySqlCompat();

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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function requestUser(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authorization.slice(7), jwtSecret);
      return db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.sub) || null;
    } catch (_error) {
      return null;
    }
  }
  const cookies = String(req.headers.cookie || '').split(';').reduce((result, part) => {
    const [key, ...value] = part.trim().split('=');
    if (key) result[key] = decodeURIComponent(value.join('='));
    return result;
  }, {});
  const token = cookies.session;
  if (!token) return null;
  return db.prepare('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?').get(token, Date.now()) || null;
}

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + 1000 * 60 * 60 * 24 * 30);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS verification_codes (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      electricity_cost_per_kwh REAL NOT NULL DEFAULT 0,
      printer_power_kw REAL NOT NULL DEFAULT 0.3,
      default_margin_percent REAL NOT NULL DEFAULT 20,
      rounding_mode TEXT NOT NULL DEFAULT 'none',
      currency TEXT NOT NULL DEFAULT 'PLN',
      default_printer_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      electricity_cost_per_kwh REAL NOT NULL DEFAULT 0,
      printer_power_kw REAL NOT NULL DEFAULT 0.3,
      default_margin_percent REAL NOT NULL DEFAULT 20,
      rounding_mode TEXT NOT NULL DEFAULT 'none',
      currency TEXT NOT NULL DEFAULT 'PLN',
      default_printer_id INTEGER,
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
      additional_comments LONGTEXT,
      model_url TEXT,
      commercial_use_allowed INTEGER NOT NULL DEFAULT 0,
      print_parts_json TEXT NOT NULL DEFAULT '[]',
      print_time_hours REAL NOT NULL,
      filament_id INTEGER,
      printer_id INTEGER,
      selected_filament_ids_json TEXT NOT NULL DEFAULT '[]',
      filament_details_json TEXT NOT NULL DEFAULT '[]',
      filament_used_grams REAL NOT NULL,
      margin_override_percent REAL,
      rounding_override TEXT,
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

    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculation_id INTEGER NOT NULL,
      user_id INTEGER,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (calculation_id) REFERENCES calculations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT INTO app_settings (id, electricity_cost_per_kwh, printer_power_kw, default_margin_percent)
    SELECT 1, 0, 0.3, 20
    WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
  `);

  db.exec('ALTER TABLE sessions MODIFY expires_at BIGINT NOT NULL');

  const settingsCols = db.prepare('PRAGMA table_info(app_settings)').all().map((c) => c.name);
  if (!settingsCols.includes('printer_power_kw')) {
    db.exec('ALTER TABLE app_settings ADD COLUMN printer_power_kw REAL NOT NULL DEFAULT 0.3');
  }
  if (!settingsCols.includes('rounding_mode')) {
    db.exec("ALTER TABLE app_settings ADD COLUMN rounding_mode TEXT NOT NULL DEFAULT 'none'");
  }
  if (!settingsCols.includes('default_printer_id')) {
    db.exec('ALTER TABLE app_settings ADD COLUMN default_printer_id INTEGER');
  }
  if (!settingsCols.includes('currency')) {
    db.exec("ALTER TABLE app_settings ADD COLUMN currency TEXT NOT NULL DEFAULT 'PLN'");
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
  if (!calcCols.includes('owner_user_id')) {
    db.exec('ALTER TABLE calculations ADD COLUMN owner_user_id INTEGER REFERENCES users(id)');
  }
  if (!calcCols.includes('printer_power_kw_snapshot')) {
    db.exec('ALTER TABLE calculations ADD COLUMN printer_power_kw_snapshot REAL NOT NULL DEFAULT 0.3');
  }
  if (!calcCols.includes('additional_comments')) {
    db.exec('ALTER TABLE calculations ADD COLUMN additional_comments LONGTEXT');
  } else {
    // MySQL's compatibility type mapping historically created this column as
    // VARCHAR(255). Keep existing installations able to store full textarea
    // content as well as fresh databases.
    db.exec('ALTER TABLE calculations MODIFY COLUMN additional_comments LONGTEXT');
  }
  if (!calcCols.includes('model_url')) {
    db.exec('ALTER TABLE calculations ADD COLUMN model_url TEXT');
  }
  if (!calcCols.includes('commercial_use_allowed')) {
    db.exec('ALTER TABLE calculations ADD COLUMN commercial_use_allowed INTEGER NOT NULL DEFAULT 0');
  }
  if (!calcCols.includes('rounding_override')) {
    db.exec('ALTER TABLE calculations ADD COLUMN rounding_override TEXT');
  }
  if (!calcCols.includes('print_parts_json')) {
    db.exec("ALTER TABLE calculations ADD COLUMN print_parts_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!calcCols.includes('selected_filament_ids_json')) {
    db.exec("ALTER TABLE calculations ADD COLUMN selected_filament_ids_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!calcCols.includes('filament_details_json')) {
    db.exec("ALTER TABLE calculations ADD COLUMN filament_details_json TEXT NOT NULL DEFAULT '[]'");
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

  const galleryCols = db.prepare('PRAGMA table_info(gallery_images)').all().map((c) => c.name);
  if (!galleryCols.includes('is_default')) {
    db.exec('ALTER TABLE gallery_images ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
  }
  db.prepare('SELECT calculation_id FROM gallery_images GROUP BY calculation_id HAVING SUM(is_default) = 0').all().forEach((gallery) => {
    const firstImage = db.prepare('SELECT id FROM gallery_images WHERE calculation_id = ? ORDER BY id LIMIT 1').get(gallery.calculation_id);
    if (firstImage) db.prepare('UPDATE gallery_images SET is_default = 1 WHERE id = ?').run(firstImage.id);
  });

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

  const printerCount = db.prepare('SELECT COUNT(*) AS count FROM printers').get().count;
  const configuredDefault = db.prepare('SELECT default_printer_id FROM app_settings WHERE id = 1').get().default_printer_id;
  const configuredExists = configuredDefault && db.prepare('SELECT 1 FROM printers WHERE id = ?').get(configuredDefault);
  if (printerCount === 1 || (configuredDefault && !configuredExists)) {
    const firstPrinter = db.prepare('SELECT id FROM printers ORDER BY id LIMIT 1').get();
    db.prepare('UPDATE app_settings SET default_printer_id = ? WHERE id = 1').run(firstPrinter ? firstPrinter.id : null);
  }

  const firstUser = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
  if (firstUser) {
    db.prepare('UPDATE calculations SET owner_user_id = ? WHERE owner_user_id IS NULL').run(firstUser.id);
    getUserSettings(firstUser.id);
  }
}

function initDbWithRetry() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      initDb();
      return;
    } catch (error) {
      lastError = error;
      if (!['EAI_AGAIN', 'ECONNREFUSED'].includes(error.code)) throw error;
      const retryUntil = Date.now() + 1000;
      while (Date.now() < retryUntil) { /* wait for the database service */ }
    }
  }
  throw lastError;
}

initDbWithRetry();

fs.mkdirSync(galleryRoot, { recursive: true });

app.use(express.json());

function ownedCalculation(req, id) {
  const user = authEnabled ? requestUser(req) : null;
  if (authEnabled && !user) return { error: 'Authentication required.', status: 401 };
  const calculation = authEnabled
    ? db.prepare('SELECT id, owner_user_id FROM calculations WHERE id = ? AND (owner_user_id = ? OR owner_user_id IS NULL)').get(id, user.id)
    : db.prepare('SELECT id, owner_user_id FROM calculations WHERE id = ?').get(id);
  return { user, calculation };
}

function readMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) return reject(new Error('Invalid multipart upload.'));
    const boundary = Buffer.from(`--${match[1] || match[2]}`);
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 512 * 1024 * 1024) {
        reject(new Error('Upload is too large. Maximum size is 512 MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const start = body.indexOf(boundary);
        if (start < 0) throw new Error('Invalid multipart upload.');
        const headerStart = start + boundary.length + 2;
        const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
        if (headerEnd < 0) throw new Error('Invalid image upload.');
        const headers = body.subarray(headerStart, headerEnd).toString('utf8');
        const disposition = headers.match(/Content-Disposition:[^\r\n]*filename="([^"]*)"/i);
        const type = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        const fileStart = headerEnd + 4;
        const fileEnd = body.indexOf(Buffer.from(`\r\n${boundary.toString()}`), fileStart);
        const dataEnd = fileEnd >= 0 ? fileEnd : body.length;
        const data = body.subarray(fileStart, dataEnd);
        if (!disposition || !disposition[1]) throw new Error('No image file was provided.');
        const mimeType = String(type?.[1] || 'application/octet-stream').trim().toLowerCase();
        resolve({ originalName: path.basename(disposition[1]).slice(0, 255), mimeType, data });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function galleryFolder(userId) {
  return path.join(galleryRoot, userId ? String(userId) : 'anonymous');
}

app.get('/api/calculations/:id/gallery', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const access = ownedCalculation(req, id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!access.calculation) return res.status(404).json({ error: 'Calculation not found.' });
    const rows = db.prepare('SELECT id, original_name, mime_type, file_size, is_default, created_at FROM gallery_images WHERE calculation_id = ? ORDER BY id').all(id);
    res.json({ images: rows.map((row) => ({ ...row, url: `/api/gallery-images/${row.id}` })) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/calculations/:id/gallery', async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const access = ownedCalculation(req, id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!access.calculation) return res.status(404).json({ error: 'Calculation not found.' });
    const image = await readMultipartFile(req);
    if (!image.mimeType.startsWith('image/')) throw new Error('Only image files are allowed.');
    if (image.data.length > 25 * 1024 * 1024) throw new Error('Image is too large. Maximum size is 25 MB.');
    if (!image.data.length) throw new Error('The selected image is empty.');
    const userId = access.user?.id || null;
    const hash = crypto.createHash('sha256').update(image.data).digest('hex');
    const extension = path.extname(image.originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10) || '.bin';
    const storedName = `${hash}${extension}`;
    const folder = galleryFolder(userId);
    fs.mkdirSync(folder, { recursive: true });
    const storedPath = path.join(folder, storedName);
    if (!fs.existsSync(storedPath)) fs.writeFileSync(storedPath, image.data, { flag: 'wx' });
    const isDefault = db.prepare('SELECT COUNT(*) AS count FROM gallery_images WHERE calculation_id = ?').get(id).count === 0 ? 1 : 0;
    const result = db.prepare('INSERT INTO gallery_images (calculation_id, user_id, stored_name, original_name, mime_type, file_size, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userId, storedName, image.originalName, image.mimeType, image.data.length, isDefault);
    const row = db.prepare('SELECT id, original_name, mime_type, file_size, is_default, created_at FROM gallery_images WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ image: { ...row, url: `/api/gallery-images/${row.id}` } });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/gallery-images/:id', (req, res) => {
  try {
    const imageId = parsePositiveInt(req.params.id, 'id');
    const user = authEnabled ? requestUser(req) : null;
    if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
    const row = db.prepare('SELECT * FROM gallery_images WHERE id = ?').get(imageId);
    if (!row || (authEnabled && row.user_id !== user.id)) return res.status(404).json({ error: 'Image not found.' });
    db.prepare('DELETE FROM gallery_images WHERE id = ?').run(imageId);
    try { fs.unlinkSync(path.join(galleryFolder(row.user_id), row.stored_name)); } catch (_error) { /* already removed */ }
    if (row.is_default) {
      const next = db.prepare('SELECT id FROM gallery_images WHERE calculation_id = ? ORDER BY id LIMIT 1').get(row.calculation_id);
      if (next) db.prepare('UPDATE gallery_images SET is_default = 1 WHERE id = ?').run(next.id);
    }
    res.json({ success: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/gallery-images/:id/default', (req, res) => {
  try {
    const imageId = parsePositiveInt(req.params.id, 'id');
    const row = db.prepare('SELECT * FROM gallery_images WHERE id = ?').get(imageId);
    if (!row) return res.status(404).json({ error: 'Image not found.' });
    const access = ownedCalculation(req, row.calculation_id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!access.calculation) return res.status(404).json({ error: 'Image not found.' });
    db.prepare('UPDATE gallery_images SET is_default = 0 WHERE calculation_id = ?').run(row.calculation_id);
    db.prepare('UPDATE gallery_images SET is_default = 1 WHERE id = ?').run(imageId);
    res.json({ success: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('/api/gallery-images/:id', (req, res) => {
  try {
    const imageId = parsePositiveInt(req.params.id, 'id');
    const user = authEnabled ? requestUser(req) : null;
    if (authEnabled && !user) return res.status(401).end();
    const row = db.prepare('SELECT * FROM gallery_images WHERE id = ?').get(imageId);
    if (!row || (authEnabled && row.user_id !== user.id)) return res.status(404).end();
    const filePath = path.join(galleryFolder(row.user_id), path.basename(row.stored_name));
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.type(row.mime_type).sendFile(filePath);
  } catch (_error) { res.status(404).end(); }
});

app.get('/', (req, res, next) => {
  if (authEnabled && !requestUser(req)) return res.redirect('/login');
  return next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/calculations/:slug', (req, res) => {
  if (authEnabled && !requestUser(req)) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get(['/login', '/register'], (req, res) => {
  if (!authEnabled) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.post('/api/auth/register', (req, res) => {
  if (!authEnabled) return res.status(404).json({ error: 'Authentication is disabled.' });
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Password must be at least 8 characters and include an uppercase letter, a number, and a special character.');
    }
    if (emailVerificationEnabled) {
      const verification = db.prepare('SELECT code, expires_at FROM verification_codes WHERE email = ?').get(email);
      if (!verification || verification.expires_at < Date.now() || String(req.body.verification_code || '') !== verification.code) throw new Error('Enter the verification code sent to your email.');
    }
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hashPassword(password));
    db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
    const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    if (existingUsers === 1) {
      db.prepare('UPDATE calculations SET owner_user_id = ? WHERE owner_user_id IS NULL').run(result.lastInsertRowid);
      const defaults = getSettings();
      db.prepare('INSERT INTO user_settings (user_id, electricity_cost_per_kwh, printer_power_kw, default_margin_percent, rounding_mode, currency, default_printer_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(result.lastInsertRowid, defaults.electricity_cost_per_kwh, defaults.printer_power_kw, defaults.default_margin_percent, defaults.rounding_mode, defaults.currency, defaults.default_printer_id);
    }
    setSession(res, result.lastInsertRowid);
    const account = { id: result.lastInsertRowid, email };
    res.status(201).json({ user: account, access_token: issueAccessToken(account), token_type: 'Bearer', expires_in: 3600 });
  } catch (error) {
    res.status(400).json({ error: String(error.message || '').includes('UNIQUE') ? 'An account with this email already exists.' : error.message });
  }
});

app.post('/api/auth/send-code', (req, res) => {
  if (!authEnabled || !emailVerificationEnabled) return res.status(404).json({ error: 'Email verification is disabled.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at').run(email, code, Date.now() + 10 * 60 * 1000);
  console.log(`[email verification] ${email}: ${code}`);
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  if (!authEnabled) return res.status(404).json({ error: 'Authentication is disabled.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
  setSession(res, user.id);
  const account = { id: user.id, email: user.email };
  res.json({ user: account, access_token: issueAccessToken(account), token_type: 'Bearer', expires_in: 3600 });
});

app.post('/api/auth/logout', (req, res) => {
  const token = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('session='))?.slice(8);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: authEnabled ? requestUser(req) : null });
});

app.get('/api/auth/config', (_req, res) => {
  res.json({ auth_enabled: authEnabled, email_verification_enabled: emailVerificationEnabled });
});
app.get('/openapi.yaml', (_req, res) => {
  if (!openApiEnabled) return res.status(404).json({ error: 'OpenAPI documentation is disabled.' });
  return res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.put('/api/auth/password', (req, res) => {
  if (!authEnabled) return res.status(404).json({ error: 'Authentication is disabled.' });
  const user = authEnabled ? requestUser(req) : null;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) return res.status(400).json({ error: 'New password must be at least 8 characters and include an uppercase letter, a number, and a special character.' });
  const account = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
  if (!account || !verifyPassword(currentPassword, account.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  res.json({ success: true });
});

function getSettings() {
  return db.prepare('SELECT electricity_cost_per_kwh, printer_power_kw, default_margin_percent, rounding_mode, currency, default_printer_id FROM app_settings WHERE id = 1').get();
}

function getUserSettings(userId) {
  if (!userId) return getSettings();
  let settings = db.prepare('SELECT electricity_cost_per_kwh, printer_power_kw, default_margin_percent, rounding_mode, currency, default_printer_id FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings) {
    const defaults = getSettings();
    db.prepare('INSERT INTO user_settings (user_id, electricity_cost_per_kwh, printer_power_kw, default_margin_percent, rounding_mode, currency, default_printer_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, defaults.electricity_cost_per_kwh, defaults.printer_power_kw, defaults.default_margin_percent, defaults.rounding_mode, defaults.currency, defaults.default_printer_id);
    settings = { ...defaults };
  }
  return settings;
}

function getFilamentTypes() {
  return db.prepare('SELECT id, name FROM filament_types ORDER BY name COLLATE NOCASE').all();
}

function getFilamentManufacturers() {
  return db.prepare('SELECT id, name FROM filament_manufacturers ORDER BY name COLLATE NOCASE').all();
}

function getPrinters() {
  const rows = db.prepare('SELECT id, name, power_kw FROM printers ORDER BY id').all();
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

function getCalculations(userId = null) {
  const ownerFilter = userId ? 'WHERE c.owner_user_id = ?' : '';
  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.additional_comments,
      c.model_url,
      c.commercial_use_allowed,
      c.print_parts_json,
      c.print_time_hours,
      c.filament_id,
      c.printer_id,
      c.selected_filament_ids_json,
      c.filament_details_json,
      c.filament_used_grams,
      c.margin_override_percent,
      c.rounding_override,
      c.electricity_cost_per_kwh_snapshot,
      c.printer_power_kw_snapshot,
      c.printer_name_snapshot,
      c.default_margin_percent_snapshot,
      c.filament_name_snapshot,
      c.filament_cost_per_kg_snapshot,
      c.selected_filaments_snapshot_json,
      (SELECT CONCAT('/api/gallery-images/', gi.id) FROM gallery_images gi WHERE gi.calculation_id = c.id AND gi.is_default = 1 ORDER BY gi.id LIMIT 1) AS default_gallery_image_url,
      c.created_at,
      c.updated_at
    FROM calculations c
    ${ownerFilter}
    ORDER BY c.updated_at DESC, c.id DESC
  `).all(...(userId ? [userId] : []));

  return rows.map((row) => ({
    ...row,
    selected_filament_ids: parseJsonArray(row.selected_filament_ids_json),
    filament_details: parseJsonArray(row.filament_details_json),
    print_parts: parseJsonArray(row.print_parts_json),
    selected_filaments_snapshot: parseJsonArray(row.selected_filaments_snapshot_json),
  }));
}

app.get('/api/state', (_req, res) => {
  const user = authEnabled ? requestUser(_req) : null;
  if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({
    features: { auth_enabled: authEnabled, email_verification_enabled: emailVerificationEnabled, import_export_enabled: importExportEnabled },
    user,
    settings: getUserSettings(user?.id || null),
    printers: getPrinters(),
    filament_types: getFilamentTypes(),
    filament_manufacturers: getFilamentManufacturers(),
    filaments: getFilaments(),
    calculations: getCalculations(user?.id || null),
  });
});

const backupTables = ['filament_types', 'filament_manufacturers', 'printers', 'filaments', 'calculations'];

function exportBackupData(user) {
  const data = { version: 1, exported_at: new Date().toISOString(), settings: user ? getUserSettings(user.id) : getSettings() };
  backupTables.forEach((table) => {
    let rows = db.prepare(`SELECT * FROM ${table}`).all();
    if (user && table === 'calculations') rows = rows.filter((row) => row.owner_user_id === null || row.owner_user_id === undefined || Number(row.owner_user_id) === Number(user.id));
    if (table === 'calculations') rows = rows.map((row) => {
      const sanitized = { ...row };
      delete sanitized.owner_user_id;
      return sanitized;
    });
    data[table] = rows;
  });
  const calculationIds = (data.calculations || []).map((row) => row.id);
  data.gallery = db.prepare('SELECT id, calculation_id, user_id, stored_name, original_name, mime_type, file_size, is_default, created_at FROM gallery_images WHERE calculation_id IN (' + (calculationIds.length ? calculationIds.map(() => '?').join(',') : 'NULL') + ') ORDER BY id').all(...calculationIds);
  return data;
}

app.get('/api/import-export/export', (req, res) => {
  if (!importExportEnabled) return res.status(404).json({ error: 'Import/export is disabled.' });
  const user = authEnabled ? requestUser(req) : null;
  if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'calculator-export-'));
  try {
    const data = exportBackupData(user);
    const imagesDir = path.join(tempDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    data.gallery.forEach((image) => {
      const source = path.join(galleryFolder(image.user_id), image.stored_name);
      const archivePath = path.join('images', `${image.id}-${path.basename(image.stored_name)}`);
      image.archive_path = archivePath;
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(tempDir, archivePath));
    });
    fs.writeFileSync(path.join(tempDir, 'export.json'), JSON.stringify(data, null, 2));
    const archive = `${tempDir}.zip`;
    childProcess.execFileSync('zip', ['-qr', archive, '.'], { cwd: tempDir });
    res.download(archive, '3d-print-calculator-export.zip', () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.rmSync(archive, { force: true });
    });
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/import-export/import', async (req, res) => {
  if (!importExportEnabled) return res.status(404).json({ error: 'Import/export is disabled.' });
  const user = authEnabled ? requestUser(req) : null;
  if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
  let tempDir;
  try {
    const upload = await readMultipartFile(req);
    if (!upload.originalName.toLowerCase().endsWith('.zip')) throw new Error('Please select a ZIP export file.');
    tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'calculator-import-'));
    const archive = path.join(tempDir, 'backup.zip');
    fs.writeFileSync(archive, upload.data);
    const extractDir = path.join(tempDir, 'files');
    fs.mkdirSync(extractDir);
    childProcess.execFileSync('unzip', ['-q', '-o', archive, '-d', extractDir]);
    const data = JSON.parse(fs.readFileSync(path.join(extractDir, 'export.json'), 'utf8'));
    const tables = data.tables || {
      filament_types: data.filament_types,
      filament_manufacturers: data.filament_manufacturers,
      printers: data.printers,
      filaments: data.filaments,
      calculations: data.calculations,
    };
    if (data.version !== 1 || !tables) throw new Error('Invalid export archive.');

    if (!authEnabled) {
      db.exec('SET FOREIGN_KEY_CHECKS = 0');
      const importedTables = backupTables.filter((table) => Object.prototype.hasOwnProperty.call(data, table) || Object.prototype.hasOwnProperty.call(data.tables || {}, table));
      if (Object.prototype.hasOwnProperty.call(data, 'gallery')) db.exec('TRUNCATE TABLE gallery_images');
      importedTables.slice().reverse().forEach((table) => db.exec(`TRUNCATE TABLE ${table}`));
      importedTables.forEach((table) => {
        (Array.isArray(tables[table]) ? tables[table] : []).forEach((row) => {
          const columns = Object.keys(row);
          db.prepare(`INSERT INTO ${table} (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...columns.map((column) => row[column]));
        });
      });
      (Array.isArray(data.gallery) ? data.gallery : []).forEach((image) => {
        const columns = ['id', 'calculation_id', 'user_id', 'stored_name', 'original_name', 'mime_type', 'file_size', 'is_default', 'created_at'];
        db.prepare(`INSERT INTO gallery_images (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...columns.map((column) => image[column]));
        if (image.archive_path) {
          const archivePath = String(image.archive_path);
          if (!archivePath.startsWith('images/') || archivePath.includes('..')) throw new Error('Invalid gallery image path in export.');
          const source = path.join(extractDir, archivePath);
          const targetDir = galleryFolder(image.user_id);
          fs.mkdirSync(targetDir, { recursive: true });
          if (fs.existsSync(source)) fs.copyFileSync(source, path.join(targetDir, path.basename(image.stored_name)));
        }
      });
      db.exec('SET FOREIGN_KEY_CHECKS = 1');
      return res.json({ success: true, message: 'Import completed. Reload the application.' });
    }

    if (Object.prototype.hasOwnProperty.call(data, 'calculations') || Object.prototype.hasOwnProperty.call(data.tables || {}, 'calculations')) {
      db.prepare('SELECT g.user_id, g.stored_name FROM gallery_images g JOIN calculations c ON c.id = g.calculation_id WHERE c.owner_user_id = ?').all(user.id).forEach((image) => {
        try { fs.unlinkSync(path.join(galleryFolder(image.user_id), image.stored_name)); } catch (_error) { /* already removed */ }
      });
      db.prepare('DELETE FROM gallery_images WHERE calculation_id IN (SELECT id FROM calculations WHERE owner_user_id = ?)').run(user.id);
      db.prepare('DELETE FROM calculations WHERE owner_user_id = ?').run(user.id);
    }

    const importedSettings = (tables.user_settings || []).find((row) => Number(row.user_id) === Number(user.id)) || data.settings;
    if (importedSettings) {
      db.prepare('UPDATE user_settings SET electricity_cost_per_kwh = ?, printer_power_kw = ?, default_margin_percent = ?, rounding_mode = ?, currency = ?, default_printer_id = ? WHERE user_id = ?').run(
        importedSettings.electricity_cost_per_kwh,
        importedSettings.printer_power_kw,
        importedSettings.default_margin_percent,
        importedSettings.rounding_mode || 'none',
        importedSettings.currency || 'PLN',
        importedSettings.default_printer_id ?? null,
        user.id,
      );
    }

    const calculationIdMap = new Map();
    (Array.isArray(tables.calculations) ? tables.calculations : []).forEach((source) => {
      const row = { ...source, owner_user_id: user.id };
      delete row.id;
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      const result = db.prepare(`INSERT INTO calculations (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${placeholders})`).run(...columns.map((column) => row[column]));
      calculationIdMap.set(Number(source.id), result.lastInsertRowid);
    });

    (Array.isArray(data.gallery) ? data.gallery : []).forEach((image) => {
      const calculationId = calculationIdMap.get(Number(image.calculation_id));
      if (!calculationId) return;
      const columns = ['calculation_id', 'user_id', 'stored_name', 'original_name', 'mime_type', 'file_size', 'is_default', 'created_at'];
      const values = [calculationId, user.id, image.stored_name, image.original_name, image.mime_type, image.file_size, image.is_default ? 1 : 0, image.created_at];
      db.prepare(`INSERT INTO gallery_images (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
      if (image.archive_path) {
        const archivePath = String(image.archive_path);
        if (!archivePath.startsWith('images/') || archivePath.includes('..')) throw new Error('Invalid gallery image path in export.');
        const source = path.join(extractDir, archivePath);
        const targetDir = galleryFolder(user.id);
        fs.mkdirSync(targetDir, { recursive: true });
        if (fs.existsSync(source)) fs.copyFileSync(source, path.join(targetDir, path.basename(image.stored_name)));
      }
    });
    res.json({ success: true, message: 'Import completed. Reload the application.' });
  } catch (error) {
    if (!authEnabled) {
      try { db.exec('SET FOREIGN_KEY_CHECKS = 1'); } catch (_error) { /* ignore */ }
    }
    res.status(400).json({ error: error.message });
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const user = authEnabled ? requestUser(req) : null;
    if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
    const electricityCost = parseNumber(req.body.electricity_cost_per_kwh, 'electricity_cost_per_kwh', { min: 0 });
    const printerPowerKw = parseNumber(req.body.printer_power_kw, 'printer_power_kw', { min: 0 });
    const defaultMargin = parseNumber(req.body.default_margin_percent, 'default_margin_percent', { min: 0 });
    const roundingMode = ['none', 'tenth', 'half', 'integer', 'five'].includes(req.body.rounding_mode)
      ? req.body.rounding_mode
      : 'none';
    const currency = ['PLN', 'EUR', 'USD'].includes(req.body.currency) ? req.body.currency : 'PLN';
    let defaultPrinterId = req.body.default_printer_id === null || req.body.default_printer_id === '' || req.body.default_printer_id === undefined
      ? null
      : parsePositiveInt(req.body.default_printer_id, 'default_printer_id');
    const printerCount = db.prepare('SELECT COUNT(*) AS count FROM printers').get().count;
    if (defaultPrinterId === null && printerCount === 1) {
      defaultPrinterId = db.prepare('SELECT id FROM printers ORDER BY id LIMIT 1').get()?.id || null;
    }
    if (defaultPrinterId !== null && !db.prepare('SELECT 1 FROM printers WHERE id = ?').get(defaultPrinterId)) {
      throw new Error('Selected default printer does not exist.');
    }

    const values = [electricityCost, printerPowerKw, defaultMargin, roundingMode, currency, defaultPrinterId];
    if (user) {
      db.prepare('UPDATE user_settings SET electricity_cost_per_kwh = ?, printer_power_kw = ?, default_margin_percent = ?, rounding_mode = ?, currency = ?, default_printer_id = ? WHERE user_id = ?').run(...values, user.id);
    } else {
      db.prepare('UPDATE app_settings SET electricity_cost_per_kwh = ?, printer_power_kw = ?, default_margin_percent = ?, rounding_mode = ?, currency = ?, default_printer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(...values);
    }
    res.json({ settings: getUserSettings(user?.id || null) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/settings', (req, res) => {
  const user = authEnabled ? requestUser(req) : null;
  if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ settings: getUserSettings(user?.id || null) });
});

app.get('/api/printers', (_req, res) => res.json({ printers: getPrinters() }));
app.get('/api/printers/:id', (req, res) => {
  const id = parsePositiveInt(req.params.id, 'id');
  const printer = getPrinters().find((entry) => entry.id === id);
  if (!printer) return res.status(404).json({ error: 'Printer not found.' });
  res.json({ printer });
});

app.get('/api/filament-types', (_req, res) => res.json({ filament_types: getFilamentTypes() }));
app.get('/api/filament-types/:id', (req, res) => {
  const id = parsePositiveInt(req.params.id, 'id');
  const filamentType = db.prepare('SELECT id, name FROM filament_types WHERE id = ?').get(id);
  if (!filamentType) return res.status(404).json({ error: 'Filament type not found.' });
  res.json({ filament_type: filamentType });
});

app.get('/api/filament-manufacturers', (_req, res) => res.json({ filament_manufacturers: getFilamentManufacturers() }));
app.get('/api/filament-manufacturers/:id', (req, res) => {
  const id = parsePositiveInt(req.params.id, 'id');
  const manufacturer = db.prepare('SELECT id, name FROM filament_manufacturers WHERE id = ?').get(id);
  if (!manufacturer) return res.status(404).json({ error: 'Filament manufacturer not found.' });
  res.json({ filament_manufacturer: manufacturer });
});

app.get('/api/filaments', (_req, res) => res.json({ filaments: getFilaments() }));
app.get('/api/filaments/:id', (req, res) => {
  const id = parsePositiveInt(req.params.id, 'id');
  const filament = getFilamentById(id);
  if (!filament) return res.status(404).json({ error: 'Filament not found.' });
  res.json({ filament });
});

app.get('/api/calculations', (req, res) => {
  const user = authEnabled ? requestUser(req) : null;
  if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ calculations: getCalculations(user?.id || null) });
});

app.get('/api/calculations/:id', (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const access = ownedCalculation(req, id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!access.calculation) return res.status(404).json({ error: 'Calculation not found.' });
    const calculation = getCalculations(access.user?.id || null).find((entry) => Number(entry.id) === id);
    res.json({ calculation });
  } catch (error) { res.status(400).json({ error: error.message }); }
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
    const settings = getSettings();
    if (settings.default_printer_id === null || settings.default_printer_id === undefined) {
      db.prepare('UPDATE app_settings SET default_printer_id = ? WHERE id = 1').run(printer.id);
    }
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

    const settings = getSettings();
    if (settings.default_printer_id === id) {
      const replacement = db.prepare('SELECT id FROM printers ORDER BY id LIMIT 1').get();
      db.prepare('UPDATE app_settings SET default_printer_id = ? WHERE id = 1').run(replacement ? replacement.id : null);
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
  const commercialUseAllowed = input.commercial_use_allowed === true ? 1 : 0;
  const printTimeHours = parseNumber(input.print_time_hours, 'print_time_hours', { min: 0 });
  const filamentUsedGrams = parseNumber(input.filament_used_grams, 'filament_used_grams', { min: 0 });

  const hasOverride = input.margin_override_percent !== null
    && input.margin_override_percent !== undefined
    && String(input.margin_override_percent).trim() !== '';
  const marginOverride = hasOverride ? parseNumber(input.margin_override_percent, 'margin_override_percent', { min: 0 }) : null;
  const roundingOverride = ['none', 'tenth', 'half', 'integer', 'five'].includes(input.rounding_override)
    ? input.rounding_override
    : null;

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

  const rawFilamentDetails = Array.isArray(input.filament_details) ? input.filament_details : [];
  const filamentDetails = rawFilamentDetails.length > 0
    ? rawFilamentDetails.map((detail) => {
      const filamentId = Number(detail.filament_id);
      const hasFilament = Number.isInteger(filamentId) && filamentId > 0 && getFilamentById(filamentId);
      const usedGrams = detail.used_grams !== '' && detail.used_grams !== null && detail.used_grams !== undefined
        ? parseNumber(detail.used_grams, 'used_grams', { min: 0 })
        : 0;
      return { filament_id: hasFilament ? filamentId : null, used_grams: usedGrams };
    })
    : selectedFilaments.map((filament) => ({ filament_id: filament.id, used_grams: 0 }));

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
    commercialUseAllowed,
    printPartsJson: JSON.stringify(Array.isArray(input.print_parts) ? input.print_parts : []),
    printTimeHours,
    printerId,
    printerName,
    filamentIdsJson: JSON.stringify(selectedFilaments.map((f) => f.id)),
    filamentDetailsJson: JSON.stringify(filamentDetails),
    filamentId: firstFilament ? firstFilament.id : null,
    filamentUsedGrams,
    marginOverride,
    roundingOverride,
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
        owner_user_id,
        name,
        additional_comments,
        model_url,
        commercial_use_allowed,
        print_parts_json,
        print_time_hours,
        filament_id,
        printer_id,
        selected_filament_ids_json,
        filament_details_json,
        filament_used_grams,
        margin_override_percent,
        rounding_override,
        electricity_cost_per_kwh_snapshot,
        printer_power_kw_snapshot,
        printer_name_snapshot,
        default_margin_percent_snapshot,
        filament_name_snapshot,
        filament_cost_per_kg_snapshot,
        selected_filaments_snapshot_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      authEnabled ? requestUser(req)?.id || null : null,
      payload.name,
      payload.additionalComments,
      payload.modelUrl,
      payload.commercialUseAllowed,
      payload.printPartsJson,
      payload.printTimeHours,
      payload.filamentId,
      payload.printerId,
      payload.filamentIdsJson,
      payload.filamentDetailsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.roundingOverride,
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

    const user = authEnabled ? requestUser(req) : null;
    if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
    const existing = authEnabled
      ? db.prepare('SELECT id FROM calculations WHERE id = ? AND (owner_user_id = ? OR owner_user_id IS NULL)').get(id, user.id)
      : db.prepare('SELECT id FROM calculations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Calculation not found.' });
    }

    const payload = buildCalculationPayload(req.body);

    db.prepare(`
      UPDATE calculations
      SET name = ?,
          additional_comments = ?,
          model_url = ?,
          commercial_use_allowed = ?,
          print_parts_json = ?,
          print_time_hours = ?,
          filament_id = ?,
          printer_id = ?,
          selected_filament_ids_json = ?,
          filament_details_json = ?,
          filament_used_grams = ?,
          margin_override_percent = ?,
          rounding_override = ?,
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
      payload.commercialUseAllowed,
      payload.printPartsJson,
      payload.printTimeHours,
      payload.filamentId,
      payload.printerId,
      payload.filamentIdsJson,
      payload.filamentDetailsJson,
      payload.filamentUsedGrams,
      payload.marginOverride,
      payload.roundingOverride,
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
    const user = authEnabled ? requestUser(req) : null;
    if (authEnabled && !user) return res.status(401).json({ error: 'Authentication required.' });
    const existing = authEnabled
      ? db.prepare('SELECT id FROM calculations WHERE id = ? AND (owner_user_id = ? OR owner_user_id IS NULL)').get(id, user.id)
      : db.prepare('SELECT id FROM calculations WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Calculation not found.' });
    db.prepare('SELECT user_id, stored_name FROM gallery_images WHERE calculation_id = ?').all(id).forEach((image) => {
      try { fs.unlinkSync(path.join(galleryFolder(image.user_id), image.stored_name)); } catch (_error) { /* already removed */ }
    });
    const result = authEnabled
      ? db.prepare('DELETE FROM calculations WHERE id = ? AND (owner_user_id = ? OR owner_user_id IS NULL)').run(id, user.id)
      : db.prepare('DELETE FROM calculations WHERE id = ?').run(id);
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

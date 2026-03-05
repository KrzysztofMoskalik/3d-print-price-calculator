# 3D Print Cost & Pricing Calculator

Node.js + SQLite web app for estimating print cost and final price with configurable margin.

## Features
- Dark mode UI
- Left panel: saved calculations list
- Right panel:
  - global settings (electricity cost per kWh, printer power usage in kW, default margin)
  - filament CRUD (name + cost per kg)
  - calculation form (name optional, print time, filament, filament used, optional margin override)
- Create, edit, delete saved calculations
- Each saved calculation stores a snapshot of global values and selected filament pricing for future editing/history
- SQLite persistence (`data.db`)

## Run (Local)
1. Install Node.js 18+.
2. Install dependencies:
   - `npm install`
3. Start app:
   - `npm start`
4. Open:
   - `http://localhost:3000`

## Run (Docker)
1. Build and start:
   - `docker compose up --build`
2. Open:
   - `http://localhost:3000`
3. Stop:
   - `docker compose down`

SQLite data is persisted in the Docker named volume `sqlite_data`.

## Notes
- Electricity cost is calculated as `print_time_hours * electricity_cost_per_kwh * printer_power_kw`.

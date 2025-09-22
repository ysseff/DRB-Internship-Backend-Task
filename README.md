# DRB Internship – Backend Task (Route Scheduling API)

A small REST API for a Route Scheduling System built with Node.js (Express) and SQLite (better-sqlite3).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Initialize the database schema:

```bash
npm run init:db
```

3. Start the server (port 3000 by default):

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## Business Logic

- Each driver can handle only one active route at a time.
- Prefer drivers where `availability = true`.
- When a route is created and an available driver exists, the route is assigned, the driver's `availability` is set to `false`, and an entry is written in the `assignments` table.
- If no driver is available, the route is created as `unassigned`.


## Data Model (SQLite)

- `drivers(id TEXT PRIMARY KEY, name TEXT, license_type TEXT, availability INTEGER)`
- `routes(id INTEGER PK, start_location, end_location, distance REAL, estimated_time INTEGER, status TEXT, assigned_driver_id TEXT)`
- `assignments(id INTEGER PK, driver_id TEXT, route_id INTEGER, assigned_at TEXT, completed_at TEXT)`

## Scripts

- `npm run init:db` – Initialize SQLite schema
- `npm run dev` – Start server with nodemon
- `npm start` – Start server with node

## Assumptions

- Availability could be used as a flag meaning assigning a route sets it to `false`
- FIFO assignment order among available drivers
- Distances are numeric (km or miles); `estimatedTime` is in minutes (integer)
- History includes all entries

## Features Implemented

- POST `/drivers` – Add a driver
  - Payload: `{ id, name, licenseType, availability }`
- POST `/routes` – Add a route (auto-assigns if a driver is available)
  - Payload: `{ startLocation, endLocation, distance, estimatedTime }`
- GET `/schedule` – Returns which driver is assigned to which route (includes unassigned routes)
- GET `/drivers/:id/history` – Past route assignments for a driver
- GET `/routes?page=1&limit=10` – List routes with pagination
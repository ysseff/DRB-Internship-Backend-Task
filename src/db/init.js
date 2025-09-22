const { db, databaseFilePath } = require('./index');

function initializeSchema() {
	db.prepare(`
		CREATE TABLE IF NOT EXISTS drivers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			license_type TEXT NOT NULL,
			availability INTEGER NOT NULL DEFAULT 1
		);
	`).run();

	db.prepare(`
		CREATE TABLE IF NOT EXISTS routes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			start_location TEXT NOT NULL,
			end_location TEXT NOT NULL,
			distance REAL NOT NULL,
			estimated_time INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'unassigned',
			assigned_driver_id TEXT NULL,
			FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id)
		);
	`).run();

	db.prepare(`
		CREATE TABLE IF NOT EXISTS assignments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			driver_id TEXT NOT NULL,
			route_id INTEGER NOT NULL,
			assigned_at TEXT NOT NULL,
			completed_at TEXT NULL,
			FOREIGN KEY (driver_id) REFERENCES drivers(id),
			FOREIGN KEY (route_id) REFERENCES routes(id)
		);
	`).run();

	db.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_assigned_driver ON routes(assigned_driver_id);`).run();
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_assignments_driver ON assignments(driver_id);`).run();
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_assignments_route ON assignments(route_id);`).run();
}

try {
    initializeSchema();
    console.log(`SQLite database initialized at: ${databaseFilePath}`);
    process.exit(0);
} catch (error) {
	console.log(error)
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const { db } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

function isNonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

// POST /drivers
app.post('/drivers', (req, res) => {
	const { id, name, licenseType, availability } = req.body || {};

	if (!isNonEmptyString(id) || !isNonEmptyString(name) || !isNonEmptyString(licenseType) || typeof availability !== 'boolean') {
		return res.status(400).json({ error: 'Invalid payload. Required: { id, name, licenseType, availability }' });
	}

	try {
		const insert = db.prepare(`
			INSERT INTO drivers (id, name, license_type, availability)
			VALUES (@id, @name, @license_type, @availability)
		`);
		insert.run({ id, name, license_type: licenseType, availability: availability ? 1 : 0 });
		return res.status(201).json({ id, name, licenseType, availability });
	} catch (error) {
		if (String(error.message || '').includes('UNIQUE') || String(error.message || '').includes('PRIMARY')) {
			return res.status(409).json({ error: 'Driver with this id already exists' });
		}
		console.error('Failed to insert driver:', error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// assign a route to an available driver, if possible
function assignRoute(routeId) {
	const availableDriver = db.prepare(`
		SELECT id, name FROM drivers WHERE availability = 1 ORDER BY rowid ASC LIMIT 1
	`).get();

	if (!availableDriver) {
		return { assigned: false, driverId: null };
	}

	const nowIso = new Date().toISOString();
	const transaction = db.transaction(() => {
		db.prepare(`UPDATE drivers SET availability = 0 WHERE id = @id`).run({ id: availableDriver.id });

		db.prepare(`
			UPDATE routes SET status = 'assigned', assigned_driver_id = @driverId WHERE id = @routeId
		`).run({ driverId: availableDriver.id, routeId });

		db.prepare(`
			INSERT INTO assignments (driver_id, route_id, assigned_at)
			VALUES (@driverId, @routeId, @assigned_at)
		`).run({ driverId: availableDriver.id, routeId, assigned_at: nowIso });
	});

	transaction();
	return { assigned: true, driverId: availableDriver.id };
}

// POST /routes
app.post('/routes', (req, res) => {
	const { startLocation, endLocation, distance, estimatedTime } = req.body || {};

	if (!isNonEmptyString(startLocation) || !isNonEmptyString(endLocation) || typeof distance !== 'number' || typeof estimatedTime !== 'number') {
		return res.status(400).json({ error: 'Invalid payload. Required: { startLocation, endLocation, distance, estimatedTime }' });
	}

	try {
		const insert = db.prepare(`
			INSERT INTO routes (start_location, end_location, distance, estimated_time, status)
			VALUES (@start_location, @end_location, @distance, @estimated_time, 'unassigned')
		`);
		const result = insert.run({ start_location: startLocation, end_location: endLocation, distance, estimated_time: estimatedTime });
		const routeId = result.lastInsertRowid;

		const { assigned, driverId } = assignRoute(routeId);

		return res.status(201).json({
			id: Number(routeId),
			startLocation,
			endLocation,
			distance,
			estimatedTime,
			status: assigned ? 'assigned' : 'unassigned',
			assignedDriverId: driverId,
		});
	} catch (error) {
		console.error('Failed to insert route:', error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// GET /schedule
app.get('/schedule', (_req, res) => {
	try {
		const rows = db.prepare(`
			SELECT r.id AS routeId,
			       r.start_location AS startLocation,
			       r.end_location AS endLocation,
			       r.distance AS distance,
			       r.estimated_time AS estimatedTime,
			       r.status AS status,
			       d.id AS driverId,
			       d.name AS driverName
			FROM routes r
			LEFT JOIN drivers d ON d.id = r.assigned_driver_id
			ORDER BY r.id ASC
		`).all();

		const data = rows.map(r => ({
			route: {
				id: r.routeId,
				startLocation: r.startLocation,
				endLocation: r.endLocation,
				distance: r.distance,
				estimatedTime: r.estimatedTime,
				status: r.status,
			},
			driver: r.driverId ? { id: r.driverId, name: r.driverName } : null,
		}));

		return res.json({ data });
	} catch (error) {
		console.error('Failed to fetch schedule:', error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// bonus: GET /drivers/:id/history
app.get('/drivers/:id/history', (req, res) => {
	const driverId = req.params.id;
	try {
		const driver = db.prepare(`SELECT id, name FROM drivers WHERE id = @id`).get({ id: driverId });
		if (!driver) {
			return res.status(404).json({ error: 'Driver not found' });
		}

		const history = db.prepare(`
			SELECT a.id AS assignmentId,
			       a.assigned_at AS assignedAt,
			       a.completed_at AS completedAt,
			       r.id AS routeId,
			       r.start_location AS startLocation,
			       r.end_location AS endLocation,
			       r.distance AS distance,
			       r.estimated_time AS estimatedTime,
			       r.status AS status
			FROM assignments a
			JOIN routes r ON r.id = a.route_id
			WHERE a.driver_id = @driverId
			ORDER BY a.assigned_at DESC, a.id DESC
		`).all({ driverId });

		return res.json({ driver: { id: driver.id, name: driver.name }, history });
	} catch (error) {
		console.error('Failed to fetch driver history:', error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// bonus: GET /routes with pagination
app.get('/routes', (req, res) => {
	const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
	const offset = (page - 1) * limit;

	try {
		const totalRow = db.prepare(`SELECT COUNT(1) AS cnt FROM routes`).get();
		const total = totalRow ? Number(totalRow.cnt) : 0;
		const totalPages = Math.max(Math.ceil(total / limit), 1);

		const items = db.prepare(`
			SELECT r.id,
			       r.start_location AS startLocation,
			       r.end_location AS endLocation,
			       r.distance AS distance,
			       r.estimated_time AS estimatedTime,
			       r.status AS status,
			       r.assigned_driver_id AS assignedDriverId
			FROM routes r
			ORDER BY r.id ASC
			LIMIT @limit OFFSET @offset
		`).all({ limit, offset });

		return res.json({
			data: items.map(i => ({
				id: i.id,
				startLocation: i.startLocation,
				endLocation: i.endLocation,
				distance: i.distance,
				estimatedTime: i.estimatedTime,
				status: i.status,
				assignedDriverId: i.assignedDriverId,
			})),
			pagination: { page, limit, total, totalPages },
		});
	} catch (error) {
		console.error('Failed to fetch routes:', error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

app.get('/', (_req, res) => {
	res.send({ status: 'ok', message: 'DRB Route Scheduling API' });
});

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

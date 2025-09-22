const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databaseDir = path.join(__dirname, '../../database');
if (!fs.existsSync(databaseDir)) {
	fs.mkdirSync(databaseDir, { recursive: true });
}

const databaseFilePath = path.join(databaseDir, 'app.sqlite');

const db = new Database(databaseFilePath);

try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
} catch (error) {
	console.log(error)
}

module.exports = {
	db,
	databaseFilePath,
};

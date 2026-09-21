import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'citizen',
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    severity TEXT,
    summary TEXT,
    affectedArea TEXT,
    recommendedAction TEXT,
    time TEXT,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS floodZones (
    id TEXT PRIMARY KEY,
    name TEXT,
    lat REAL,
    lon REAL,
    riskLevel TEXT,
    riverLevelMeter REAL,
    dangerMarkMeter REAL,
    damRelease INTEGER,
    dischargeRate INTEGER,
    trend24h REAL
  );

  CREATE TABLE IF NOT EXISTS sosAlerts (
    id TEXT PRIMARY KEY,
    time TEXT,
    timestamp INTEGER,
    lat REAL,
    lon REAL,
    locationText TEXT,
    contactPhone TEXT,
    status TEXT,
    assignedUnit TEXT
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    type TEXT,
    location TEXT,
    description TEXT,
    reporterPhone TEXT,
    status TEXT,
    timestamp INTEGER,
    timeString TEXT
  );

  CREATE TABLE IF NOT EXISTS volunteers (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    area TEXT,
    skill TEXT,
    notes TEXT,
    status TEXT,
    registeredAt TEXT
  );

  CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    distKm REAL,
    phone TEXT,
    traumaCenter INTEGER,
    icubedsAvailable INTEGER,
    totalBeds INTEGER
  );

  CREATE TABLE IF NOT EXISTS shelters (
    id TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    capacity INTEGER,
    occupied INTEGER,
    facilities TEXT,
    isOpen INTEGER,
    contactPhone TEXT
  );
`);

// Insert default Admin if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@gmail.com');
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@1234', 10);
  db.prepare('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)').run('admin@gmail.com', hash, 'admin', 'Admin');
}

// Seeding alerts
const alertCount = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as {count: number};
if (alertCount.count === 0) {
  const insertAlert = db.prepare('INSERT INTO alerts (id, title, category, severity, summary, affectedArea, recommendedAction, time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertAlert.run("alt-1", "River basin water level above danger mark", "Flood", "severe", "Low-lying settlements advised to evacuate to relief camps immediately.", "Cuttack, Kendrapara, Jagatsinghpur districts", "Move to higher ground or the nearest relief camp. Avoid crossing flooded roads.", "Today · 08:12 AM", Date.now() - 3600000 * 2);
  insertAlert.run("alt-3", "High fire risk in industrial belt", "Fire", "warning", "Dry conditions increase fire hazard; extra vigilance advised near storage units.", "Industrial belt, Rourkela", "Avoid open flames near storage units; report any smoke or sparks immediately.", "Today · 05:15 AM", Date.now() - 3600000 * 5);
  insertAlert.run("alt-4", "Minor tremors recorded in the region", "Earthquake", "watch", "No damage reported. Residents advised to review earthquake safety guidelines.", "Sundargarh district", "No immediate evacuation needed — review the Earthquake Safety tab as a precaution.", "Yesterday · 11:05 PM", Date.now() - 3600000 * 12);
}

// Seeding floodZones
const floodCount = db.prepare('SELECT COUNT(*) as count FROM floodZones').get() as {count: number};
if (floodCount.count === 0) {
  const insertFlood = db.prepare('INSERT INTO floodZones (id, name, lat, lon, riskLevel, riverLevelMeter, dangerMarkMeter, damRelease, dischargeRate, trend24h) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertFlood.run("fz-1", "Cuttack (Mahanadi Basin)", 20.4625, 85.883, "Severe", 27.8, 26.5, 1, 4500, 0.8);
  insertFlood.run("fz-2", "Kendrapara Delta", 20.5, 86.42, "High", 19.4, 18.0, 1, 3200, 0.4);
  insertFlood.run("fz-3", "Jagatsinghpur Lower Basin", 20.25, 86.17, "High", 15.2, 14.5, 0, 2100, 0.2);
  insertFlood.run("fz-4", "Bhubaneswar Central Zone", 20.2961, 85.8245, "Moderate", 12.1, 13.0, 0, 1500, -0.1);
  insertFlood.run("fz-5", "Angul Upper Catchment", 20.84, 85.1, "Low", 8.5, 11.0, 0, 800, -0.3);
}

// Seeding sosAlerts
const sosCount = db.prepare('SELECT COUNT(*) as count FROM sosAlerts').get() as {count: number};
if (sosCount.count === 0) {
  const insertSos = db.prepare('INSERT INTO sosAlerts (id, time, timestamp, lat, lon, locationText, contactPhone, status, assignedUnit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertSos.run("sos-101", new Date(Date.now() - 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), Date.now() - 15 * 60000, 22.251, 84.852, "Sector 5 Riverside Colony, Rourkela", "+91 98765 43210", "New", null);
  insertSos.run("sos-102", new Date(Date.now() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), Date.now() - 45 * 60000, 20.465, 85.881, "Mahanadi Bund Road, Cuttack", "+91 94321 09876", "Dispatched", "NDRF Unit 4");
}

// Seeding incidents
const incidentCount = db.prepare('SELECT COUNT(*) as count FROM incidents').get() as {count: number};
if (incidentCount.count === 0) {
  const insertInc = db.prepare('INSERT INTO incidents (id, type, location, description, reporterPhone, status, timestamp, timeString) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertInc.run("#101", "Flood", "Riverside Basin, Sector 4", "Waterlogging encroaching residential ground floors.", "+91 91234 56789", "Open", Date.now() - 120 * 60000, "2 hours ago");
  insertInc.run("#102", "Fire", "Industrial Belt Unit 3", "Transformer spark triggered chemical yard alarm.", "+91 98111 22233", "In Progress", Date.now() - 60 * 60000, "1 hour ago");
  insertInc.run("#103", "Medical", "Sector 7 Community Center", "Elderly resident experiencing heat exhaustion during evacuation.", "+91 99887 76655", "Resolved", Date.now() - 180 * 60000, "3 hours ago");
}

// Seeding volunteers
const volCount = db.prepare('SELECT COUNT(*) as count FROM volunteers').get() as {count: number};
if (volCount.count === 0) {
  const insertVol = db.prepare('INSERT INTO volunteers (id, name, phone, area, skill, notes, status, registeredAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertVol.run("vol-1", "Priya Sharma", "+91 98765 11223", "Sector 4, Rourkela", "First Aid / Medical", "Certified nursing assistant, owns first-aid kit.", "Active", "Yesterday");
  insertVol.run("vol-2", "Rahul Nayak", "+91 94321 55667", "Riverside Basin", "Rescue & Evacuation", "Owns inflatable boat & life jackets.", "Active", "2 days ago");
  insertVol.run("vol-3", "Amitav Mohanty", "+91 91234 88990", "College Square, Cuttack", "Logistics & Supplies", "Pickup truck available for food distribution.", "Active", "Today");
}

// Seeding hospitals
const hospCount = db.prepare('SELECT COUNT(*) as count FROM hospitals').get() as {count: number};
if (hospCount.count === 0) {
  const insertHosp = db.prepare('INSERT INTO hospitals (id, name, address, distKm, phone, traumaCenter, icubedsAvailable, totalBeds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertHosp.run("hosp-1", "Ispat General Hospital (IGH)", "Sector 19, Rourkela", 1.2, "0661-2646201", 1, 14, 120);
  insertHosp.run("hosp-2", "Cuttack Medical College & Hospital", "Mangalabag, Cuttack", 2.8, "0671-2414080", 1, 8, 250);
  insertHosp.run("hosp-3", "Community Health Centre (CHC)", "Panposh Road, Rourkela", 3.5, "0661-2500112", 0, 2, 45);
  insertHosp.run("hosp-4", "Red Cross Disaster Relief Hospital", "Relief Camp Zone, Paradip", 4.1, "06722-220044", 1, 6, 80);
}

// Seeding shelters
const shelterCount = db.prepare('SELECT COUNT(*) as count FROM shelters').get() as {count: number};
if (shelterCount.count === 0) {
  const insertShelter = db.prepare('INSERT INTO shelters (id, name, address, capacity, occupied, facilities, isOpen, contactPhone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertShelter.run("sh-1", "Government High School Relief Camp", "Sector 4, Rourkela", 400, 210, JSON.stringify(["Food Counter", "Medical Post", "Clean Sanitation", "Power Backup"]), 1, "0661-223344");
  insertShelter.run("sh-2", "Community Hall Relief Center", "Sector 7, Rourkela", 150, 60, JSON.stringify(["Drinking Water", "Bedding", "First Aid"]), 1, "0661-556677");
  insertShelter.run("sh-3", "Municipal Indoor Stadium Shelter", "Civil Township, Rourkela", 600, 600, JSON.stringify(["24x7 Kitchen", "Doctor on Duty", "Generator Backup"]), 0, "0661-889900");
  insertShelter.run("sh-4", "Panchayat Office Relief Shelter", "Kendrapara Coastal Block", 250, 110, JSON.stringify(["Solar Power", "Sat Phone", "Emergency Food Stocks"]), 1, "06727-23311");
}

export default db;


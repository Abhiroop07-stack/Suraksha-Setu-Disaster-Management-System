const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// replace in-memory arrays and import db
code = code.replace(/\/\/ In-Memory Database Store[\s\S]*?(?=async function startServer\(\))/m, `import db from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_suraksha";

`);

// replace stats endpoint
code = code.replace(/app\.get\("\/api\/admin\/stats"[\s\S]*?\}\);/m, `app.get("/api/admin/stats", (_req, res) => {
    const newSosCount = (db.prepare("SELECT COUNT(*) as count FROM sosAlerts WHERE status = 'New'").get() as any).count;
    const activeAlertsCount = (db.prepare("SELECT COUNT(*) as count FROM alerts").get() as any).count;
    const volunteersCount = (db.prepare("SELECT COUNT(*) as count FROM volunteers").get() as any).count;
    const sheltersOpenCount = (db.prepare("SELECT COUNT(*) as count FROM shelters WHERE isOpen = 1 AND occupied < capacity").get() as any).count;
    const incidentReportsCount = (db.prepare("SELECT COUNT(*) as count FROM incidents").get() as any).count;

    res.json({
      activeAlertsCount,
      volunteersCount,
      sheltersOpenCount,
      incidentReportsCount,
      newSosCount,
    });
  });`);

// replace login endpoint
code = code.replace(/app\.post\("\/api\/admin\/login"[\s\S]*?\}\);/m, `app.post("/api/auth/register", (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });
    try {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)").run(email, hash, name || "", "citizen");
      res.json({ success: true, message: "User registered successfully" });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
      res.status(500).json({ success: false, message: "Internal error" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ success: true, token, user: { email: user.email, name: user.name, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });`);

// Replace /api/alerts
code = code.replace(/app\.get\("\/api\/alerts"[\s\S]*?\}\);/, `app.get("/api/alerts", (req, res) => {
    const { severity } = req.query;
    if (severity && severity !== 'all') {
      return res.json(db.prepare("SELECT * FROM alerts WHERE severity = ? ORDER BY timestamp DESC").all(severity));
    }
    res.json(db.prepare("SELECT * FROM alerts ORDER BY timestamp DESC").all());
  });`);

code = code.replace(/app\.post\("\/api\/alerts"[\s\S]*?\}\);/, `app.post("/api/alerts", (req, res) => {
    const { title, category, severity, summary, affectedArea, recommendedAction } = req.body;
    if (!title || !severity) return res.status(400).json({ error: "Title and severity are required" });
    const id = "alt-" + Date.now();
    const time = "Just now";
    const timestamp = Date.now();
    db.prepare("INSERT INTO alerts (id, title, category, severity, summary, affectedArea, recommendedAction, time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, title, category || "General", severity || "warning", summary || "", affectedArea || "Region wide", recommendedAction || "Stay vigilant and listen to local advisories.", time, timestamp);
    res.status(201).json({ id, title, category, severity, summary, affectedArea, recommendedAction, time, timestamp });
  });`);

code = code.replace(/app\.delete\("\/api\/alerts\/:id"[\s\S]*?\}\);/, `app.delete("/api/alerts/:id", (req, res) => {
    db.prepare("DELETE FROM alerts WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "Alert removed" });
  });`);

// flood zones
code = code.replace(/app\.get\("\/api\/flood\/zones"[\s\S]*?\}\);/, `app.get("/api/flood/zones", (_req, res) => {
    const zones = db.prepare("SELECT * FROM floodZones").all();
    res.json(zones.map((z: any) => ({ ...z, damRelease: z.damRelease === 1 })));
  });`);

// sos
code = code.replace(/app\.get\("\/api\/sos"[\s\S]*?\}\);/, `app.get("/api/sos", (_req, res) => {
    res.json(db.prepare("SELECT * FROM sosAlerts ORDER BY timestamp DESC").all());
  });`);

code = code.replace(/app\.post\("\/api\/sos"[\s\S]*?\}\);/, `app.post("/api/sos", (req, res) => {
    const { lat, lon, locationText, contactPhone } = req.body;
    const id = "sos-" + Math.floor(100 + Math.random() * 900);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = Date.now();
    db.prepare("INSERT INTO sosAlerts (id, time, timestamp, lat, lon, locationText, contactPhone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, time, timestamp, lat, lon, locationText || "GPS Coordinates Received", contactPhone || "Anonymous Request", "New");
    res.status(201).json({ success: true, alert: { id, lat, lon, status: "New" }, message: "Emergency SOS registered in command center." });
  });`);

code = code.replace(/app\.patch\("\/api\/sos\/:id"[\s\S]*?\}\);/, `app.patch("/api/sos/:id", (req, res) => {
    const { status, assignedUnit } = req.body;
    if (status) db.prepare("UPDATE sosAlerts SET status = ? WHERE id = ?").run(status, req.params.id);
    if (assignedUnit) db.prepare("UPDATE sosAlerts SET assignedUnit = ? WHERE id = ?").run(assignedUnit, req.params.id);
    res.json({ success: true });
  });`);

// incidents
code = code.replace(/app\.get\("\/api\/incidents"[\s\S]*?\}\);/, `app.get("/api/incidents", (_req, res) => {
    res.json(db.prepare("SELECT * FROM incidents ORDER BY timestamp DESC").all());
  });`);

code = code.replace(/app\.post\("\/api\/incidents"[\s\S]*?\}\);/, `app.post("/api/incidents", (req, res) => {
    const { type, location, description, reporterPhone } = req.body;
    const id = "#" + Math.floor(100 + Math.random() * 900);
    const timestamp = Date.now();
    db.prepare("INSERT INTO incidents (id, type, location, description, reporterPhone, status, timestamp, timeString) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, type || "Other", location, description || "No detailed description supplied.", reporterPhone, "Open", timestamp, "Just now");
    res.status(201).json({ success: true });
  });`);

code = code.replace(/app\.patch\("\/api\/incidents\/:id"[\s\S]*?\}\);/, `app.patch("/api/incidents/:id", (req, res) => {
    const { status } = req.body;
    if (status) db.prepare("UPDATE incidents SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });`);

// volunteers
code = code.replace(/app\.get\("\/api\/volunteers"[\s\S]*?\}\);/, `app.get("/api/volunteers", (_req, res) => {
    res.json(db.prepare("SELECT * FROM volunteers").all());
  });`);

code = code.replace(/app\.post\("\/api\/volunteers"[\s\S]*?\}\);/, `app.post("/api/volunteers", (req, res) => {
    const { name, phone, area, skill, notes } = req.body;
    const id = "vol-" + Date.now();
    db.prepare("INSERT INTO volunteers (id, name, phone, area, skill, notes, status, registeredAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, name, phone, area, skill || "General Assistance", notes, "Active", "Just now");
    res.status(201).json({ success: true });
  });`);

code = code.replace(/app\.patch\("\/api\/volunteers\/:id"[\s\S]*?\}\);/, `app.patch("/api/volunteers/:id", (req, res) => {
    const { status } = req.body;
    if (status) db.prepare("UPDATE volunteers SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });`);

// hospitals & shelters
code = code.replace(/app\.get\("\/api\/hospitals"[\s\S]*?\}\);/, `app.get("/api/hospitals", (_req, res) => {
    const h = db.prepare("SELECT * FROM hospitals").all();
    res.json(h.map((x: any) => ({ ...x, traumaCenter: x.traumaCenter === 1 })));
  });`);

code = code.replace(/app\.patch\("\/api\/hospitals\/:id"[\s\S]*?\}\);/, `app.patch("/api/hospitals/:id", (req, res) => {
    const { icuBedsAvailable } = req.body;
    if (typeof icuBedsAvailable === "number") db.prepare("UPDATE hospitals SET icubedsAvailable = ? WHERE id = ?").run(icuBedsAvailable, req.params.id);
    res.json({ success: true });
  });`);

code = code.replace(/app\.get\("\/api\/shelters"[\s\S]*?\}\);/, `app.get("/api/shelters", (_req, res) => {
    const s = db.prepare("SELECT * FROM shelters").all();
    res.json(s.map((x: any) => ({ ...x, isOpen: x.isOpen === 1, facilities: JSON.parse(x.facilities || '[]') })));
  });`);

code = code.replace(/app\.patch\("\/api\/shelters\/:id"[\s\S]*?\}\);/, `app.patch("/api/shelters/:id", (req, res) => {
    const { isOpen, occupied } = req.body;
    if (typeof isOpen === "boolean") db.prepare("UPDATE shelters SET isOpen = ? WHERE id = ?").run(isOpen ? 1 : 0, req.params.id);
    if (typeof occupied === "number") db.prepare("UPDATE shelters SET occupied = ? WHERE id = ?").run(occupied, req.params.id);
    res.json({ success: true });
  });`);

fs.writeFileSync('server.ts', code);

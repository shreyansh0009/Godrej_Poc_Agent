const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'voiceagent.db');

let db;

function getDb() {
    if (!db) {
        const fs = require('fs');
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeSchema();
        runMigrations();
    }
    return db;
}

function initializeSchema() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      language TEXT DEFAULT 'hinglish',
      status TEXT DEFAULT 'created',
      total_contacts INTEGER DEFAULT 0,
      completed_contacts INTEGER DEFAULT 0,
      failed_contacts INTEGER DEFAULT 0,
      active_calls INTEGER DEFAULT 0,
      dealer_name TEXT,
      dealer_address TEXT,
      dealer_phone TEXT,
      bolna_agent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      config_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      customer_type TEXT,
      dealer_number TEXT,
      product_category TEXT,
      product_name TEXT,
      model_number TEXT,
      serial_number TEXT,
      purchase_date TEXT,
      warranty_status TEXT,
      address TEXT,
      pincode TEXT,
      issue_summary TEXT,
      vehicle_model TEXT,
      vehicle_year TEXT,
      vehicle_registration TEXT,
      last_service_date TEXT,
      preferred_language TEXT DEFAULT 'hinglish',
      status TEXT DEFAULT 'queued',
      call_id TEXT,
      bolna_execution_id TEXT,
      call_started_at DATETIME,
      call_ended_at DATETIME,
      call_duration_seconds INTEGER,
      transcript_json TEXT,
      call_outcome TEXT,
      appointment_date TEXT,
      appointment_time TEXT,
      service_type TEXT,
      request_type TEXT,
      service_request_number TEXT,
      csn TEXT,
      escalation_status TEXT,
      visit_window TEXT,
      notes TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      contact_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (contact_id) REFERENCES campaign_contacts(id)
    );

    -- Webhook idempotency: track processed execution_ids
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL UNIQUE,
      status TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Do Not Call list (TRAI compliance)
    CREATE TABLE IF NOT EXISTS dnc_list (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL UNIQUE,
      reason TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Migration tracking
    CREATE TABLE IF NOT EXISTS db_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON campaign_contacts(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON campaign_contacts(status);
    CREATE INDEX IF NOT EXISTS idx_contacts_call_id ON campaign_contacts(call_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_execution_id ON campaign_contacts(bolna_execution_id);
    CREATE INDEX IF NOT EXISTS idx_logs_campaign ON call_logs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_logs_contact ON call_logs(contact_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_execution ON webhook_events(execution_id);
    CREATE INDEX IF NOT EXISTS idx_dnc_phone ON dnc_list(phone_number);
  `);
}

// ─── Migration Runner ─────────────────────────────────────────

const MIGRATIONS = [
    {
        name: '001_add_recording_url',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN recording_url TEXT;',
    },
    {
        name: '002_add_customer_type',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN customer_type TEXT;',
    },
    {
        name: '003_add_dealer_number',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN dealer_number TEXT;',
    },
    {
        name: '004_add_product_category',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN product_category TEXT;',
    },
    {
        name: '005_add_product_name',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN product_name TEXT;',
    },
    {
        name: '006_add_model_number',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN model_number TEXT;',
    },
    {
        name: '007_add_serial_number',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN serial_number TEXT;',
    },
    {
        name: '008_add_purchase_date',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN purchase_date TEXT;',
    },
    {
        name: '009_add_warranty_status',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN warranty_status TEXT;',
    },
    {
        name: '010_add_address',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN address TEXT;',
    },
    {
        name: '011_add_pincode',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN pincode TEXT;',
    },
    {
        name: '012_add_issue_summary',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN issue_summary TEXT;',
    },
    {
        name: '013_add_request_type',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN request_type TEXT;',
    },
    {
        name: '014_add_service_request_number',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN service_request_number TEXT;',
    },
    {
        name: '015_add_csn',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN csn TEXT;',
    },
    {
        name: '016_add_escalation_status',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN escalation_status TEXT;',
    },
    {
        name: '017_add_visit_window',
        sql: 'ALTER TABLE campaign_contacts ADD COLUMN visit_window TEXT;',
    },
];

function runMigrations() {
    for (const migration of MIGRATIONS) {
        const already = db.prepare('SELECT id FROM db_migrations WHERE name = ?').get(migration.name);
        if (!already) {
            db.exec(migration.sql);
            db.prepare('INSERT INTO db_migrations (name) VALUES (?)').run(migration.name);
        }
    }
}

// ─── Campaign Queries ────────────────────────────────────────

function createCampaign(campaign) {
    const stmt = db.prepare(`
    INSERT INTO campaigns (id, name, language, total_contacts, dealer_name, dealer_address, dealer_phone, config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(
        campaign.id,
        campaign.name,
        campaign.language,
        campaign.totalContacts,
        campaign.dealerName,
        campaign.dealerAddress,
        campaign.dealerPhone,
        JSON.stringify(campaign.config || {})
    );
    return getCampaign(campaign.id);
}

function getCampaign(id) {
    return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

function getAllCampaigns() {
    return db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
}

function getRunningCampaigns() {
    return db.prepare("SELECT * FROM campaigns WHERE status = 'running'").all();
}

function updateCampaign(id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
    }
    values.push(id);
    db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getCampaign(id);
}

function updateCampaignStats(campaignId) {
    const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active
    FROM campaign_contacts WHERE campaign_id = ?
  `).get(campaignId);

    db.prepare(`
    UPDATE campaigns SET
      total_contacts = ?, completed_contacts = ?, failed_contacts = ?, active_calls = ?
    WHERE id = ?
  `).run(stats.total, stats.completed, stats.failed, stats.active, campaignId);

    return getCampaign(campaignId);
}

// ─── Contact Queries ─────────────────────────────────────────

function insertContacts(contacts) {
    const stmt = db.prepare(`
    INSERT INTO campaign_contacts (
      id, campaign_id, customer_name, phone_number, customer_type, dealer_number,
      product_category, product_name, model_number, serial_number, purchase_date,
      warranty_status, address, pincode, issue_summary,
      vehicle_model, vehicle_year, vehicle_registration, last_service_date, preferred_language
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const insertMany = db.transaction((items) => {
        for (const c of items) {
            stmt.run(
                c.id,
                c.campaignId,
                c.customerName,
                c.phoneNumber,
                c.customerType,
                c.dealerNumber,
                c.productCategory,
                c.productName,
                c.modelNumber,
                c.serialNumber,
                c.purchaseDate,
                c.warrantyStatus,
                c.address,
                c.pincode,
                c.issueSummary,
                c.vehicleModel,
                c.vehicleYear,
                c.vehicleRegistration,
                c.lastServiceDate,
                c.preferredLanguage
            );
        }
    });
    insertMany(contacts);
}

function getCampaignContacts(campaignId) {
    return db.prepare('SELECT * FROM campaign_contacts WHERE campaign_id = ? ORDER BY created_at ASC').all(campaignId);
}

function getQueuedContacts(campaignId, limit = 5) {
    return db.prepare('SELECT * FROM campaign_contacts WHERE campaign_id = ? AND status = ? ORDER BY created_at ASC LIMIT ?').all(campaignId, 'queued', limit);
}

function getContact(id) {
    return db.prepare('SELECT * FROM campaign_contacts WHERE id = ?').get(id);
}

function getContactByCallId(callId) {
    return db.prepare('SELECT * FROM campaign_contacts WHERE call_id = ?').get(callId);
}

function getContactByExecutionId(executionId) {
    return db.prepare('SELECT * FROM campaign_contacts WHERE bolna_execution_id = ? OR call_id = ? LIMIT 1').get(executionId, executionId);
}

function isDuplicatePhone(phoneNumber) {
    const existing = db.prepare(
        "SELECT id FROM campaign_contacts WHERE phone_number = ? AND status NOT IN ('failed') LIMIT 1"
    ).get(phoneNumber);
    return !!existing;
}

function updateContact(id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare(`UPDATE campaign_contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getContact(id);
}

function resetInProgressContacts(campaignId) {
    // Called on server restart — reset stuck in-progress contacts back to queued
    db.prepare(`
    UPDATE campaign_contacts
    SET status = 'queued', updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ? AND status = 'in-progress'
  `).run(campaignId);
}

// ─── Call Log Queries ────────────────────────────────────────

function insertCallLog(log) {
    db.prepare(`
    INSERT INTO call_logs (id, campaign_id, contact_id, event_type, event_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(log.id, log.campaignId, log.contactId, log.eventType, JSON.stringify(log.eventData || {}));
}

function getCallLogs(contactId) {
    return db.prepare('SELECT * FROM call_logs WHERE contact_id = ? ORDER BY created_at ASC').all(contactId);
}

// ─── Webhook Idempotency ─────────────────────────────────────

function isWebhookProcessed(executionId) {
    const row = db.prepare('SELECT id FROM webhook_events WHERE execution_id = ?').get(executionId);
    return !!row;
}

function markWebhookProcessed(executionId, status) {
    db.prepare(`
    INSERT OR IGNORE INTO webhook_events (id, execution_id, status)
    VALUES (?, ?, ?)
  `).run(uuidv4(), executionId, status || 'processed');
}

// ─── DNC (Do Not Call) ───────────────────────────────────────

function isPhoneOnDNC(phoneNumber) {
    const row = db.prepare('SELECT id FROM dnc_list WHERE phone_number = ?').get(phoneNumber);
    return !!row;
}

function addToDNC(phoneNumber, reason) {
    db.prepare(`
    INSERT OR IGNORE INTO dnc_list (id, phone_number, reason)
    VALUES (?, ?, ?)
  `).run(uuidv4(), phoneNumber, reason || '');
}

function removeFromDNC(phoneNumber) {
    db.prepare('DELETE FROM dnc_list WHERE phone_number = ?').run(phoneNumber);
}

function getDNCList() {
    return db.prepare('SELECT * FROM dnc_list ORDER BY added_at DESC').all();
}

function bulkAddToDNC(entries) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO dnc_list (id, phone_number, reason)
    VALUES (?, ?, ?)
  `);
    const insertMany = db.transaction((items) => {
        for (const entry of items) {
            stmt.run(uuidv4(), entry.phone_number, entry.reason || '');
        }
    });
    insertMany(entries);
}

module.exports = {
    getDb,
    createCampaign,
    getCampaign,
    getAllCampaigns,
    getRunningCampaigns,
    updateCampaign,
    updateCampaignStats,
    insertContacts,
    getCampaignContacts,
    getQueuedContacts,
    getContact,
    getContactByCallId,
    getContactByExecutionId,
    isDuplicatePhone,
    updateContact,
    resetInProgressContacts,
    insertCallLog,
    getCallLogs,
    isWebhookProcessed,
    markWebhookProcessed,
    isPhoneOnDNC,
    addToDNC,
    removeFromDNC,
    getDNCList,
    bulkAddToDNC,
};

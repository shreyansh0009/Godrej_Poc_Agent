const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../db/database');
const orchestrator = require('../services/callOrchestrator');
const logger = require('../utils/logger');
const { campaignStartLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '..', 'uploads'),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.csv', '.xlsx', '.xls'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'));
        }
    },
});

// ─── Validation Rules ────────────────────────────────────────

const createCampaignValidation = [
    body('name').trim().notEmpty().withMessage('Campaign name is required').isLength({ max: 200 }),
    body('language').optional().isIn(['hindi', 'english', 'hinglish']).withMessage('Invalid language'),
];

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
}

// ─── Routes ──────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns — List all campaigns
 */
router.get('/', (_req, res) => {
    try {
        const campaigns = db.getAllCampaigns();
        res.json({ success: true, data: campaigns });
    } catch (error) {
        logger.error('[Campaigns] List error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/campaigns/:id — Get campaign details with contacts
 */
router.get('/:id', (req, res) => {
    try {
        const campaign = db.getCampaign(req.params.id);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        const contacts = db.getCampaignContacts(req.params.id);
        res.json({ success: true, data: { ...campaign, contacts } });
    } catch (error) {
        logger.error('[Campaigns] Get error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/campaigns — Create a new campaign with CSV/Excel upload
 */
router.post('/', upload.single('file'), createCampaignValidation, handleValidationErrors, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'File is required' });
        }

        const { name, language, dealerName, dealerAddress, dealerPhone } = req.body;

        // Parse the uploaded file
        const contacts = await parseFile(req.file);

        if (contacts.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid contacts found in file' });
        }

        // Create campaign
        const campaignId = uuidv4();
        const campaign = db.createCampaign({
            id: campaignId,
            name,
            language: language || config.defaults.language,
            totalContacts: contacts.length,
            dealerName: dealerName || config.defaults.dealerName,
            dealerAddress: dealerAddress || config.defaults.dealerAddress,
            dealerPhone: dealerPhone || config.defaults.dealerPhone,
            config: JSON.parse(req.body.config || '{}'),
        });

        // Build contact records — flag DNC numbers and duplicates
        const dncFlags = [];
        const contactRecords = contacts.map(c => {
            const phone = normalizePhone(c.phone_number || c.phone || c.phoneNumber || c.mobile || '');
            const onDnc = db.isPhoneOnDNC(phone);
            const isDuplicate = !onDnc && db.isDuplicatePhone(phone);

            if (onDnc) dncFlags.push(phone);

            return {
                id: uuidv4(),
                campaignId,
                customerName: c.customer_name || c.name || c.customerName || 'Unknown',
                phoneNumber: phone,
                customerType: c.customer_type || c.user_type || c.contact_type || '',
                dealerNumber: c.dealer_number || c.partner_code || '',
                productCategory: c.product_category || c.appliance_category || c.category || '',
                productName: c.product_name || c.product || c.appliance_name || '',
                modelNumber: c.model_number || c.model_no || c.product_model || '',
                serialNumber: c.serial_number || c.serial_no || c.product_serial || '',
                purchaseDate: c.purchase_date || c.invoice_date || '',
                warrantyStatus: c.warranty_status || c.warranty || '',
                address: c.address || c.customer_address || '',
                pincode: c.pincode || c.pin_code || c.zip || '',
                issueSummary: c.issue_summary || c.issue || c.problem || c.concern || '',
                vehicleModel: c.vehicle_model || c.vehicleModel || c.model || c.car_model || '',
                vehicleYear: c.vehicle_year || c.vehicleYear || c.year || '',
                vehicleRegistration: c.vehicle_registration || c.vehicleRegistration || c.registration || c.reg_no || '',
                lastServiceDate: c.last_service_date || c.lastServiceDate || c.last_service || '',
                // Per-contact language from CSV wins over campaign-level setting
                preferredLanguage: c.preferred_language || c.language || language || config.defaults.language,
                // Pre-mark DNC/duplicate contacts so they skip dialing
                ...(onDnc ? { status: 'failed', call_outcome: 'dnc', notes: 'On Do Not Call list' } : {}),
                ...(isDuplicate ? { notes: 'Possible duplicate — phone exists in active campaign' } : {}),
            };
        });

        db.insertContacts(contactRecords);

        // Clean up uploaded file immediately
        fs.unlinkSync(req.file.path);

        logger.info('[Campaigns] Created campaign', {
            name,
            totalContacts: contacts.length,
            dncFlagged: dncFlags.length,
        });

        res.json({
            success: true,
            data: {
                ...campaign,
                contacts: db.getCampaignContacts(campaignId),
                warnings: dncFlags.length > 0
                    ? [`${dncFlags.length} contact(s) skipped — on Do Not Call list`]
                    : [],
            },
        });
    } catch (error) {
        logger.error('[Campaigns] Create error', { error: error.message });
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/campaigns/:id/start — Start campaign execution
 */
router.post('/:id/start', campaignStartLimiter, async (req, res) => {
    try {
        const campaign = await orchestrator.startCampaign(req.params.id);
        res.json({ success: true, data: campaign });
    } catch (error) {
        logger.error('[Campaigns] Start error', { campaignId: req.params.id, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/campaigns/:id/stop — Stop campaign execution
 */
router.post('/:id/stop', async (req, res) => {
    try {
        const campaign = await orchestrator.stopCampaign(req.params.id);
        res.json({ success: true, data: campaign });
    } catch (error) {
        logger.error('[Campaigns] Stop error', { campaignId: req.params.id, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/campaigns/:id/contacts — Get all contacts for a campaign
 */
router.get('/:id/contacts', (req, res) => {
    try {
        const contacts = db.getCampaignContacts(req.params.id);
        res.json({ success: true, data: contacts });
    } catch (error) {
        logger.error('[Campaigns] Get contacts error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/campaigns/:id/export — Export campaign results as CSV
 */
router.get('/:id/export', (req, res) => {
    try {
        const campaign = db.getCampaign(req.params.id);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        const contacts = db.getCampaignContacts(req.params.id);

        const headers = [
            'customer_name', 'phone_number', 'customer_type', 'dealer_number',
            'product_category', 'product_name', 'model_number', 'serial_number',
            'purchase_date', 'warranty_status', 'address', 'pincode', 'issue_summary',
            'preferred_language', 'status', 'call_outcome', 'request_type',
            'service_request_number', 'csn', 'escalation_status', 'visit_window',
            'appointment_date', 'appointment_time', 'service_type', 'call_duration_seconds',
            'notes',
        ];

        const rows = contacts.map(c =>
            headers.map(h => {
                const val = c[h] ?? '';
                // Escape CSV fields containing commas or quotes
                const str = String(val).replace(/"/g, '""');
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str}"`
                    : str;
            }).join(',')
        );

        const csvContent = [headers.join(','), ...rows].join('\n');
        const filename = `campaign_${campaign.name.replace(/\s+/g, '_')}_results.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);

        logger.info('[Campaigns] Exported results', { campaignId: req.params.id, rows: contacts.length });
    } catch (error) {
        logger.error('[Campaigns] Export error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Helper Functions ────────────────────────────────────────

function parseFile(file) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.csv') {
            const results = [];
            fs.createReadStream(file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', reject);
        } else if (ext === '.xlsx' || ext === '.xls') {
            try {
                const workbook = XLSX.readFile(file.path);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);
                resolve(data);
            } catch (err) {
                reject(err);
            }
        } else {
            reject(new Error('Unsupported file format'));
        }
    });
}

function normalizePhone(phone) {
    let normalized = phone.replace(/[^\d+]/g, '');
    if (normalized.length === 10) {
        normalized = '+91' + normalized;
    } else if (normalized.startsWith('91') && normalized.length === 12) {
        normalized = '+' + normalized;
    } else if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
    }
    return normalized;
}

module.exports = router;

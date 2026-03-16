import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload,
    FileSpreadsheet,
    X,
    Rocket,
    ChevronDown,
    Users,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createCampaign, startCampaign } from '../lib/api';

export default function CreateCampaign() {
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        language: 'hinglish',
        dealerName: '',
        dealerAddress: '',
        dealerPhone: '',
        autoStart: true,
    });

    const handleFile = useCallback((selectedFile) => {
        if (!selectedFile) return;
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) {
            toast.error('Please upload a CSV or Excel file');
            return;
        }

        setFile(selectedFile);

        // Parse CSV for preview
        if (ext === 'csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length > 0) {
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    const rows = lines.slice(1, 6).map(line => {
                        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                        const row = {};
                        headers.forEach((h, i) => { row[h] = values[i] || ''; });
                        return row;
                    });
                    setPreview(rows);
                }
            };
            reader.readAsText(selectedFile);
        } else {
            setPreview([{ note: 'Excel file loaded. Preview available after upload.' }]);
        }
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            toast.error('Please upload a contact file');
            return;
        }
        if (!form.name.trim()) {
            toast.error('Please enter a campaign name');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', form.name);
            formData.append('language', form.language);
            formData.append('dealerName', form.dealerName);
            formData.append('dealerAddress', form.dealerAddress);
            formData.append('dealerPhone', form.dealerPhone);

            const result = await createCampaign(formData);

            if (result.success) {
                toast.success(`Campaign "${form.name}" created with ${result.data.contacts?.length || 0} contacts!`);

                if (form.autoStart) {
                    toast.loading('Starting campaign...');
                    await startCampaign(result.data.id);
                    toast.dismiss();
                    toast.success('Campaign is now running!');
                }

                navigate(`/campaigns/${result.data.id}`);
            } else {
                toast.error(result.error || 'Failed to create campaign');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to create campaign');
        } finally {
            setLoading(false);
        }
    };

    const previewHeaders = preview.length > 0 ? Object.keys(preview[0]) : [];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1>Create New Campaign</h1>
                <p>Upload your contact list and configure the AI voice agent for Godrej appliance support calls</p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid-2">
                    {/* Left Column — File Upload */}
                    <div>
                        <div className="card mb-6">
                            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                <Upload size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                                Upload Contacts
                            </h2>

                            <div
                                className={`file-upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={(e) => handleFile(e.target.files[0])}
                                    style={{ display: 'none' }}
                                />

                                {file ? (
                                    <>
                                        <div className="file-upload-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)' }}>
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <h3>{file.name}</h3>
                                        <p>{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm mt-2"
                                            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview([]); }}
                                        >
                                            <X size={14} /> Remove
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="file-upload-icon">
                                            <FileSpreadsheet size={24} />
                                        </div>
                                        <h3>Drag & drop your file here</h3>
                                        <p>Supports CSV, XLSX, XLS files (max 10MB)</p>
                                        <p className="mt-2" style={{ fontSize: 12, color: 'var(--accent-indigo)' }}>
                                            Required columns: customer_name, phone_number
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Preview Table */}
                        {preview.length > 0 && previewHeaders[0] !== 'note' && (
                            <div className="card animate-scaleIn">
                                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                    <Users size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                                    Preview ({preview.length} of contacts shown)
                                </h2>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                {previewHeaders.map(h => <th key={h}>{h.replace(/_/g, ' ')}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.map((row, i) => (
                                                <tr key={i}>
                                                    {previewHeaders.map(h => <td key={h}>{row[h]}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column — Configuration */}
                    <div>
                        <div className="card mb-6">
                            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
                                Campaign Settings
                            </h2>

                            <div className="form-group">
                                <label>Campaign Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Godrej AC Service Follow-up - Bengaluru"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Language</label>
                                <select
                                    className="form-select"
                                    value={form.language}
                                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                                >
                                    <option value="hinglish">Hinglish (Hindi + English Mix)</option>
                                    <option value="hindi">Hindi (शुद्ध हिंदी)</option>
                                    <option value="english">English (Indian Accent)</option>
                                </select>
                            </div>
                        </div>

                        <div className="card mb-6">
                            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
                                Dealer Information
                            </h2>

                            <div className="form-group">
                                <label>Support Center Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Godrej Support"
                                    value={form.dealerName}
                                    onChange={(e) => setForm({ ...form, dealerName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Dealer Address</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Godrej Service Network, Ajmer"
                                    value={form.dealerAddress}
                                    onChange={(e) => setForm({ ...form, dealerAddress: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Dealer Phone</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="+919876543210"
                                    value={form.dealerPhone}
                                    onChange={(e) => setForm({ ...form, dealerPhone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="card">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.autoStart}
                                    onChange={(e) => setForm({ ...form, autoStart: e.target.checked })}
                                    style={{ width: 18, height: 18, accentColor: 'var(--accent-indigo)' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>Auto-start campaign</div>
                                    <div className="text-sm text-muted">Begin calling contacts immediately after creation</div>
                                </div>
                            </label>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg w-full mt-6"
                                disabled={loading || !file || !form.name.trim()}
                            >
                                {loading ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Rocket size={18} />
                                        {form.autoStart ? 'Create & Start Campaign' : 'Create Campaign'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* CSV Format Guide */}
            <div className="card mt-6">
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    <AlertCircle size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    CSV Format Guide
                </h2>
                <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
                    Your CSV file should have the following columns. Only <strong>customer_name</strong> and <strong>phone_number</strong> are required.
                </p>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Required</th>
                                <th>Example</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>customer_name</td><td>✅ Yes</td><td>Rajesh Kumar</td></tr>
                            <tr><td>phone_number</td><td>✅ Yes</td><td>9876543210</td></tr>
                            <tr><td>customer_type</td><td>Optional</td><td>customer</td></tr>
                            <tr><td>product_category</td><td>Optional</td><td>AC</td></tr>
                            <tr><td>product_name</td><td>Optional</td><td>Godrej Split AC 1.5T</td></tr>
                            <tr><td>model_number</td><td>Optional</td><td>GSC18FG8WTA</td></tr>
                            <tr><td>serial_number</td><td>Optional</td><td>ACX1234567</td></tr>
                            <tr><td>purchase_date</td><td>Optional</td><td>2025-06-15</td></tr>
                            <tr><td>warranty_status</td><td>Optional</td><td>in_warranty</td></tr>
                            <tr><td>address</td><td>Optional</td><td>12 MG Road, Bengaluru</td></tr>
                            <tr><td>pincode</td><td>Optional</td><td>560001</td></tr>
                            <tr><td>issue_summary</td><td>Optional</td><td>Cooling issue since yesterday</td></tr>
                            <tr><td>preferred_language</td><td>Optional</td><td>hinglish</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

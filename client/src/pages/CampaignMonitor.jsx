import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Activity,
    Phone,
    PhoneOff,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    Square,
    Eye,
    RefreshCw,
    Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCampaign, startCampaign, stopCampaign } from '../lib/api';
import socket from '../lib/socket';

export default function CampaignMonitor() {
    const { id } = useParams();
    const [campaign, setCampaign] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const loadCampaign = useCallback(async () => {
        try {
            const res = await getCampaign(id);
            if (res.success) {
                setCampaign(res.data);
                setContacts(res.data.contacts || []);
            }
        } catch (err) {
            console.error('Failed to load campaign:', err);
            toast.error('Failed to load campaign');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadCampaign();

        // Real-time updates
        socket.on('contact:status', (data) => {
            if (data.campaignId === id) {
                setContacts(prev => prev.map(c =>
                    c.id === data.contactId
                        ? { ...c, status: data.status, call_outcome: data.outcome, call_duration_seconds: data.duration, recording_url: data.recordingUrl || c.recording_url }
                        : c
                ));
            }
        });

        socket.on('campaign:stats', (data) => {
            if (data.campaignId === id) {
                setCampaign(prev => prev ? {
                    ...prev,
                    total_contacts: data.stats.total,
                    completed_contacts: data.stats.completed,
                    failed_contacts: data.stats.failed,
                    active_calls: data.stats.active,
                } : prev);
            }
        });

        socket.on('campaign:status', (data) => {
            if (data.campaignId === id) {
                setCampaign(prev => prev ? { ...prev, status: data.status } : prev);
            }
        });

        return () => {
            socket.off('contact:status');
            socket.off('campaign:stats');
            socket.off('campaign:status');
        };
    }, [id, loadCampaign]);

    const handleStart = async () => {
        setActionLoading(true);
        try {
            await startCampaign(id);
            toast.success('Campaign started!');
            loadCampaign();
        } catch (err) {
            toast.error('Failed to start campaign');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStop = async () => {
        setActionLoading(true);
        try {
            await stopCampaign(id);
            toast.success('Campaign paused');
            loadCampaign();
        } catch (err) {
            toast.error('Failed to stop campaign');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1>Loading...</h1></div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1>Campaign Not Found</h1></div>
            </div>
        );
    }

    const total = campaign.total_contacts || 0;
    const completed = campaign.completed_contacts || 0;
    const failed = campaign.failed_contacts || 0;
    const active = campaign.active_calls || 0;
    const queued = Math.max(0, total - completed - failed - active);
    const booked = contacts.filter(c =>
        c.call_outcome === 'request_registered' ||
        !!c.service_request_number
    ).length;
    const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    const statusOrder = { 'in-progress': 0, dialing: 1, queued: 2, completed: 3, failed: 4 };
    const sortedContacts = [...contacts].sort(
        (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    );

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1>{campaign.name}</h1>
                        <p>
                            {campaign.dealer_name} • {campaign.language} •
                            <span className={`badge badge-${campaign.status}`} style={{ marginLeft: 8 }}>
                                <span className="badge-dot" /> {campaign.status}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={loadCampaign}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                        {campaign.status === 'running' ? (
                            <button
                                className="btn btn-danger"
                                onClick={handleStop}
                                disabled={actionLoading}
                            >
                                <Square size={16} /> Stop Campaign
                            </button>
                        ) : campaign.status !== 'completed' ? (
                            <button
                                className="btn btn-success"
                                onClick={handleStart}
                                disabled={actionLoading}
                            >
                                <Play size={16} /> Start Campaign
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="stats-grid">
                <div className="stat-card indigo">
                    <div className="stat-icon indigo"><Users size={22} /></div>
                    <div className="stat-info">
                        <h3>{total}</h3>
                        <p>Total Contacts</p>
                    </div>
                </div>
                <div className="stat-card cyan">
                    <div className="stat-icon cyan"><Phone size={22} /></div>
                    <div className="stat-info">
                        <h3>{active}</h3>
                        <p>In Progress</p>
                    </div>
                </div>
                <div className="stat-card amber">
                    <div className="stat-icon amber"><Clock size={22} /></div>
                    <div className="stat-info">
                        <h3>{queued}</h3>
                        <p>Pending</p>
                    </div>
                </div>
                <div className="stat-card emerald">
                    <div className="stat-icon emerald"><CheckCircle2 size={22} /></div>
                    <div className="stat-info">
                        <h3>{completed}</h3>
                        <p>Completed</p>
                    </div>
                </div>
                <div className="stat-card rose">
                    <div className="stat-icon rose"><XCircle size={22} /></div>
                    <div className="stat-info">
                        <h3>{failed}</h3>
                        <p>Failed / No Answer</p>
                    </div>
                </div>
                <div className="stat-card emerald">
                    <div className="stat-icon emerald"><PhoneOff size={22} /></div>
                    <div className="stat-info">
                        <h3>{booked}</h3>
                        <p>Requests Registered</p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>Campaign Progress</h2>
                    <span className="text-secondary" style={{ fontWeight: 700, fontSize: 20 }}>
                        {progress}%
                    </span>
                </div>
                <div className="progress-bar" style={{ height: 10 }}>
                    <div
                        className={`progress-fill ${progress === 100 ? 'success' : ''}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Contact List */}
            <div className="card">
                <div className="card-header">
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                        <Activity size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Contact Status
                    </h2>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Phone</th>
                                <th>Product</th>
                                <th>Status</th>
                                <th>Outcome</th>
                                <th>Duration</th>
                                <th>Next Step</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedContacts.map((c) => (
                                <tr key={c.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                                        <div className="text-sm text-muted">{c.preferred_language}</div>
                                    </td>
                                    <td className="font-mono text-sm">{c.phone_number}</td>
                                    <td>
                                        <div className="text-sm">{c.product_name || c.product_category || c.vehicle_model || '—'}</div>
                                        <div className="text-sm text-muted">{c.model_number || c.serial_number || c.vehicle_year || '—'}</div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${c.status}`}>
                                            <span className="badge-dot" />
                                            {c.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {c.call_outcome ? (
                                                <span className={`badge ${(c.call_outcome === 'request_registered' || c.service_request_number) ? 'badge-completed' : c.call_outcome === 'failed' || c.call_outcome === 'no-answer' || c.call_outcome === 'busy' ? 'badge-failed' : 'badge-queued'}`}>
                                                    {c.call_outcome}
                                                </span>
                                            ) : '—'}
                                            {c.recording_url && (
                                                <a
                                                    href={c.recording_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Listen to recording"
                                                    style={{ color: 'var(--accent-indigo)', lineHeight: 1 }}
                                                >
                                                    <Mic size={13} />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-sm text-muted">
                                        {c.call_duration_seconds
                                            ? `${Math.floor(c.call_duration_seconds / 60)}m ${c.call_duration_seconds % 60}s`
                                            : '—'}
                                    </td>
                                    <td className="text-sm">
                                        {c.service_request_number || c.visit_window || c.appointment_date ? (
                                            <div>
                                                <div style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                                    {c.service_request_number || c.appointment_date}
                                                </div>
                                                <div className="text-muted">{c.visit_window || c.appointment_time || c.request_type || '—'}</div>
                                            </div>
                                        ) : '—'}
                                    </td>
                                                    <td>
                                        {(c.status === 'completed' || c.status === 'failed') && (
                                            <Link
                                                to={`/campaigns/${id}/contacts/${c.id}`}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                <Eye size={12} /> Details
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

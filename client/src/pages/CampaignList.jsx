import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { List, ArrowRight, Clock, Users, Megaphone, PlusCircle } from 'lucide-react';
import { getCampaigns } from '../lib/api';
import socket from '../lib/socket';

export default function CampaignList() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
        socket.on('campaign:status', loadCampaigns);
        return () => socket.off('campaign:status');
    }, []);

    async function loadCampaigns() {
        try {
            const res = await getCampaigns();
            if (res.success) setCampaigns(res.data);
        } catch (err) {
            console.error('Failed to load campaigns:', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1>All Campaigns</h1>
                        <p>Manage and monitor your Godrej appliance support campaigns</p>
                    </div>
                    <Link to="/campaigns/new" className="btn btn-primary">
                        <PlusCircle size={16} /> New Campaign
                    </Link>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="empty-state"><p>Loading campaigns...</p></div>
                ) : campaigns.length === 0 ? (
                    <div className="empty-state">
                        <Megaphone size={48} />
                        <h3>No campaigns found</h3>
                        <p>Create your first campaign to get started.</p>
                        <Link to="/campaigns/new" className="btn btn-primary mt-4">
                            <PlusCircle size={16} /> Create Campaign
                        </Link>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Status</th>
                                    <th>Contacts</th>
                                    <th>Progress</th>
                                    <th>Active</th>
                                    <th>Language</th>
                                    <th>Created</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => {
                                    const total = c.total_contacts || 0;
                                    const completed = c.completed_contacts || 0;
                                    const failed = c.failed_contacts || 0;
                                    const active = c.active_calls || 0;
                                    const queued = total - completed - failed - active;
                                    const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                                <div className="text-sm text-muted">{c.dealer_name || '—'}</div>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${c.status}`}>
                                                    <span className="badge-dot" />
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Users size={14} className="text-muted" />
                                                    {total}
                                                </div>
                                            </td>
                                            <td style={{ minWidth: 150 }}>
                                                <div className="text-sm text-secondary" style={{ marginBottom: 4 }}>
                                                    ✅ {completed} &nbsp; ❌ {failed} &nbsp; ⏳ {queued}
                                                </div>
                                                <div className="progress-bar">
                                                    <div
                                                        className={`progress-fill ${progress === 100 ? 'success' : ''}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                {active > 0 ? (
                                                    <span className="badge badge-in-progress">
                                                        <span className="badge-dot" />
                                                        {active} live
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <span className="badge badge-created">{c.language}</span>
                                            </td>
                                            <td className="text-sm text-muted">
                                                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                                                {new Date(c.created_at).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td>
                                                <Link to={`/campaigns/${c.id}`} className="btn btn-secondary btn-sm">
                                                    Monitor <ArrowRight size={12} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

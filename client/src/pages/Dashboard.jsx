import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Megaphone,
    Phone,
    PhoneCall,
    Users,
    TrendingUp,
    ArrowRight,
    PlusCircle,
    Clock,
    CheckCircle2,
    XCircle,
    CalendarCheck,
} from 'lucide-react';
import { getStats, getCampaigns } from '../lib/api';
import socket from '../lib/socket';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();

        socket.on('campaign:status', () => loadData());
        socket.on('campaign:stats', () => loadData());

        return () => {
            socket.off('campaign:status');
            socket.off('campaign:stats');
        };
    }, []);

    async function loadData() {
        try {
            const [statsRes, campaignsRes] = await Promise.all([
                getStats(),
                getCampaigns(),
            ]);
            if (statsRes.success) setStats(statsRes.data);
            if (campaignsRes.success) setCampaigns(campaignsRes.data.slice(0, 5));
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }

    const statCards = stats ? [
        { label: 'Total Campaigns', value: stats.totalCampaigns, icon: Megaphone, color: 'indigo' },
        { label: 'Active Campaigns', value: stats.activeCampaigns, icon: PhoneCall, color: 'cyan' },
        { label: 'Calls Pending', value: stats.pending, icon: Clock, color: 'amber' },
        { label: 'Calls In Progress', value: stats.inProgress, icon: Phone, color: 'cyan' },
        { label: 'Calls Completed', value: stats.totalCalls, icon: CheckCircle2, color: 'emerald' },
        { label: 'Failed / No Answer', value: stats.failed, icon: XCircle, color: 'rose' },
        { label: 'Requests Registered', value: stats.booked, icon: CalendarCheck, color: 'emerald' },
        { label: 'Success Rate', value: `${stats.successRate}%`, icon: TrendingUp, color: 'amber' },
    ] : [];

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1>Dashboard</h1>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1>Dashboard</h1>
                        <p>AI Voice Agent — Godrej Appliances Support Platform</p>
                    </div>
                    <Link to="/campaigns/new" className="btn btn-primary">
                        <PlusCircle size={16} />
                        New Campaign
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                {statCards.map((stat, i) => (
                    <div key={i} className={`stat-card ${stat.color}`}>
                        <div className={`stat-icon ${stat.color}`}>
                            <stat.icon size={22} />
                        </div>
                        <div className="stat-info">
                            <h3>{stat.value}</h3>
                            <p>{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Campaigns */}
            <div className="card">
                <div className="card-header">
                    <h2>Recent Campaigns</h2>
                    <Link to="/campaigns" className="btn btn-secondary btn-sm">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>

                {campaigns.length === 0 ? (
                    <div className="empty-state">
                        <Megaphone size={48} />
                        <h3>No campaigns yet</h3>
                        <p>Create your first campaign to start making AI-powered appliance support calls to your customers.</p>
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
                                    <th>Progress</th>
                                    <th>Language</th>
                                    <th>Created</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => {
                                    const total = c.total_contacts || 0;
                                    const completed = c.completed_contacts || 0;
                                    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                                <div className="text-sm text-muted">{total} contacts</div>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${c.status}`}>
                                                    <span className="badge-dot" />
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td style={{ minWidth: 140 }}>
                                                <div className="text-sm text-secondary" style={{ marginBottom: 4 }}>
                                                    {completed}/{total} ({progress}%)
                                                </div>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-created">{c.language}</span>
                                            </td>
                                            <td className="text-sm text-muted">
                                                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                                                {new Date(c.created_at).toLocaleDateString('en-IN')}
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

import React, { useEffect, useState } from 'react';
import {
    Activity,
    Server,
    Database,
    Phone,
    Wifi,
    CheckCircle2,
    XCircle,
    RefreshCw,
} from 'lucide-react';
import { getHealth } from '../lib/api';

export default function SystemHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkHealth();
    }, []);

    async function checkHealth() {
        setLoading(true);
        setError(null);
        try {
            const data = await getHealth();
            setHealth(data);
        } catch (err) {
            setError(err.message || 'Failed to connect to server');
        } finally {
            setLoading(false);
        }
    }

    const services = health ? [
        {
            name: 'Backend Server',
            status: health.status === 'ok',
            icon: Server,
            detail: `Uptime: ${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s`,
        },
        {
            name: 'Database',
            status: health.services?.database === 'connected',
            icon: Database,
            detail: health.services?.database || 'unknown',
        },
        {
            name: 'Bolna AI',
            status: health.services?.bolna === 'configured',
            icon: Wifi,
            detail: health.services?.bolna || 'unknown',
        },
        {
            name: 'Phone Number',
            status: health.services?.phone && health.services.phone !== 'not_configured',
            icon: Phone,
            detail: health.services?.phone || 'unknown',
        },
    ] : [];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1>System Health</h1>
                        <p>Monitor the status of all system components</p>
                    </div>
                    <button className="btn btn-secondary" onClick={checkHealth} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Checking...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="card" style={{ borderColor: 'var(--accent-rose)' }}>
                    <div className="flex items-center gap-3">
                        <XCircle size={24} style={{ color: 'var(--accent-rose)' }} />
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-rose)' }}>
                                Server Unreachable
                            </h3>
                            <p className="text-sm text-secondary">
                                {error}. Make sure the backend server is running on port 3001.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {services.map((service) => (
                        <div key={service.name} className="card" style={{
                            borderColor: service.status ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
                        }}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 'var(--radius-md)',
                                        background: service.status ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: service.status ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                    }}>
                                        <service.icon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 15 }}>{service.name}</div>
                                        <div className="text-sm text-muted">{service.detail}</div>
                                    </div>
                                </div>
                                <span className={`badge ${service.status ? 'badge-completed' : 'badge-failed'}`}>
                                    {service.status ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                    {service.status ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {health && (
                <div className="card mt-6">
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Raw Response</h2>
                    <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        padding: 16,
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'auto',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        {JSON.stringify(health, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

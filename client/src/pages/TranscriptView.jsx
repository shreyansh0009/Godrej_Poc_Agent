import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    MessageSquare,
    User,
    Bot,
    Calendar,
    Clock,
    Car,
    Phone,
    FileText,
    Mic,
} from 'lucide-react';
import { getCallDetails } from '../lib/api';

export default function TranscriptView() {
    const { campaignId, contactId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [contactId]);

    async function loadData() {
        try {
            const res = await getCallDetails(contactId);
            if (res.success) setData(res.data);
        } catch (err) {
            console.error('Failed to load call details:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1>Loading transcript...</h1></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1>Call not found</h1></div>
            </div>
        );
    }

    const { contact, transcript, logs } = data;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <Link to={`/campaigns/${campaignId}`} className="btn btn-secondary btn-sm mb-4">
                    <ArrowLeft size={14} /> Back to Campaign
                </Link>
                <h1>Call Transcript — {contact.customer_name}</h1>
                <p>{contact.phone_number} • {contact.product_name || contact.product_category || contact.vehicle_model || 'Product not set'}</p>
            </div>

            <div className="grid-2">
                {/* Call Summary */}
                <div className="card">
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                        <FileText size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Call Summary
                    </h2>

                    <div style={{ display: 'grid', gap: 14 }}>
                        <div className="flex items-center gap-3">
                            <User size={16} className="text-muted" />
                            <div>
                                <div className="text-sm text-muted">Customer</div>
                                <div style={{ fontWeight: 600 }}>{contact.customer_name}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Phone size={16} className="text-muted" />
                            <div>
                                <div className="text-sm text-muted">Phone</div>
                                <div className="font-mono">{contact.phone_number}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Car size={16} className="text-muted" />
                            <div>
                                <div className="text-sm text-muted">Product</div>
                                <div>
                                    {contact.product_name || contact.product_category || contact.vehicle_model || '—'}
                                    {' • '}
                                    {contact.model_number || contact.serial_number || contact.vehicle_registration || '—'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Clock size={16} className="text-muted" />
                            <div>
                                <div className="text-sm text-muted">Duration</div>
                                <div>
                                    {contact.call_duration_seconds
                                        ? `${Math.floor(contact.call_duration_seconds / 60)}m ${contact.call_duration_seconds % 60}s`
                                        : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: (contact.call_outcome === 'request_registered' || contact.service_request_number) ? 'var(--accent-emerald)' : 'var(--accent-amber)', flexShrink: 0 }} />
                            <div>
                                <div className="text-sm text-muted">Outcome</div>
                                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                    {contact.call_outcome || 'Unknown'}
                                </div>
                            </div>
                        </div>

                        {(contact.service_request_number || contact.appointment_date) && (
                            <div className="flex items-center gap-3">
                                <Calendar size={16} style={{ color: 'var(--accent-emerald)' }} />
                                <div>
                                    <div className="text-sm text-muted">Service Request</div>
                                    <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>
                                        {contact.service_request_number || contact.appointment_date}
                                        {contact.visit_window ? ` • ${contact.visit_window}` : contact.appointment_time ? ` at ${contact.appointment_time}` : ''}
                                    </div>
                                </div>
                            </div>
                        )}

                        {(contact.request_type || contact.service_type) && (
                            <div className="flex items-center gap-3">
                                <Car size={16} style={{ color: 'var(--accent-cyan)' }} />
                                <div>
                                    <div className="text-sm text-muted">Request Type</div>
                                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                                        {contact.request_type || contact.service_type}
                                    </div>
                                </div>
                            </div>
                        )}

                        {contact.notes && (
                            <div>
                                <div className="text-sm text-muted" style={{ marginBottom: 4 }}>Notes</div>
                                <div className="text-sm" style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    {contact.notes}
                                </div>
                            </div>
                        )}

                        {contact.recording_url && (
                            <div className="flex items-center gap-3">
                                <Mic size={16} style={{ color: 'var(--accent-indigo)' }} />
                                <div>
                                    <div className="text-sm text-muted">Call Recording</div>
                                    <a
                                        href={contact.recording_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm"
                                        style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}
                                    >
                                        Listen to Recording ↗
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Transcript */}
                <div className="card">
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                        <MessageSquare size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Conversation Transcript
                    </h2>

                    {transcript && transcript.length > 0 ? (
                        <div className="transcript-container">
                            {transcript.map((msg, i) => {
                                const isAgent = msg.role === 'assistant' || msg.role === 'agent' || msg.speaker === 'agent';
                                return (
                                    <div key={i} className="transcript-message">
                                        <div className={`transcript-avatar ${isAgent ? 'agent' : 'customer'}`}>
                                            {isAgent ? <Bot size={14} /> : <User size={14} />}
                                        </div>
                                        <div className="transcript-body">
                                            <div className="speaker">
                                                {isAgent ? 'Naina (AI Agent)' : contact.customer_name}
                                            </div>
                                            <div className="text">{msg.content || msg.text || msg.message}</div>
                                            {msg.timestamp && (
                                                <div className="timestamp">{msg.timestamp}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <MessageSquare size={40} />
                            <h3>No transcript available</h3>
                            <p>Transcript data will appear here once the call is completed and processed.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Call Event Logs */}
            {logs && logs.length > 0 && (
                <div className="card mt-6">
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                        Event Log
                    </h2>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Time</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>
                                            <span className={`badge ${log.event_type.includes('completed') ? 'badge-completed' : log.event_type.includes('failed') ? 'badge-failed' : 'badge-queued'}`}>
                                                {log.event_type}
                                            </span>
                                        </td>
                                        <td className="text-sm text-muted">
                                            {new Date(log.created_at).toLocaleString('en-IN')}
                                        </td>
                                        <td className="text-sm text-muted truncate" style={{ maxWidth: 300 }}>
                                            {log.event_data ? JSON.stringify(JSON.parse(log.event_data)).substring(0, 100) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Mic, MicOff, Send, RefreshCw, Bot, User,
    Loader2, Info, Play, Square, Download, ChevronDown, ChevronUp,
    FlaskConical, Volume2, MessageSquare,
} from 'lucide-react';
import { testChat, speakText, runAutoTest } from '../lib/api';

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_CONTACT = {
    customer_name: 'Rahul Sharma',
    phone_number: '9571901180',
    customer_type: 'customer',
    product_category: 'AC',
    product_name: 'Godrej Split AC 1.5T',
    model_number: 'GSC18FG8WTA',
    serial_number: 'ACX1234567',
    purchase_date: '2025-09-15',
    warranty_status: 'in_warranty',
    address: '12 MG Road, Bengaluru',
    pincode: '560001',
    issue_summary: 'Cooling issue since yesterday',
    preferred_language: 'hinglish',
    dealer_name: 'Godrej Support',
    dealer_address: 'Godrej Service Network, Bengaluru',
    dealer_phone: '+919876543210',
};

const PERSONAS = [
    { id: 'cooperative', label: 'Cooperative', desc: 'Shares appliance issue and cooperates' },
    { id: 'busy', label: 'Busy', desc: 'Wants a quick support resolution' },
    { id: 'hesitant', label: 'Price-Sensitive', desc: 'Keeps asking about visit or service charges' },
    { id: 'problematic', label: 'Problematic', desc: 'Complaints + off-topic questions' },
    { id: 'hindi_only', label: 'Hindi Only', desc: 'Responds only in pure Hindi' },
];

const CRITERIA_LABELS = {
    phase_completion: 'Phase Completion',
    language_consistency: 'Language Consistency',
    feminine_grammar: 'Feminine Grammar',
    script_adherence: 'Script Adherence',
    guardrail_compliance: 'Guardrail Compliance',
    natural_flow: 'Natural Flow',
    information_accuracy: 'Information Accuracy',
    booking_success: 'Request Handling',
};

const STATUS_COLORS = {
    PASS: { bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.25)', text: '#059669' },
    PARTIAL: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#d97706' },
    FAIL: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444' },
};

// ─── Main Component ───────────────────────────────────────────

export default function AgentTester() {
    const [mode, setMode] = useState('voice');
    const [contact, setContact] = useState(DEFAULT_CONTACT);

    function handleContactChange(field, value) {
        setContact(prev => ({ ...prev, [field]: value }));
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* ── Left Panel: Contact Config ── */}
            <ContactPanel contact={contact} onChange={handleContactChange} />

            {/* ── Right Panel ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Tab Bar */}
                <div style={{
                    display: 'flex',
                    gap: 4,
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    flexShrink: 0,
                }}>
                    {[
                        { id: 'voice', icon: <Volume2 size={15} />, label: 'Voice' },
                        { id: 'text', icon: <MessageSquare size={15} />, label: 'Text' },
                        { id: 'auto', icon: <FlaskConical size={15} />, label: 'Auto Test' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMode(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px',
                                borderRadius: 8,
                                border: mode === tab.id ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                                background: mode === tab.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                                color: mode === tab.id ? 'var(--accent-indigo)' : 'var(--text-muted)',
                                fontSize: 13,
                                fontWeight: mode === tab.id ? 600 : 400,
                                cursor: 'pointer',
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Mode Panels */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {mode === 'voice' && <VoiceMode contact={contact} />}
                    {mode === 'text' && <TextMode contact={contact} />}
                    {mode === 'auto' && <AutoTestMode contact={contact} />}
                </div>
            </div>
        </div>
    );
}

// ─── Contact Panel ────────────────────────────────────────────

function ContactPanel({ contact, onChange }) {
    return (
        <aside style={{
            width: 264,
            minWidth: 264,
            borderRight: '1px solid var(--border-subtle)',
            overflowY: 'auto',
            padding: '20px 16px',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
        }}>
            <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Test Contact</h2>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>Configure the simulated Godrej support customer</p>
            </div>

            {[
                { key: 'customer_name', label: 'Customer Name' },
                { key: 'phone_number', label: 'Phone' },
                { key: 'customer_type', label: 'Customer Type' },
                { key: 'product_category', label: 'Product Category' },
                { key: 'product_name', label: 'Product Name' },
                { key: 'model_number', label: 'Model Number' },
                { key: 'serial_number', label: 'Serial Number' },
                { key: 'purchase_date', label: 'Purchase Date' },
                { key: 'warranty_status', label: 'Warranty Status' },
                { key: 'address', label: 'Address' },
                { key: 'pincode', label: 'Pincode' },
                { key: 'issue_summary', label: 'Issue Summary' },
                { key: 'dealer_name', label: 'Support Name' },
                { key: 'dealer_address', label: 'Support Address' },
                { key: 'dealer_phone', label: 'Support Phone' },
            ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {label}
                    </span>
                    <input
                        type="text"
                        value={contact[key]}
                        onChange={e => onChange(key, e.target.value)}
                        style={{
                            padding: '5px 9px',
                            borderRadius: 6,
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-page)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            outline: 'none',
                        }}
                    />
                </label>
            ))}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Language
                </span>
                <select
                    value={contact.preferred_language}
                    onChange={e => onChange('preferred_language', e.target.value)}
                    style={{
                        padding: '5px 9px',
                        borderRadius: 6,
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-page)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        outline: 'none',
                    }}
                >
                    {['hinglish', 'hindi', 'english'].map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                </select>
            </label>

            <div style={{
                padding: '8px 10px',
                borderRadius: 7,
                background: 'rgba(99,102,241,0.05)',
                border: '1px solid rgba(99,102,241,0.12)',
                display: 'flex', gap: 7, alignItems: 'flex-start',
            }}>
                <Info size={12} style={{ color: 'var(--accent-indigo)', marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Changes apply on next session start.
                </p>
            </div>
        </aside>
    );
}

// ─── Voice Mode ───────────────────────────────────────────────

function VoiceMode({ contact }) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('idle'); // idle | starting | listening | processing | speaking
    const [session, setSession] = useState(false);
    const [error, setError] = useState(null);
    const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

    const recognitionRef = useRef(null);
    const audioRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Speak text via ElevenLabs (falls back to browser TTS)
    const speak = useCallback(async (text) => {
        setStatus('speaking');
        try {
            const blob = await speakText(text, contact.preferred_language);
            const url = URL.createObjectURL(blob);
            await new Promise((resolve) => {
                const audio = new Audio(url);
                audioRef.current = audio;
                audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(text, contact.preferred_language); resolve(); };
                audio.play().catch(() => { browserSpeak(text, contact.preferred_language); resolve(); });
            });
        } catch {
            browserSpeak(text, contact.preferred_language);
        }
        setStatus('idle');
    }, [contact.preferred_language]);

    async function startSession() {
        stopListening();
        setMessages([]);
        setError(null);
        setSession(true);
        setStatus('starting');
        try {
            const data = await testChat([], contact);
            const opening = data.message;
            setMessages([{ role: 'assistant', content: opening }]);
            await speak(opening);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            setSession(false);
            setStatus('idle');
        }
    }

    function stopListening() {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        window.speechSynthesis?.cancel();
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
            recognitionRef.current = null;
        }
    }

    function startListening() {
        if (!speechSupported || status === 'speaking' || status === 'processing') return;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognitionRef.current = recognition;
        recognition.lang = contact.preferred_language === 'english' ? 'en-IN' : 'hi-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setStatus('listening');
        recognition.onerror = (e) => {
            if (e.error !== 'aborted') setError(`Speech recognition error: ${e.error}`);
            setStatus('idle');
        };
        recognition.onend = () => {
            if (status === 'listening') setStatus('idle');
        };
        recognition.onresult = async (e) => {
            const transcript = e.results[0]?.[0]?.transcript?.trim();
            if (!transcript) return;
            setStatus('processing');
            const userMsg = { role: 'user', content: transcript };
            const updatedMsgs = [...messages, userMsg];
            setMessages(prev => [...prev, userMsg]);
            try {
                const data = await testChat(updatedMsgs, contact);
                const reply = data.message;
                setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
                await speak(reply);
            } catch (err) {
                setError(err.response?.data?.error || err.message);
                setStatus('idle');
            }
        };
        recognition.start();
    }

    function resetSession() {
        stopListening();
        setMessages([]);
        setSession(false);
        setStatus('idle');
        setError(null);
    }

    const STATUS_META = {
        idle: { color: 'var(--text-muted)', label: session ? 'Tap mic to speak' : 'Start a session first' },
        starting: { color: 'var(--accent-indigo)', label: 'Starting session...' },
        listening: { color: '#ef4444', label: 'Listening...' },
        processing: { color: 'var(--accent-indigo)', label: 'Processing...' },
        speaking: { color: '#059669', label: 'Naina is speaking...' },
    };
    const sm = STATUS_META[status] || STATUS_META.idle;
    const isActive = status === 'listening';
    const canListen = session && status === 'idle' && speechSupported;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '14px 22px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-card)', flexShrink: 0,
            }}>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Voice Test</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Speak to Naina — browser mic + ElevenLabs voice
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {session && (
                        <button onClick={resetSession} style={btnSecondary}>
                            <RefreshCw size={13} /> Reset
                        </button>
                    )}
                    <button
                        onClick={startSession}
                        disabled={status === 'starting' || status === 'speaking' || status === 'processing'}
                        style={btnPrimary(status === 'starting')}
                    >
                        {status === 'starting' ? <Loader2 size={13} style={spinStyle} /> : <Play size={13} />}
                        {session ? 'Restart' : 'Start Session'}
                    </button>
                </div>
            </div>

            {!speechSupported && (
                <div style={{ margin: '12px 22px 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 13, color: '#d97706' }}>
                    Speech recognition is not supported in this browser. Use Chrome or Edge, or switch to Text mode.
                </div>
            )}

            {/* Transcript */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!session && messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Volume2 size={24} style={{ color: 'var(--accent-indigo)' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Voice Testing</div>
                            <div style={{ fontSize: 13 }}>Click Start Session — Naina will greet you, then tap the mic to respond</div>
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                {(status === 'processing' || status === 'speaking') && <TypingDots role="assistant" />}
                {error && <ErrorBanner error={error} />}
                <div ref={bottomRef} />
            </div>

            {/* Mic Button */}
            <div style={{
                padding: '20px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0,
            }}>
                <button
                    onMouseDown={startListening}
                    onMouseUp={() => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ignore */ } } }}
                    onTouchStart={startListening}
                    onTouchEnd={() => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ignore */ } } }}
                    disabled={!canListen && !isActive}
                    title={canListen ? 'Hold to speak' : sm.label}
                    style={{
                        width: 68, height: 68, borderRadius: '50%', border: 'none',
                        background: isActive ? '#ef4444' : (canListen ? 'var(--accent-indigo)' : 'var(--border-subtle)'),
                        color: canListen || isActive ? '#fff' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: canListen || isActive ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s',
                        boxShadow: isActive ? '0 0 0 8px rgba(239,68,68,0.15)' : (canListen ? '0 4px 14px rgba(99,102,241,0.3)' : 'none'),
                    }}
                >
                    {isActive ? <MicOff size={26} /> : <Mic size={26} />}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sm.color, ...(isActive || status === 'speaking' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}) }} />
                    <span style={{ fontSize: 12, color: sm.color, fontWeight: 500 }}>{sm.label}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Text Mode ────────────────────────────────────────────────

function TextMode({ contact }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState(false);
    const [error, setError] = useState(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    async function startSession() {
        setMessages([]);
        setError(null);
        setSession(true);
        setLoading(true);
        try {
            const data = await testChat([], contact);
            setMessages([{ role: 'assistant', content: data.message }]);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            setSession(false);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }

    async function sendMessage(e) {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;
        const newMsgs = [...messages, { role: 'user', content: text }];
        setMessages(newMsgs);
        setInput('');
        setLoading(true);
        setError(null);
        try {
            const data = await testChat(newMsgs, contact);
            setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Text Test</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Chat with Naina as a customer</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {session && <button onClick={() => { setMessages([]); setSession(false); setError(null); }} style={btnSecondary}><RefreshCw size={13} /> Reset</button>}
                    <button onClick={startSession} disabled={loading} style={btnPrimary(loading)}>
                        {loading && !session ? <Loader2 size={13} style={spinStyle} /> : null}
                        {session ? 'Restart' : 'Start Session'}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!session && messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bot size={24} style={{ color: 'var(--accent-indigo)' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Text Testing</div>
                            <div style={{ fontSize: 13 }}>Click Start Session — then type as the customer</div>
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                {loading && messages.length > 0 && <TypingDots role="assistant" />}
                {error && <ErrorBanner error={error} />}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)', display: 'flex', gap: 10, flexShrink: 0 }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={session ? 'Type as the customer...' : 'Start a session first'}
                    disabled={!session || loading}
                    style={{ flex: 1, padding: '9px 13px', borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', opacity: !session ? 0.5 : 1 }}
                />
                <button type="submit" disabled={!session || loading || !input.trim()} style={{ ...btnPrimary(!session || loading || !input.trim()), width: 40, height: 40, padding: 0, borderRadius: 9 }}>
                    {loading ? <Loader2 size={15} style={spinStyle} /> : <Send size={15} />}
                </button>
            </form>
        </div>
    );
}

// ─── Auto Test Mode ───────────────────────────────────────────

function AutoTestMode({ contact }) {
    const [persona, setPersona] = useState('cooperative');
    const [maxTurns, setMaxTurns] = useState(15);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [transcriptOpen, setTranscriptOpen] = useState(false);

    async function runTest() {
        setRunning(true);
        setResult(null);
        setError(null);
        try {
            const data = await runAutoTest(contact, maxTurns, persona);
            setResult(data);
            setTranscriptOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setRunning(false);
        }
    }

    function downloadReport() {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-qa-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Config */}
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Auto Test</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            AI customer converses with Naina — QA report generated automatically
                        </p>
                    </div>
                    {result && (
                        <button onClick={downloadReport} style={{ ...btnSecondary, gap: 5 }}>
                            <Download size={13} /> Download Report
                        </button>
                    )}
                </div>

                {/* Persona Selection */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Customer Persona
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {PERSONAS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPersona(p.id)}
                                title={p.desc}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 7,
                                    border: persona === p.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-default)',
                                    background: persona === p.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                                    color: persona === p.id ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                                    fontSize: 12,
                                    fontWeight: persona === p.id ? 600 : 400,
                                    cursor: 'pointer',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                        {PERSONAS.find(p => p.id === persona)?.desc}
                    </div>
                </div>

                {/* Turns + Run */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Max turns:
                        <select
                            value={maxTurns}
                            onChange={e => setMaxTurns(Number(e.target.value))}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: 13 }}
                        >
                            {[10, 15, 20].map(n => <option key={n} value={n}>{n} turns</option>)}
                        </select>
                    </label>
                    <button
                        onClick={runTest}
                        disabled={running}
                        style={btnPrimary(running)}
                    >
                        {running
                            ? <><Loader2 size={13} style={spinStyle} /> Running test... (~1-2 min)</>
                            : <><Play size={13} /> Run Auto Test</>
                        }
                    </button>
                </div>

                {running && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', fontSize: 13, color: 'var(--accent-indigo)' }}>
                        Running simulated conversation between AI customer and Naina, then generating QA report... This may take 1-2 minutes.
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div style={{ margin: '16px 22px' }}>
                    <ErrorBanner error={error} />
                </div>
            )}

            {/* Results */}
            {result && (
                <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Overall Score */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                        <div style={{ width: 120, flexShrink: 0, padding: '16px 12px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor(result.report?.overall_score), lineHeight: 1 }}>
                                {result.report?.overall_score?.toFixed(1) ?? '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Overall Score / 10</div>
                        </div>
                        <div style={{ flex: 1, padding: '16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</div>
                            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                {result.report?.summary || 'No summary available.'}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                {result.meta?.turns} turns · persona: {result.meta?.persona} · {result.meta?.language}
                            </div>
                        </div>
                    </div>

                    {/* Criteria Grid */}
                    {result.report?.criteria && (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                Evaluation Criteria
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                                {Object.entries(result.report.criteria).map(([key, val]) => {
                                    const sc = STATUS_COLORS[val?.status] || STATUS_COLORS.PARTIAL;
                                    return (
                                        <div key={key} style={{ padding: '12px 14px', borderRadius: 10, background: sc.bg, border: `1px solid ${sc.border}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {CRITERIA_LABELS[key] || key}
                                                </span>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: sc.text }}>{val?.status}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: sc.text }}>{val?.score}/10</span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                                                {val?.observation}
                                            </div>
                                            {val?.suggestion && val.suggestion !== '...' && (
                                                <div style={{ fontSize: 11, color: sc.text, fontStyle: 'italic', lineHeight: 1.4 }}>
                                                    → {val.suggestion}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Gaps & Strengths */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {result.report?.gaps?.length > 0 && (
                            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Gaps to Fix
                                </div>
                                {result.report.gaps.map((gap, i) => (
                                    <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                                        <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                        {gap}
                                    </div>
                                ))}
                            </div>
                        )}
                        {result.report?.strengths?.length > 0 && (
                            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Strengths
                                </div>
                                {result.report.strengths.map((s, i) => (
                                    <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                                        <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>✓</span>
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Transcript */}
                    <div style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <button
                            onClick={() => setTranscriptOpen(o => !o)}
                            style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}
                        >
                            Full Conversation Transcript ({result.conversation?.length} messages)
                            {transcriptOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        {transcriptOpen && (
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-page)', maxHeight: 400, overflowY: 'auto' }}>
                                {result.conversation?.map((msg, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, minWidth: 80, color: msg.role === 'naina' ? 'var(--accent-indigo)' : '#d97706' }}>
                                            {msg.role === 'naina' ? 'Naina:' : `${result.meta?.contact_name || 'Customer'}:`}
                                        </span>
                                        <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.content}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Shared Sub-components ────────────────────────────────────

function ChatBubble({ msg }) {
    const isAgent = msg.role === 'assistant';
    return (
        <div style={{ display: 'flex', gap: 8, flexDirection: isAgent ? 'row' : 'row-reverse', alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: isAgent ? 'rgba(99,102,241,0.1)' : 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isAgent ? <Bot size={13} style={{ color: 'var(--accent-indigo)' }} /> : <User size={13} style={{ color: 'var(--accent-emerald)' }} />}
            </div>
            <div style={{ maxWidth: '72%', padding: '9px 13px', borderRadius: isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: isAgent ? 'var(--bg-card)' : 'var(--accent-indigo)', color: isAgent ? 'var(--text-primary)' : '#fff', fontSize: 13, lineHeight: 1.6, border: isAgent ? '1px solid var(--border-subtle)' : 'none', whiteSpace: 'pre-wrap' }}>
                {msg.content}
            </div>
        </div>
    );
}

function TypingDots() {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} style={{ color: 'var(--accent-indigo)' }} />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                ))}
            </div>
        </div>
    );
}

function ErrorBanner({ error }) {
    return (
        <div style={{ padding: '9px 13px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13 }}>
            {error}
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────

function browserSpeak(text, language) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === 'english' ? 'en-IN' : 'hi-IN';
    window.speechSynthesis?.speak(u);
}

function scoreColor(score) {
    if (!score) return 'var(--text-muted)';
    if (score >= 8) return '#059669';
    if (score >= 6) return '#d97706';
    return '#ef4444';
}

// Style helpers
const btnPrimary = (disabled) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px',
    borderRadius: 8, border: 'none',
    background: disabled ? 'var(--border-subtle)' : 'var(--accent-indigo)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
});

const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px',
    borderRadius: 8, border: '1px solid var(--border-default)',
    background: 'transparent', color: 'var(--text-secondary)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

const spinStyle = { animation: 'spin 1s linear infinite' };

// CSS animations injected once
if (!document.getElementById('tester-anims')) {
    const style = document.createElement('style');
    style.id = 'tester-anims';
    style.textContent = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } }
    `;
    document.head.appendChild(style);
}

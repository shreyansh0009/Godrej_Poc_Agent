import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    PlusCircle,
    List,
    Settings,
    Activity,
    Phone,
    FlaskConical,
} from 'lucide-react';

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">🏠</div>
                <div>
                    <h1>CRM AI Voice Agent</h1>
                    <span>Godrej Appliances</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">Main</div>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                    <LayoutDashboard size={16} />
                    Dashboard
                </NavLink>
                <NavLink to="/campaigns/new" className={({ isActive }) => isActive ? 'active' : ''}>
                    <PlusCircle size={16} />
                    New Campaign
                </NavLink>
                <NavLink to="/campaigns" className={({ isActive }) => isActive ? 'active' : ''}>
                    <List size={16} />
                    All Campaigns
                </NavLink>

                <div className="sidebar-section-label">Configuration</div>
                <NavLink to="/agents" className={({ isActive }) => isActive ? 'active' : ''}>
                    <Settings size={16} />
                    Agent Config
                </NavLink>
                <NavLink to="/test" className={({ isActive }) => isActive ? 'active' : ''}>
                    <FlaskConical size={16} />
                    Test Agent
                </NavLink>

                <div style={{ flex: 1 }} />

                <div className="sidebar-section-label">System</div>
                <NavLink to="/health" className={({ isActive }) => isActive ? 'active' : ''}>
                    <Activity size={16} />
                    System Health
                </NavLink>
            </nav>

            <div style={{
                padding: '14px 16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-indigo)',
                    flexShrink: 0,
                }}>
                    <Phone size={14} />
                </div>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>CRM Landing</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Voice Platform</div>
                </div>
                <div style={{
                    marginLeft: 'auto',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--accent-emerald)',
                    boxShadow: '0 0 0 2px rgba(5,150,105,0.2)',
                }} />
            </div>
        </aside>
    );
}

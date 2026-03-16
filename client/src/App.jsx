import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CreateCampaign from './pages/CreateCampaign';
import CampaignList from './pages/CampaignList';
import CampaignMonitor from './pages/CampaignMonitor';
import TranscriptView from './pages/TranscriptView';
import AgentConfig from './pages/AgentConfig';
import SystemHealth from './pages/SystemHealth';
import AgentTester from './pages/AgentTester';

export default function App() {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/campaigns/new" element={<CreateCampaign />} />
                    <Route path="/campaigns" element={<CampaignList />} />
                    <Route path="/campaigns/:id" element={<CampaignMonitor />} />
                    <Route path="/campaigns/:campaignId/contacts/:contactId" element={<TranscriptView />} />
                    <Route path="/agents" element={<AgentConfig />} />
                    <Route path="/test" element={<AgentTester />} />
                    <Route path="/health" element={<SystemHealth />} />
                </Routes>
            </main>
        </div>
    );
}

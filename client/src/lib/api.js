import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
});

// ─── Stats ───────────────────────────────────────────────
export const getStats = () => api.get('/stats').then(r => r.data);

// ─── Campaigns ───────────────────────────────────────────
export const getCampaigns = () => api.get('/campaigns').then(r => r.data);
export const getCampaign = (id) => api.get(`/campaigns/${id}`).then(r => r.data);
export const getCampaignContacts = (id) => api.get(`/campaigns/${id}/contacts`).then(r => r.data);

export const createCampaign = (formData) =>
    api.post('/campaigns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);

export const startCampaign = (id) => api.post(`/campaigns/${id}/start`).then(r => r.data);
export const stopCampaign = (id) => api.post(`/campaigns/${id}/stop`).then(r => r.data);
export const exportCampaignResults = (id) =>
    api.get(`/campaigns/${id}/export`, { responseType: 'blob' }).then(r => r.data);

// ─── DNC ─────────────────────────────────────────────────
export const getDNCList = () => api.get('/dnc').then(r => r.data);
export const addToDNC = (phone_number, reason) => api.post('/dnc', { phone_number, reason }).then(r => r.data);
export const removeFromDNC = (phone) => api.delete(`/dnc/${encodeURIComponent(phone)}`).then(r => r.data);
export const bulkAddToDNC = (entries) => api.post('/dnc/bulk', entries).then(r => r.data);

// ─── Calls ───────────────────────────────────────────────
export const getCallDetails = (contactId) => api.get(`/calls/${contactId}`).then(r => r.data);
export const getCallTranscript = (contactId) => api.get(`/calls/${contactId}/transcript`).then(r => r.data);
export const stopCall = (contactId) => api.post(`/calls/${contactId}/stop`).then(r => r.data);

// ─── Agents ──────────────────────────────────────────────
export const getSquadAgents = () => api.get('/agents/squads').then(r => r.data);
export const previewPrompt = (variables) => api.post('/agents/preview-prompt', variables).then(r => r.data);

// ─── Test Agent ───────────────────────────────────────────
export const testChat = (messages, contact) => api.post('/test/chat', { messages, contact }).then(r => r.data);

// Returns audio Blob for playback
export const speakText = (text, language) =>
    api.post('/test/speak', { text, language }, { responseType: 'blob' }).then(r => r.data);

// Auto-run: returns { conversation, report, meta } — can take up to 2-3 minutes
export const runAutoTest = (contact, maxTurns, persona) =>
    api.post('/test/auto-run', { contact, maxTurns, persona }, { timeout: 180000 }).then(r => r.data);

// ─── Health ──────────────────────────────────────────────
export const getHealth = () => api.get('/health').then(r => r.data);

export default api;

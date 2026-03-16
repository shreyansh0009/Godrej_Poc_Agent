/**
 * Bolna — inspect existing agents and test make-call
 * Run: node test-bolna.js
 */
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.BOLNA_API_KEY;
const BASE_URL = process.env.BOLNA_BASE_URL || 'https://api.bolna.ai';
const MY_PHONE = process.env.BOLNA_PHONE_NUMBER;

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 30000,
});

async function call(method, path, data) {
    try {
        const res = await api({ method, url: path, data });
        return { ok: true, status: res.status, data: res.data };
    } catch (err) {
        return { ok: false, status: err.response?.status, data: err.response?.data };
    }
}

(async () => {
    console.log('='.repeat(60));
    console.log('BOLNA AGENT INSPECTOR');
    console.log('='.repeat(60));

    // ── List all v1 agents ─────────────────────────────────────
    console.log('\n1. Fetching all existing agents...');
    const list = await call('GET', '/agent/all');
    if (!list.ok) {
        console.log('❌ Failed:', list.data);
        return;
    }
    const agents = list.data;
    console.log(`   Found ${agents.length} agents\n`);

    // Print summary of each agent
    agents.forEach((a, i) => {
        console.log(`   [${i}] ID: ${a.id}`);
        console.log(`       Name: ${a.agent_name}`);
        console.log(`       Status: ${a.agent_status}`);
        console.log(`       Welcome: ${(a.agent_welcome_message || '').slice(0, 60)}`);
        console.log();
    });

    // ── Fetch full config of first agent ──────────────────────
    if (agents.length > 0) {
        const firstId = agents[0].id;
        console.log(`2. Fetching full config of agent[0]: ${firstId}`);
        const detail = await call('GET', `/agent/${firstId}`);
        if (detail.ok) {
            console.log('   Full config:');
            console.log(JSON.stringify(detail.data, null, 2));
        } else {
            console.log('   ❌ Failed:', detail.data);
        }
    }

    // ── List registered phone numbers in Bolna ────────────────
    console.log('\n3. Fetching registered phone numbers in Bolna...');
    const phones = await call('GET', '/phone_numbers');
    if (phones.ok) {
        const nums = Array.isArray(phones.data) ? phones.data : [phones.data];
        if (nums.length === 0) {
            console.log('   ⚠️  No phone numbers registered in Bolna.');
            console.log('   Go to Bolna dashboard → Telephony → connect your Twilio number.');
        } else {
            nums.forEach((p, i) => {
                console.log(`   [${i}] Number: ${p.phone_number || p.number || JSON.stringify(p)}`);
                if (p.telephony_provider) console.log(`       Provider: ${p.telephony_provider}`);
                if (p.id) console.log(`       ID: ${p.id}`);
            });
        }
    } else {
        console.log(`   ⚠️  Status ${phones.status}:`, phones.data);
    }

    // ── Try making a call using first registered number ────────
    const registeredNums = phones.ok && Array.isArray(phones.data) ? phones.data : [];
    const fromNumber = registeredNums[0]?.phone_number || registeredNums[0]?.number || MY_PHONE;

    if (agents.length > 0 && MY_PHONE) {
        const testAgentId = agents[0].id;
        console.log(`\n4. Testing makeCall`);
        console.log(`   Agent: ${testAgentId}`);
        console.log(`   To (recipient): ${MY_PHONE}`);
        console.log(`   From (Bolna registered): ${fromNumber}`);
        const callResult = await call('POST', '/call', {
            agent_id: testAgentId,
            recipient_phone_number: MY_PHONE,
            from_phone_number: fromNumber,
        });
        if (callResult.ok) {
            console.log('   ✅ Call initiated:', JSON.stringify(callResult.data));
        } else {
            console.log(`   ❌ Call failed (${callResult.status}):`, JSON.stringify(callResult.data));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('- If step 3 shows no numbers: register your Twilio number in');
    console.log('  Bolna dashboard → Telephony, then set BOLNA_PHONE_NUMBER in .env');
    console.log('  to the exact number as it appears in Bolna (e.g. +918035316594)');
    console.log('- If step 4 call succeeds: your setup is working!');
    console.log('='.repeat(60));
})();

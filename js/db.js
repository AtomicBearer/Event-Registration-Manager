/* AC-STEM 9.0 production, staff-authenticated Edge Function adapter.
   No demo records, service_role, secret key, or direct table access. */
(function () {
  'use strict';
  const C = window.APP_CONFIG;
  const EID = C.OFFICIAL_EVENT_ID;
  const BASE = C.SUPABASE_URL;
  const PUB = C.SUPABASE_ANON_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(BASE) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(PUB) ||
      !/^[a-f0-9-]{36}$/i.test(EID) ||
      !window.supabase?.createClient) {
    throw new Error('AC-STEM production configuration missing. No sample data will be shown.');
  }
  // Use only public publishable credentials in the browser.
  const sb = window.supabase.createClient(BASE, PUB, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const STORAGE = 'acstem_staff_session_v1';
  let session;
  try { session = sessionStorage.getItem(STORAGE) || null; } catch (_) { session = null; }
  const blocked = () => { throw new Error('Disabled in official Form-only mode; register via the Google Form.'); };
  function requireEvent(eventId) {
    if (eventId !== EID) throw new Error('Only AC-STEM 9.0 is available at this desk');
  }
  async function call(action, params = {}) {
    if (action !== 'login' && !session) throw new Error('Please sign in again');
    const { data, error } = await sb.functions.invoke('event-desk', {
      body: { action, params },
      headers: action === 'login' ? {} : { 'x-desk-session': session }
    });
    if (error) {
      let message = 'Unable to contact the event desk';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const details = await error.context.json();
          if (typeof details?.error === 'string') message = details.error;
        } catch (_) { /* ignore */ }
      }
      if (message === 'Unable to contact the event desk') message = error.message || message;
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || 'Invalid event desk response');
    return data.data;
  }
  async function listOfficial() {
    const events = await call('listEvents');
    const official = Array.isArray(events) ? events.find(e => e.id === EID && e.name === C.OFFICIAL_EVENT_NAME) : null;
    if (!official) throw new Error('Official AC-STEM event is unavailable to this staff account');
    return [official];
  }
  const DB = {
    mode: 'supabase',
    async authenticate(name, passcode) {
      const result = await call('login', { name, passcode });
      if (!result?.session || !result?.staff) throw new Error('No staff session was issued');
      session = result.session;
      try { sessionStorage.setItem(STORAGE, session); } catch (_) { /* memory session only */ }
      return result.staff;
    },
    async restoreSession() {
      if (!session) return null;
      try { return await call('whoami'); }
      catch (_) {
        session = null;
        try { sessionStorage.removeItem(STORAGE); } catch (_) {}
        return null;
      }
    },
    async signOut() {
      session = null;
      try { sessionStorage.removeItem(STORAGE); } catch (_) {}
    },
    listEvents: listOfficial,
    async eventStats() {
      const all = await call('eventStats');
      return { [EID]: all?.[EID] || { registered: 0, attended: 0 } };
    },
    async listRegistrations(eventId) {
      requireEvent(eventId);
      const rows = await call('listRegistrations', { eventId: EID });
      if (!Array.isArray(rows)) throw new Error('Invalid registration list');
      return rows.filter(r => r.eventId === EID);
    },
    async getRegistration(id) {
      const rows = await DB.listRegistrations(EID);
      return rows.find(r => r.id === id) || null;
    },
    async previewScan(value, opts = {}) {
      requireEvent(opts.eventId);
      if (!/^[a-fA-F0-9]{64}$/.test(String(value || '')))
        throw new Error('Expected an original QR token');
      return call('previewScan', { eventId: EID, token: value });
    },
    async checkIn(value, opts = {}) {
      requireEvent(opts.eventId);
      if (opts.method === 'manual') {
        if (!/^EVT-[A-F0-9]{12}$/.test(String(value || '')))
          throw new Error('Choose one registration from search before manual check-in');
        if (typeof opts.reason !== 'string' || !opts.reason.trim())
          throw new Error('Manual check-in reason required');
        return call('manualCheckIn', {
          eventId: EID, registrationId: value, reason: opts.reason, note: opts.note || ''
        });
      }
      if (opts.method !== 'qr' || !/^[a-fA-F0-9]{64}$/.test(String(value || '')))
        throw new Error('Expected an original QR token');
      if (!['None', 'One parent', 'Both parents'].includes(opts.eventDayParentAttendance))
        throw new Error('Confirm parent attendance before QR check-in');
      return call('checkIn', { eventId: EID, token: value, eventDayParentAttendance: opts.eventDayParentAttendance });
    },
    async bulkCheckIn(ids, opts) {
      if (!Array.isArray(ids) || ids.length !== 1)
        throw new Error('For safety, verify and check in ONE student at a time.');
      const result = await DB.checkIn(ids[0], opts);
      if (result.status === 'ok') return { ok: 1, skipped: 0 };
      if (result.status === 'duplicate') return { ok: 0, skipped: 1 };
      throw new Error('Manual check-in not completed: ' + result.status);
    },
    async undoCheckIn(id) {
      if (!/^EVT-[A-F0-9]{12}$/.test(String(id || ''))) throw new Error('Invalid registration');
      return call('undoCheckIn', { eventId: EID, registrationId: id });
    },
    // Phase 4: portfolio data is separate from the official live-event adapter.
    // Never broaden listEvents, scanner IDs, or registration data to other events.
    async listPortfolioEvents() {
      const data = await call('listEvents');
      if (!Array.isArray(data)) throw new Error('Invalid event portfolio response');
      return data;
    },
    async portfolioStats() { return await call('eventStats'); },
    async listEventBranding() {
      const data = await call('eventBrandingList');
      if (!Array.isArray(data)) throw new Error('Invalid branding response');
      return data;
    },
    async saveEventBranding(eventId, brand) {
      return call('saveEventBranding', { eventId, brand });
    },
    async createEvent(data) { return call('createEvent', { data }); },
    async updateEvent(id, data) {
      if (id === EID) throw new Error('Official AC-STEM event settings are locked to protect live registrations.');
      return call('updateEvent', { id, data });
    },
    async deleteEvent(id) {
      if (id === EID) throw new Error('Official AC-STEM cannot be deleted');
      return call('deleteEvent', { id });
    },
    async addRegistration(eventId, data, opts = {}) {
      requireEvent(eventId);
      if (!data || typeof data.fullName !== 'string' || typeof data.email !== 'string')
        throw new Error('Walk-in name and email are required');
      return call('addRegistration', {
        eventId: EID,
        data,
        markPresent: !!opts.markPresent
      });
    },
    deleteRegistration: blocked, resetDemo: blocked,
    async scannerHeartbeat(eventId, input) {
      requireEvent(eventId);
      return call('scannerHeartbeat', { eventId: EID, clientId: input.clientId,
        label: input.label, state: input.state, sessionScans: input.sessionScans });
    },
    async scannerFleet(eventId) {
      requireEvent(eventId);
      const data = await call('scannerFleet', { eventId: EID });
      if (!Array.isArray(data)) throw new Error('Unexpected scanner fleet response');
      return data;
    },
    subscribe() { return () => {}; }
  };
  window.DB = DB;
})();

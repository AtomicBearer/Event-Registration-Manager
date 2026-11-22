/* ==========================================================================
   TCET Event Desk — configuration
   Set the public Supabase URL and publishable/anon key here.
   Live name/passcode verification, QR checks and attendance run in the event-desk Edge Function.
   NEVER put a Supabase service-role/secret key in this browser file.
   ========================================================================== */
window.APP_CONFIG = {
  // ONLY the official Form event. This UUID is an event ID, not a secret.
  OFFICIAL_EVENT_ID: "33238a0f-4e1d-446a-92e7-ff1b8d265e95",
  OFFICIAL_EVENT_NAME: "AC-STEM 9.0",

  /* --- 1. PUBLIC Supabase project connection -----------------------------
     The publishable key is safe for a browser; it grants NO student access.
     All student data and attendance require an authenticated staff session
     via the production event-desk Edge Function. NEVER add sb_secret_ here. */
  SUPABASE_URL: "https://mrwrqcezfvhclymceyut.supabase.co",            // e.g. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_fKArN8VQW77D2tpmV-u-Rw_FvlwZ1B3",  // the public "anon" key

  /* --- 2. Demo-only compatibility maps -----------------------------------
     These original mappings are used by the bundled demo adapter only.
     Live registrations are mapped server-side in event-desk/index.ts.      */
  TABLES: {
    events: "events",
    registrations: "registrations",
    eventStats: "event_stats"        // view defined in supabase/schema.sql
  },

  /* --- 3. Column mapping --------------------------------------------------
     left  = name used inside the dashboard (do not change)
     right = original demo's column name (NOT your live database schema)    */
  COLUMNS: {
    id: "id",                       // the registration ID that is encoded in the QR code
    eventId: "event_id",
    fullName: "full_name",
    email: "email",
    rollNo: "roll_no",
    phone: "phone",
    department: "department",
    year: "year",
    division: "division",
    registeredAt: "registered_at",
    attended: "attended",
    attendedAt: "attended_at",
    checkInMethod: "check_in_method",   // 'qr' | 'manual'
    checkedInBy: "checked_in_by",
    manualReason: "manual_reason",
    notes: "notes"
  },
  EVENT_COLUMNS: {
    id: "id",
    name: "name",
    description: "description",
    venue: "venue",
    eventDate: "event_date",
    capacity: "capacity",
    status: "status",               // 'draft' | 'active' | 'closed'
    createdAt: "created_at"
  },

  /* --- 4. Demo-only passcode ----------------------------------------------
     This browser-side hash is only for sample/demo mode (tcet2026).
     Live passcodes are checked server-side via Edge Function Secrets.
     To change only the demo passcode hash, run in a browser console:
       crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW-PASSCODE'))
         .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
     IMPORTANT: this gate runs in the browser. It keeps casual visitors out
     but is not real security — see README.md → "Securing the data".        */
  PASSCODE_SHA256: "0342ae6863537a8e66f0fd8c44ce57a6eb3338b5420d2584f666e0156620ede5",

  /* --- 5. Branding --------------------------------------------------------
     Drop the official logo at assets/tcet-logo.png (square or wide PNG/SVG,
     transparent background works best). Until then a placeholder is shown. */
  ORG: {
    name: "Thakur College of Engineering and Technology",
    short: "TCET",
    place: "Kandivali (E), Mumbai",
    logo: "assets/tcet-logo.png",
    logoFallback: "assets/tcet-logo-placeholder.svg"
  },

  /* --- 6. Behaviour ------------------------------------------------------- */
  POLL_SECONDS: 10,                 // polling across many scanners; own scans update immediately
  DEPARTMENTS: ["CSE","CSE IoT","IT", "AI & DS","AI & ML","E&CS", "E&TC","MME","CSE - CYBER SECURITY", "Mechanical", "Civil", "Other"],
  YEARS: ["9th", "10th", "11th", "12th", "Other"],
  MANUAL_REASONS: [
    "QR code not scanning",
    "Student lost the email / no QR",
    "Phone battery dead",
    "Network or scanner problem",
    "Registered but ID not found",
    "Other"
  ]
};

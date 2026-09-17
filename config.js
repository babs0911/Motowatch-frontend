// MotoWatch Hybrid Cloud Frontend Configuration
const Config = {
    // 1. Supabase Cloud Connection (24/7 Always-On for Data, Auth, Violations, Reports)
    SUPABASE_URL: 'https://hbajztvdafangjifwwht.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiYWp6dHZkYWZhbmdqaWZ3d2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjQzMjUsImV4cCI6MjEwMzE0MDMyNX0.YVscNdcoIfbJcR4ORZPpBUtkVho8P_7RLoD0q1eXgN0',

    // 2. Local AI Worker / Cloudflare Tunnel (Used strictly on Live Stream, OCR Test, and Manual AI Upload)
    getAiWorkerUrl() {
        let url = localStorage.getItem('motowatch_ai_worker_url') || localStorage.getItem('motowatch_backend_url');
        if (!url) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                url = 'http://localhost:5000';
            } else {
                url = ''; // Clean default: no intrusive popups on regular pages
            }
        }
        return url;
    },

    setAiWorkerUrl(url) {
        if (url) {
            url = url.trim().replace(/\/$/, '');
            localStorage.setItem('motowatch_ai_worker_url', url);
            localStorage.setItem('motowatch_backend_url', url);
        }
    },

    // Backward-compatibility aliases
    getBackendUrl() {
        return this.getAiWorkerUrl();
    },

    setBackendUrl(url) {
        this.setAiWorkerUrl(url);
    },

    resetBackendUrl() {
        localStorage.removeItem('motowatch_ai_worker_url');
        localStorage.removeItem('motowatch_backend_url');
        window.location.reload();
    },

    // Helper: Initialize Supabase client if SDK is loaded
    getSupabase() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            if (!window._supabaseClientInstance) {
                window._supabaseClientInstance = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            }
            return window._supabaseClientInstance;
        }
        return null;
    }
};

// Global shorthand for API tunnel
window.backendUrl = Config.getAiWorkerUrl();

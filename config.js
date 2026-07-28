// MotoWatch Decoupled Frontend Configuration
const Config = {
    getBackendUrl() {
        let url = localStorage.getItem('motowatch_backend_url');
        if (!url) {
            // If running locally, default to localhost:5000, otherwise prompt the user
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                url = 'http://localhost:5000';
            } else {
                url = prompt('Please enter your Cloudflare Tunnel Backend URL (e.g., https://your-subdomain.trycloudflare.com):', '');
            }
            if (url) {
                url = url.trim().replace(/\/$/, '');
                localStorage.setItem('motowatch_backend_url', url);
            } else {
                url = 'http://localhost:5000';
            }
        }
        return url;
    },
    
    setBackendUrl(url) {
        if (url) {
            url = url.trim().replace(/\/$/, '');
            localStorage.setItem('motowatch_backend_url', url);
        }
    },
    
    resetBackendUrl() {
        localStorage.removeItem('motowatch_backend_url');
        window.location.reload();
    }
};

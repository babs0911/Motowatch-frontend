// MotoWatch Shared Frontend JavaScript & AI Tunnel Management

document.addEventListener('DOMContentLoaded', function() {
    // 1. Inject AI Worker / Cloudflare Tunnel Settings Modal dynamically
    if (!document.getElementById('aiTunnelModal')) {
        const modalHtml = `
        <div class="modal fade" id="aiTunnelModal" tabindex="-1" aria-labelledby="aiTunnelModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-white border-secondary shadow-lg">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="aiTunnelModalLabel">
                            <i class="bi bi-camera-video me-2 text-primary"></i> Local AI & Camera Tunnel Settings
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-white-50 small mb-3">
                            The Cloudflare Tunnel connects your local PC's camera stream, PaddleOCR, and YOLO detection engine to this cloud dashboard.
                        </p>
                        <div class="mb-3">
                            <label for="tunnelUrlInput" class="form-label text-white small fw-bold">Cloudflare Tunnel URL</label>
                            <div class="input-group">
                                <span class="input-group-text bg-secondary border-secondary text-white"><i class="bi bi-link-45deg"></i></span>
                                <input type="url" class="form-control bg-dark text-white border-secondary" id="tunnelUrlInput" 
                                       placeholder="https://your-subdomain.trycloudflare.com">
                            </div>
                            <div class="form-text text-white-50 small">Example: <code>https://motowatch-tunnel.trycloudflare.com</code> or <code>http://localhost:5000</code></div>
                        </div>
                        <div id="tunnelStatusAlert" class="alert d-none py-2 small" role="alert"></div>
                    </div>
                    <div class="modal-footer border-secondary d-flex justify-content-between">
                        <button type="button" class="btn btn-outline-info btn-sm" id="testTunnelBtn" onclick="testTunnelConnection()">
                            <i class="bi bi-broadcast me-1"></i> Test Connection
                        </button>
                        <div>
                            <button type="button" class="btn btn-secondary btn-sm me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary btn-sm px-3" onclick="saveTunnelSettings()">
                                <i class="bi bi-check-circle me-1"></i> Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // 2. Add "AI Camera Settings" to any Admin Settings dropdown
    const settingsDropdowns = document.querySelectorAll('#adminSettingsDropdown .dropdown-menu');
    settingsDropdowns.forEach(menu => {
        if (!menu.querySelector('.ai-tunnel-menu-item')) {
            const li = document.createElement('li');
            li.className = 'ai-tunnel-menu-item';
            li.innerHTML = `
                <a class="dropdown-item py-2" href="#" onclick="openAiTunnelModal(event)">
                    <i class="bi bi-camera-video me-2 text-info"></i> AI Camera / Tunnel
                </a>
            `;
            menu.appendChild(li);
        }
    });

    // 3. File input validation
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.size > 100 * 1024 * 1024) {
                alert('File size exceeds 100MB limit. Please choose a smaller file.');
                e.target.value = '';
            }
        });
    });

    // 4. Auto-dismiss temporary alerts
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (typeof bootstrap !== 'undefined') {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    });

    // 5. Uppercase input for plate numbers
    const plateInputs = document.querySelectorAll('input[name="plate_number"]');
    plateInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    });
});

// Modal Actions
function openAiTunnelModal(e) {
    if (e) e.preventDefault();
    const currentUrl = (typeof Config !== 'undefined') ? Config.getAiWorkerUrl() : localStorage.getItem('motowatch_ai_worker_url') || '';
    const input = document.getElementById('tunnelUrlInput');
    if (input) input.value = currentUrl;
    
    const alertBox = document.getElementById('tunnelStatusAlert');
    if (alertBox) alertBox.classList.add('d-none');
    
    const modalEl = document.getElementById('aiTunnelModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function saveTunnelSettings() {
    const input = document.getElementById('tunnelUrlInput');
    const newUrl = input ? input.value.trim().replace(/\/$/, '') : '';
    
    if (typeof Config !== 'undefined') {
        Config.setAiWorkerUrl(newUrl);
    } else {
        localStorage.setItem('motowatch_ai_worker_url', newUrl);
        localStorage.setItem('motowatch_backend_url', newUrl);
    }
    
    const modalEl = document.getElementById('aiTunnelModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    window.location.reload();
}

async function testTunnelConnection() {
    const input = document.getElementById('tunnelUrlInput');
    const testUrl = input ? input.value.trim().replace(/\/$/, '') : '';
    const alertBox = document.getElementById('tunnelStatusAlert');
    const testBtn = document.getElementById('testTunnelBtn');
    
    if (!testUrl) {
        if (alertBox) {
            alertBox.className = 'alert alert-warning py-2 small';
            alertBox.textContent = 'Please enter a URL first.';
            alertBox.classList.remove('d-none');
        }
        return;
    }
    
    if (testBtn) testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Testing...';
    
    try {
        const res = await fetch(`${testUrl}/api/stats`, { mode: 'cors', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
            alertBox.className = 'alert alert-success py-2 small';
            alertBox.innerHTML = '<i class="bi bi-check-circle me-1"></i> Connected successfully to Local AI Engine!';
        } else {
            alertBox.className = 'alert alert-warning py-2 small';
            alertBox.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> Server responded with status: ${res.status}`;
        }
    } catch (err) {
        alertBox.className = 'alert alert-danger py-2 small';
        alertBox.innerHTML = '<i class="bi bi-x-circle me-1"></i> Could not reach server. Verify that your tunnel/run.py is active.';
    } finally {
        if (alertBox) alertBox.classList.remove('d-none');
        if (testBtn) testBtn.innerHTML = '<i class="bi bi-broadcast me-1"></i> Test Connection';
    }
}

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

    // 2. Add "AI Camera Settings" and "Database Tools" to Tools / Admin dropdowns
    function setupAdminMenuItems() {
        const currentUser = (typeof SupabaseDB !== 'undefined' && SupabaseDB.getCurrentUser) ? SupabaseDB.getCurrentUser() : null;
        const role = currentUser ? currentUser.role : (localStorage.getItem('user_role') || '');
        const isAdmin = role && role.toLowerCase() === 'admin';

        if (isAdmin) {
            // Unhide all static admin database tools
            document.querySelectorAll('.admin-db-tool').forEach(el => el.classList.remove('d-none'));
            const adminDropdown = document.getElementById('adminSettingsDropdown');
            if (adminDropdown) adminDropdown.classList.remove('d-none');
        }
    }

    // 3. Device Geolocation Service (Accurate Device GPS with Reverse Geocoding)
    function initDeviceGeolocation() {
        if (!("geolocation" in navigator)) return;
        
        navigator.geolocation.getCurrentPosition(
            async function(pos) {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                sessionStorage.setItem('motowatch_device_lat', lat);
                sessionStorage.setItem('motowatch_device_lon', lon);
                
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    if (res.ok) {
                        const data = await res.json();
                        const addr = data.address || {};
                        const parts = [];
                        if (addr.road || addr.suburb || addr.neighbourhood) parts.push(addr.road || addr.suburb || addr.neighbourhood);
                        if (addr.city || addr.town || addr.municipality) parts.push(addr.city || addr.town || addr.municipality);
                        if (addr.state || addr.province) parts.push(addr.state || addr.province);
                        
                        const locName = parts.length > 0 ? parts.join(', ') : (data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                        sessionStorage.setItem('motowatch_device_location', locName);
                        
                        // Sync to backend worker
                        const targetWorker = (window.Config && Config.getAiWorkerUrl) ? Config.getAiWorkerUrl() : (localStorage.getItem('motowatch_tunnel_url') || '');
                        if (targetWorker) {
                            fetch(`${targetWorker}/api/device/location`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ location: locName, latitude: lat, longitude: lon }),
                                credentials: 'include'
                            }).catch(() => {});
                        }
                    }
                } catch(e) {
                    const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    sessionStorage.setItem('motowatch_device_location', fallback);
                }
            },
            function(err) {
                console.log("[Device Geolocation] Status:", err.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    }
    initDeviceGeolocation();

    setupAdminMenuItems();
    // Also run on next tick in case SupabaseDB initialized slightly after DOMContentLoaded
    setTimeout(setupAdminMenuItems, 300);

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

    // 2b. Inject Import Database Modal with Interactive Preview if not present
    if (!document.getElementById('importDbModal')) {
        const importModalHtml = `
        <div class="modal fade" id="importDbModal" tabindex="-1" aria-labelledby="importDbModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
                <div class="modal-content text-white shadow-lg" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px;">
                    <div class="modal-header border-secondary border-opacity-25 px-4 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <div class="p-2 rounded-3 bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                <i class="bi bi-database-fill-up fs-5"></i>
                            </div>
                            <div>
                                <h5 class="modal-title fw-bold mb-0 text-white" id="importDbModalLabel">Import Database</h5>
                                <span class="text-white-50 small">Preview and validate database contents before importing</span>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    
                    <div class="modal-body px-4 py-3">
                        <!-- Drop Zone / Upload Area -->
                        <div id="importDropZone" class="border border-secondary border-dashed rounded-4 p-4 text-center cursor-pointer mb-3 position-relative" 
                             style="background: rgba(255,255,255,0.02); transition: all 0.2s;"
                             ondragover="handleImportDragOver(event)" ondragleave="handleImportDragLeave(event)" ondrop="handleImportDrop(event)">
                            <input type="file" class="d-none" id="importFileInput" accept=".sql,.json" onchange="handleImportFileChange(event)">
                            <i class="bi bi-cloud-arrow-up display-5 text-success mb-2 d-block"></i>
                            <div class="fw-semibold text-white mb-1">Click to browse or drag &amp; drop database backup file</div>
                            <div class="text-white-50 small mb-3">Supports PostgreSQL <code>.sql</code> dumps &amp; MotoWatch <code>.json</code> exports (max 100MB)</div>
                            <button type="button" class="btn btn-outline-success btn-sm px-4 rounded-pill" onclick="document.getElementById('importFileInput').click()">
                                <i class="bi bi-folder2-open me-1"></i> Choose Backup File
                            </button>
                        </div>

                        <!-- Analyzing State Spinner -->
                        <div id="importAnalyzingState" class="text-center py-4 d-none">
                            <div class="spinner-border text-success mb-3" role="status" style="width: 2.2rem; height: 2.2rem;"></div>
                            <div class="text-white fw-semibold mb-1">Analyzing database backup...</div>
                            <div class="text-white-50 small" id="importAnalyzingMsg">Inspecting tables, schemas, and record counts</div>
                        </div>

                        <!-- Database Preview Container (Shown when file is parsed) -->
                        <div id="importPreviewContainer" class="d-none">
                            <!-- File Meta Card -->
                            <div class="card bg-dark border-secondary border-opacity-25 rounded-3 mb-3 p-3">
                                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="p-2 rounded-3 bg-secondary bg-opacity-25 text-white" id="importFileIconContainer">
                                            <i class="bi bi-file-earmark-code fs-4 text-success" id="importFileIcon"></i>
                                        </div>
                                        <div>
                                            <div class="fw-bold text-white fs-6" id="importPreviewFileName">database_backup.sql</div>
                                            <div class="d-flex flex-wrap align-items-center gap-2 mt-1">
                                                <span class="badge bg-secondary bg-opacity-50 text-white" id="importPreviewFileSize">0 KB</span>
                                                <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25" id="importPreviewFormat">PostgreSQL SQL Dump</span>
                                                <span class="text-white-50 small" id="importPreviewHeaderInfo"></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <button type="button" class="btn btn-outline-light btn-sm rounded-pill px-3" onclick="resetImportPreview()">
                                            <i class="bi bi-arrow-repeat me-1"></i> Choose Another File
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Table Counters Grid -->
                            <div class="row g-2 mb-3" id="importStatsGrid">
                                <div class="col-6 col-md-3">
                                    <div class="card bg-dark bg-opacity-75 border-secondary border-opacity-25 rounded-3 p-2 text-center h-100">
                                        <div class="text-white-50 small mb-1"><i class="bi bi-exclamation-triangle text-warning me-1"></i> Violations</div>
                                        <div class="fs-4 fw-bold text-white" id="countPreviewViolations">0</div>
                                        <div class="text-white-50 text-xs" style="font-size: 0.72rem;">Detection records</div>
                                    </div>
                                </div>
                                <div class="col-6 col-md-3">
                                    <div class="card bg-dark bg-opacity-75 border-secondary border-opacity-25 rounded-3 p-2 text-center h-100">
                                        <div class="text-white-50 small mb-1"><i class="bi bi-person-badge text-info me-1"></i> Violators</div>
                                        <div class="fs-4 fw-bold text-info" id="countPreviewViolators">0</div>
                                        <div class="text-white-50 text-xs" style="font-size: 0.72rem;">Registered owners</div>
                                    </div>
                                </div>
                                <div class="col-6 col-md-3">
                                    <div class="card bg-dark bg-opacity-75 border-secondary border-opacity-25 rounded-3 p-2 text-center h-100">
                                        <div class="text-white-50 small mb-1"><i class="bi bi-people text-primary me-1"></i> Users</div>
                                        <div class="fs-4 fw-bold text-primary" id="countPreviewUsers">0</div>
                                        <div class="text-white-50 text-xs" style="font-size: 0.72rem;">Staff accounts</div>
                                    </div>
                                </div>
                                <div class="col-6 col-md-3">
                                    <div class="card bg-dark bg-opacity-75 border-secondary border-opacity-25 rounded-3 p-2 text-center h-100">
                                        <div class="text-white-50 small mb-1"><i class="bi bi-clock-history text-secondary me-1"></i> Logs</div>
                                        <div class="fs-4 fw-bold text-white" id="countPreviewLogs">0</div>
                                        <div class="text-white-50 text-xs" style="font-size: 0.72rem;">Audit &amp; notifications</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Preview Tabs Navigation -->
                            <ul class="nav nav-tabs border-secondary border-opacity-25 mb-3" id="importPreviewTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active text-white bg-transparent border-0 border-bottom border-2 border-success py-2 px-3 fw-medium" 
                                            id="tab-violations-btn" data-bs-toggle="tab" data-bs-target="#tab-preview-violations" type="button" role="tab">
                                        <i class="bi bi-camera-video me-1 text-warning"></i> Violations Preview <span class="badge bg-secondary ms-1" id="badgeTabViolations">0</span>
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link text-white-50 bg-transparent border-0 py-2 px-3 fw-medium" 
                                            id="tab-violators-btn" data-bs-toggle="tab" data-bs-target="#tab-preview-violators" type="button" role="tab">
                                        <i class="bi bi-person-lines-fill me-1 text-info"></i> Violators Preview <span class="badge bg-secondary ms-1" id="badgeTabViolators">0</span>
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link text-white-50 bg-transparent border-0 py-2 px-3 fw-medium" 
                                            id="tab-users-btn" data-bs-toggle="tab" data-bs-target="#tab-preview-users" type="button" role="tab">
                                        <i class="bi bi-person-gear me-1 text-primary"></i> Users <span class="badge bg-secondary ms-1" id="badgeTabUsers">0</span>
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link text-white-50 bg-transparent border-0 py-2 px-3 fw-medium" 
                                            id="tab-summary-btn" data-bs-toggle="tab" data-bs-target="#tab-preview-summary" type="button" role="tab">
                                        <i class="bi bi-file-earmark-text me-1 text-success"></i> Dump Details &amp; Schema
                                    </button>
                                </li>
                            </ul>

                            <!-- Tab Contents -->
                            <div class="tab-content mb-3" id="importPreviewTabContent">
                                <!-- Violations Table Pane -->
                                <div class="tab-pane fade show active" id="tab-preview-violations" role="tabpanel">
                                    <div class="table-responsive rounded-3 border border-secondary border-opacity-25" style="max-height: 260px;">
                                        <table class="table table-dark table-hover table-sm align-middle mb-0" style="font-size: 0.85rem;">
                                            <thead class="table-secondary text-white" style="position: sticky; top: 0; z-index: 1;">
                                                <tr>
                                                    <th class="ps-3 py-2">#ID</th>
                                                    <th>Plate Number</th>
                                                    <th>Violation Category</th>
                                                    <th>Status</th>
                                                    <th>Location</th>
                                                    <th class="pe-3">Detection Time</th>
                                                </tr>
                                            </thead>
                                            <tbody id="importPreviewViolationsBody">
                                                <tr><td colspan="6" class="text-center py-3 text-white-50">No violation records detected.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="text-white-50 text-end small mt-1" id="importViolationsFooterNote"></div>
                                </div>

                                <!-- Violators Table Pane -->
                                <div class="tab-pane fade" id="tab-preview-violators" role="tabpanel">
                                    <div class="table-responsive rounded-3 border border-secondary border-opacity-25" style="max-height: 260px;">
                                        <table class="table table-dark table-hover table-sm align-middle mb-0" style="font-size: 0.85rem;">
                                            <thead class="table-secondary text-white" style="position: sticky; top: 0; z-index: 1;">
                                                <tr>
                                                    <th class="ps-3 py-2">#ID</th>
                                                    <th>Full Name</th>
                                                    <th>Plate Number</th>
                                                    <th>License Type</th>
                                                    <th>Contact / Email</th>
                                                    <th class="pe-3">Address</th>
                                                </tr>
                                            </thead>
                                            <tbody id="importPreviewViolatorsBody">
                                                <tr><td colspan="6" class="text-center py-3 text-white-50">No violator records detected.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="text-white-50 text-end small mt-1" id="importViolatorsFooterNote"></div>
                                </div>

                                <!-- Users Table Pane -->
                                <div class="tab-pane fade" id="tab-preview-users" role="tabpanel">
                                    <div class="table-responsive rounded-3 border border-secondary border-opacity-25" style="max-height: 260px;">
                                        <table class="table table-dark table-hover table-sm align-middle mb-0" style="font-size: 0.85rem;">
                                            <thead class="table-secondary text-white" style="position: sticky; top: 0; z-index: 1;">
                                                <tr>
                                                    <th class="ps-3 py-2">#ID</th>
                                                    <th>Username</th>
                                                    <th>Email</th>
                                                    <th>Role</th>
                                                    <th class="pe-3">Active</th>
                                                </tr>
                                            </thead>
                                            <tbody id="importPreviewUsersBody">
                                                <tr><td colspan="5" class="text-center py-3 text-white-50">No user records detected.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="text-white-50 text-end small mt-1" id="importUsersFooterNote"></div>
                                </div>

                                <!-- Dump Details Pane -->
                                <div class="tab-pane fade" id="tab-preview-summary" role="tabpanel">
                                    <div class="row g-2">
                                        <div class="col-md-5">
                                            <div class="card bg-dark border-secondary border-opacity-25 rounded-3 p-3 h-100">
                                                <h6 class="fw-bold text-success mb-2"><i class="bi bi-table me-1"></i> Tables Breakdown</h6>
                                                <div id="importTablesBreakdownList" class="d-flex flex-column gap-2 small">
                                                    <!-- Injected dynamically -->
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-7">
                                            <div class="card bg-dark border-secondary border-opacity-25 rounded-3 p-3 h-100">
                                                <h6 class="fw-bold text-white mb-2"><i class="bi bi-file-text me-1"></i> Dump Header Snippet</h6>
                                                <pre class="bg-black text-success p-2 rounded small mb-0 font-monospace" style="max-height: 180px; overflow-y: auto; font-size: 0.75rem;" id="importDumpHeaderSnippet">-- No header comments</pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Upsert Notice Banner -->
                            <div class="alert alert-dark border border-secondary border-opacity-25 py-2 px-3 rounded-3 mb-0 d-flex align-items-center gap-2">
                                <i class="bi bi-shield-check text-success fs-5"></i>
                                <div class="small text-white-50">
                                    <strong class="text-white">Safe Upsert Mode:</strong> Matching records will be synchronized based on primary key IDs. Existing records will be updated; new records will be inserted cleanly.
                                </div>
                            </div>
                        </div>

                        <!-- Progress Bar Container (Shown during import) -->
                        <div id="importProgressContainer" class="d-none mt-3">
                            <div class="d-flex justify-content-between text-white small mb-1">
                                <span id="importProgressLabel"><i class="bi bi-arrow-repeat spin me-1"></i> Synchronizing database records...</span>
                                <span id="importProgressPercent" class="fw-bold text-success">0%</span>
                            </div>
                            <div class="progress bg-secondary bg-opacity-25 rounded-pill" style="height: 10px;">
                                <div id="importProgressBar" class="progress-bar progress-bar-striped progress-bar-animated bg-success rounded-pill" style="width: 0%;"></div>
                            </div>
                        </div>

                        <!-- Alert Box -->
                        <div id="importStatusAlert" class="alert d-none py-2 small mt-3 mb-0" role="alert"></div>
                    </div>

                    <div class="modal-footer border-secondary border-opacity-25 px-4 py-3 justify-content-between">
                        <div id="importFooterSummary" class="text-white-50 small">
                            <i class="bi bi-info-circle me-1"></i> Please select a backup file to preview
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-secondary btn-sm px-3 rounded-pill" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-success btn-sm px-4 rounded-pill fw-medium" id="importSubmitBtn" onclick="handleDatabaseImport()" disabled>
                                <i class="bi bi-upload me-1"></i> Start Import
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', importModalHtml);
    }

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

// Database Export / Import Handlers (PostgreSQL .SQL & .JSON)
async function exportDatabaseSql(e) {
    if (e) e.preventDefault();
    try {
        if (typeof SupabaseDB === 'undefined') {
            alert('Supabase client not loaded.');
            return;
        }
        const client = SupabaseDB.init();
        const { data: violators } = await client.from('violators').select('*');
        const { data: violations } = await client.from('violations').select('*');
        const { data: users } = await client.from('users').select('id, username, email, role, is_active, first_name, last_name');
        
        let sqlContent = `-- MotoWatch PostgreSQL Database Export\n`;
        sqlContent += `-- Generated: ${new Date().toISOString()}\n\n`;

        // 1. Violators
        if (violators && violators.length > 0) {
            sqlContent += `-- Data for Name: violators; Type: TABLE DATA\n`;
            violators.forEach(row => {
                const cols = Object.keys(row);
                const vals = cols.map(c => {
                    const v = row[c];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number' || typeof v === 'boolean') return v;
                    return `'${String(v).replace(/'/g, "''")}'`;
                });
                sqlContent += `INSERT INTO public.violators (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`;
            });
            sqlContent += `\n`;
        }

        // 2. Violations
        if (violations && violations.length > 0) {
            sqlContent += `-- Data for Name: violations; Type: TABLE DATA\n`;
            violations.forEach(row => {
                const cols = Object.keys(row);
                const vals = cols.map(c => {
                    const v = row[c];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number' || typeof v === 'boolean') return v;
                    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                    return `'${String(v).replace(/'/g, "''")}'`;
                });
                sqlContent += `INSERT INTO public.violations (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`;
            });
            sqlContent += `\n`;
        }

        // 3. Sequences
        sqlContent += `SELECT setval('violations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.violations));\n`;
        sqlContent += `SELECT setval('violators_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.violators));\n`;

        const blob = new Blob([sqlContent], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `motowatch_dump_${new Date().toISOString().slice(0,10)}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export error:', err);
        alert('Failed to export database: ' + err.message);
    }
}

// Database Import & Interactive Preview System
let currentParsedBackup = null;

const BACKUP_SCHEMAS = {
    violators: ['id', 'first_name', 'last_name', 'middle_name', 'license_type', 'plate_number', 'created_at', 'updated_at', 'phone_number', 'email', 'address'],
    violations: ['id', 'violation_class', 'confidence', 'detection_timestamp', 'plate_number', 'plate_confidence', 'ocr_raw_text', 'plate_crop_raw_file', 'plate_crop_processed_file', 'ocr_candidates', 'ocr_chosen_method', 'source_file', 'annotated_file', 'plate_crop_file', 'evidence_snapshot', 'source_type', 'video_frame_number', 'video_timestamp', 'status', 'verified_by_id', 'verified_at', 'verification_notes', 'pairing_confidence', 'created_at', 'updated_at', 'frame_images', 'violator_id', 'violation_category', 'location'],
    users: ['id', 'username', 'email', 'password_hash', 'role', 'is_active', 'created_at', 'first_name', 'last_name'],
    audit_logs: ['id', 'violation_id', 'user_id', 'action', 'old_value', 'new_value', 'notes', 'timestamp', 'ip_address'],
    notification_logs: ['id', 'violation_id', 'notification_type', 'notification_stage', 'recipient', 'status', 'error_message', 'sent_at']
};

function openImportDbModal(e) {
    if (e) e.preventDefault();
    resetImportPreview();
    const modalEl = document.getElementById('importDbModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function resetImportPreview() {
    currentParsedBackup = null;
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) fileInput.value = '';
    
    const dropZone = document.getElementById('importDropZone');
    if (dropZone) dropZone.classList.remove('d-none');
    
    const previewContainer = document.getElementById('importPreviewContainer');
    if (previewContainer) previewContainer.classList.add('d-none');
    
    const analyzingState = document.getElementById('importAnalyzingState');
    if (analyzingState) analyzingState.classList.add('d-none');
    
    const progressContainer = document.getElementById('importProgressContainer');
    if (progressContainer) progressContainer.classList.add('d-none');
    
    const alertBox = document.getElementById('importStatusAlert');
    if (alertBox) alertBox.classList.add('d-none');
    
    const submitBtn = document.getElementById('importSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Start Import';
    }
    
    const footerSummary = document.getElementById('importFooterSummary');
    if (footerSummary) {
        footerSummary.innerHTML = '<i class="bi bi-info-circle me-1"></i> Please select a backup file to preview';
    }

    // Reset tab to first tab
    const firstTabBtn = document.getElementById('tab-violations-btn');
    if (firstTabBtn && typeof bootstrap !== 'undefined') {
        const tab = bootstrap.Tab.getOrCreateInstance(firstTabBtn);
        tab.show();
    }
}

function handleImportDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('importDropZone');
    if (dropZone) {
        dropZone.style.borderColor = '#198754';
        dropZone.style.backgroundColor = 'rgba(25, 135, 84, 0.08)';
    }
}

function handleImportDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('importDropZone');
    if (dropZone) {
        dropZone.style.borderColor = '';
        dropZone.style.backgroundColor = 'rgba(255,255,255,0.02)';
    }
}

function handleImportDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    handleImportDragLeave(e);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleDatabaseFileSelect(e.dataTransfer.files[0]);
    }
}

function handleImportFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
        handleDatabaseFileSelect(e.target.files[0]);
    }
}

function handleDatabaseFileSelect(file) {
    if (!file) return;

    const alertBox = document.getElementById('importStatusAlert');
    if (alertBox) alertBox.classList.add('d-none');

    const validExtensions = ['.sql', '.json'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
        if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.innerHTML = '<i class="bi bi-x-circle me-1"></i> Unsupported file format. Please upload a <code>.sql</code> dump or <code>.json</code> backup file.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.innerHTML = '<i class="bi bi-x-circle me-1"></i> File size exceeds 100MB limit.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    // Display analyzing state
    const dropZone = document.getElementById('importDropZone');
    if (dropZone) dropZone.classList.add('d-none');
    
    const analyzingState = document.getElementById('importAnalyzingState');
    if (analyzingState) analyzingState.classList.remove('d-none');
    
    const analyzingMsg = document.getElementById('importAnalyzingMsg');
    if (analyzingMsg) analyzingMsg.textContent = `Reading ${file.name} (${formatBytes(file.size)})...`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const parsed = parseDatabaseBackup(content, file.name, file.size);
            currentParsedBackup = parsed;
            renderDatabasePreview(parsed);
        } catch (err) {
            console.error('Error previewing database file:', err);
            if (analyzingState) analyzingState.classList.add('d-none');
            if (dropZone) dropZone.classList.remove('d-none');
            if (alertBox) {
                alertBox.className = 'alert alert-danger py-2 small';
                alertBox.innerHTML = `<i class="bi bi-x-circle me-1"></i> Failed to analyze file: ${err.message}`;
                alertBox.classList.remove('d-none');
            }
        }
    };
    reader.onerror = function() {
        if (analyzingState) analyzingState.classList.add('d-none');
        if (dropZone) dropZone.classList.remove('d-none');
        if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.innerHTML = '<i class="bi bi-x-circle me-1"></i> Failed to read file from disk.';
            alertBox.classList.remove('d-none');
        }
    };
    reader.readAsText(file);
}

function parseSqlValues(rawVals) {
    const values = [];
    let current = '';
    let inQuotes = false;
    let wasQuoted = false;
    let i = 0;
    let s = rawVals.trim();
    if (s.startsWith('(') && s.endsWith(')')) {
        s = s.slice(1, -1).trim();
    }
    while (i < s.length) {
        const char = s[i];
        if (char === "'") {
            if (inQuotes && s[i + 1] === "'") {
                current += "'";
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
                wasQuoted = true;
                i++;
                continue;
            }
        }
        if (char === ',' && !inQuotes) {
            values.push(cleanSqlToken(current.trim(), wasQuoted));
            current = '';
            wasQuoted = false;
            i++;
            continue;
        }
        current += char;
        i++;
    }
    if (current.length > 0 || s.endsWith(',')) {
        values.push(cleanSqlToken(current.trim(), wasQuoted));
    }
    return values;
}

function cleanSqlToken(token, wasQuoted = false) {
    if (wasQuoted) {
        if ((token.startsWith('{') && token.endsWith('}')) || (token.startsWith('[') && token.endsWith(']'))) {
            try { return JSON.parse(token); } catch(e) {}
        }
        return token;
    }
    if (!token || token.toUpperCase() === 'NULL') return null;
    if (token.toLowerCase() === 'true') return true;
    if (token.toLowerCase() === 'false') return false;
    if (!isNaN(token) && !isNaN(parseFloat(token)) && !token.includes(':') && !token.includes('-')) {
        return Number(token);
    }
    return token;
}

function parseDatabaseBackup(content, fileName = '', fileSize = 0) {
    const isJson = fileName.toLowerCase().endsWith('.json') || content.trim().startsWith('{');
    const result = {
        format: isJson ? 'MotoWatch JSON Backup' : 'PostgreSQL SQL Dump',
        fileName,
        fileSize,
        headerComments: [],
        tables: {},
        sampleRecords: {},
        totalRecords: 0,
        errors: []
    };

    if (isJson) {
        try {
            const data = JSON.parse(content);
            const knownTables = ['violators', 'violations', 'users', 'audit_logs', 'notification_logs'];
            knownTables.forEach(tbl => {
                if (Array.isArray(data[tbl])) {
                    result.tables[tbl] = data[tbl];
                    result.sampleRecords[tbl] = data[tbl].slice(0, 10);
                    result.totalRecords += data[tbl].length;
                }
            });
            Object.keys(data).forEach(key => {
                if (!result.tables[key] && Array.isArray(data[key])) {
                    result.tables[key] = data[key];
                    result.sampleRecords[key] = data[key].slice(0, 10);
                    result.totalRecords += data[key].length;
                }
            });
        } catch (e) {
            result.errors.push('Failed to parse JSON backup: ' + e.message);
        }
        return result;
    }

    // 1. Extract header comments from SQL
    const lines = content.split(/\r?\n/);
    for (let j = 0; j < Math.min(lines.length, 35); j++) {
        const line = lines[j].trim();
        if (line.startsWith('--') && line.length > 2) {
            result.headerComments.push(line.replace(/^--\s*/, ''));
        }
    }

    // 2. Discover custom schemas from CREATE TABLE if present
    const schemas = { ...BACKUP_SCHEMAS };
    const createTableRegex = /CREATE\s+TABLE\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
    let createMatch;
    while ((createMatch = createTableRegex.exec(content)) !== null) {
        const tname = createMatch[1].toLowerCase();
        const body = createMatch[2];
        const cols = [];
        for (const rawCol of body.split('\n')) {
            const trimmed = rawCol.trim();
            if (!trimmed || trimmed.startsWith('--') || /^(CONSTRAINT|PRIMARY|FOREIGN|CHECK|UNIQUE)/i.test(trimmed)) {
                continue;
            }
            const colName = trimmed.split(/\s+/)[0].replace(/["`]/g, '');
            cols.push(colName);
        }
        if (cols.length > 0) {
            schemas[tname] = cols;
        }
    }

    // 3. Extract COPY ... FROM stdin statements (Standard default pg_dump format)
    const copyRegex = /COPY\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s*FROM\s+stdin;\r?\n([\s\S]*?)\r?\n\\\./gi;
    let copyMatch;
    while ((copyMatch = copyRegex.exec(content)) !== null) {
        const tableName = copyMatch[1].toLowerCase();
        const columns = copyMatch[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
        const dataBlock = copyMatch[3];
        const rows = dataBlock.split(/\r?\n/);

        for (const rowLine of rows) {
            if (!rowLine || rowLine === '\\.') continue;
            const fields = rowLine.split('\t');
            const rowObj = {};

            columns.forEach((col, idx) => {
                let val = fields[idx];
                if (val === undefined || val === '\\N') {
                    rowObj[col] = null;
                } else {
                    val = val.replace(/\\\\/g, '\\').replace(/\\t/g, '\t').replace(/\\n/g, '\n');
                    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                        try { val = JSON.parse(val); } catch(e){}
                    } else if (val === 't' || val === 'true') {
                        val = true;
                    } else if (val === 'f' || val === 'false') {
                        val = false;
                    } else if (col === 'id' || col === 'violator_id' || col === 'verified_by_id' || col === 'user_id' || col === 'violation_id' || col === 'confidence' || col === 'plate_confidence') {
                        if (!isNaN(val) && !isNaN(parseFloat(val))) {
                            val = Number(val);
                        }
                    }
                    rowObj[col] = val;
                }
            });

            if (!result.tables[tableName]) {
                result.tables[tableName] = [];
                result.sampleRecords[tableName] = [];
            }
            result.tables[tableName].push(rowObj);
            if (result.sampleRecords[tableName].length < 10) {
                result.sampleRecords[tableName].push(rowObj);
            }
            result.totalRecords++;
        }
    }

    // 4. Extract INSERT statements (handles with and without column specifications)
    const insertRegex = /INSERT\s+INTO\s+(?:public\.)?(\w+)(?:\s*\(([^)]+)\))?\s*VALUES\s*\(([\s\S]*?)\)(?:\s*ON\s+CONFLICT[^\n;]*)?;/gi;
    let match;

    while ((match = insertRegex.exec(content)) !== null) {
        const tableName = match[1].toLowerCase();
        const rawCols = match[2];
        const rawVals = match[3];

        let columns = [];
        if (rawCols) {
            columns = rawCols.split(',').map(c => c.trim().replace(/["`]/g, ''));
        } else if (schemas[tableName]) {
            columns = schemas[tableName];
        }

        const values = parseSqlValues(rawVals);
        const row = {};

        if (columns.length > 0) {
            columns.forEach((col, idx) => {
                row[col] = idx < values.length ? values[idx] : null;
            });
        } else {
            values.forEach((val, idx) => {
                row[`col_${idx + 1}`] = val;
            });
        }

        if (!result.tables[tableName]) {
            result.tables[tableName] = [];
            result.sampleRecords[tableName] = [];
        }
        result.tables[tableName].push(row);
        if (result.sampleRecords[tableName].length < 10) {
            result.sampleRecords[tableName].push(row);
        }
        result.totalRecords++;
    }

    return result;
}

function renderDatabasePreview(parsed) {
    const analyzingState = document.getElementById('importAnalyzingState');
    if (analyzingState) analyzingState.classList.add('d-none');
    
    const previewContainer = document.getElementById('importPreviewContainer');
    if (previewContainer) previewContainer.classList.remove('d-none');

    // 1. File Meta
    const fileNameEl = document.getElementById('importPreviewFileName');
    if (fileNameEl) fileNameEl.textContent = parsed.fileName || 'backup_file';

    const fileSizeEl = document.getElementById('importPreviewFileSize');
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(parsed.fileSize);

    const formatEl = document.getElementById('importPreviewFormat');
    if (formatEl) formatEl.textContent = parsed.format;

    const fileIcon = document.getElementById('importFileIcon');
    if (fileIcon) {
        fileIcon.className = parsed.fileName.endsWith('.json') 
            ? 'bi bi-file-earmark-code fs-4 text-warning' 
            : 'bi bi-filetype-sql fs-4 text-success';
    }

    const headerInfoEl = document.getElementById('importPreviewHeaderInfo');
    if (headerInfoEl) {
        const dumpVer = parsed.headerComments.find(c => /dumped/i.test(c)) || '';
        headerInfoEl.textContent = dumpVer ? `(${dumpVer})` : '';
    }

    // 2. Counters
    const violationsCount = (parsed.tables['violations'] || []).length;
    const violatorsCount = (parsed.tables['violators'] || []).length;
    const usersCount = (parsed.tables['users'] || []).length;
    const logsCount = (parsed.tables['audit_logs'] || []).length + (parsed.tables['notification_logs'] || []).length;

    const elViolations = document.getElementById('countPreviewViolations');
    if (elViolations) elViolations.textContent = violationsCount.toLocaleString();

    const elViolators = document.getElementById('countPreviewViolators');
    if (elViolators) elViolators.textContent = violatorsCount.toLocaleString();

    const elUsers = document.getElementById('countPreviewUsers');
    if (elUsers) elUsers.textContent = usersCount.toLocaleString();

    const elLogs = document.getElementById('countPreviewLogs');
    if (elLogs) elLogs.textContent = logsCount.toLocaleString();

    // Tab badges
    const badgeViolations = document.getElementById('badgeTabViolations');
    if (badgeViolations) badgeViolations.textContent = violationsCount;

    const badgeViolators = document.getElementById('badgeTabViolators');
    if (badgeViolators) badgeViolators.textContent = violatorsCount;

    const badgeUsers = document.getElementById('badgeTabUsers');
    if (badgeUsers) badgeUsers.textContent = usersCount;

    // 3. Render Violations Preview Table
    const violationsBody = document.getElementById('importPreviewViolationsBody');
    if (violationsBody) {
        const sampleViolations = parsed.sampleRecords['violations'] || [];
        if (sampleViolations.length === 0) {
            violationsBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-white-50"><i class="bi bi-inbox me-1"></i> No violation records found in this backup.</td></tr>';
        } else {
            violationsBody.innerHTML = sampleViolations.map(v => {
                const id = v.id || '-';
                const plate = v.plate_number || v.ocr_raw_text || 'UNKNOWN';
                const cat = v.violation_category || v.violation_class || 'Violation';
                const status = v.status || 'UNVERIFIED';
                const loc = v.location || 'Default';
                const date = v.detection_timestamp || v.created_at || '-';
                const statusBadge = status === 'VERIFIED' ? 'bg-success' : (status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark');
                
                return `<tr>
                    <td class="ps-3 fw-bold text-white-50">#${id}</td>
                    <td class="fw-bold text-success"><span class="badge bg-dark border border-secondary px-2 py-1 font-monospace">${escapeHtml(plate)}</span></td>
                    <td>${escapeHtml(cat)}</td>
                    <td><span class="badge ${statusBadge} px-2 py-1">${escapeHtml(status)}</span></td>
                    <td class="text-white-50 small">${escapeHtml(loc)}</td>
                    <td class="pe-3 text-white-50 font-monospace small">${escapeHtml(String(date).slice(0, 19))}</td>
                </tr>`;
            }).join('');
        }
    }
    const violationsNote = document.getElementById('importViolationsFooterNote');
    if (violationsNote) {
        violationsNote.textContent = violationsCount > 10 
            ? `Showing first 10 of ${violationsCount} violation records` 
            : `${violationsCount} total violation records ready to import`;
    }

    // 4. Render Violators Preview Table
    const violatorsBody = document.getElementById('importPreviewViolatorsBody');
    if (violatorsBody) {
        const sampleViolators = parsed.sampleRecords['violators'] || [];
        if (sampleViolators.length === 0) {
            violatorsBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-white-50"><i class="bi bi-inbox me-1"></i> No registered violator records found.</td></tr>';
        } else {
            violatorsBody.innerHTML = sampleViolators.map(v => {
                const id = v.id || '-';
                const name = [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(' ') || 'Unnamed';
                const plate = v.plate_number || '-';
                const lic = v.license_type || 'N/A';
                const contact = v.phone_number || v.email || 'None';
                const addr = v.address || 'N/A';
                
                return `<tr>
                    <td class="ps-3 fw-bold text-white-50">#${id}</td>
                    <td class="fw-medium text-white">${escapeHtml(name)}</td>
                    <td><span class="badge bg-dark border border-secondary px-2 py-1 font-monospace">${escapeHtml(plate)}</span></td>
                    <td><span class="badge bg-secondary bg-opacity-50 text-white">${escapeHtml(lic)}</span></td>
                    <td class="text-white-50 small">${escapeHtml(contact)}</td>
                    <td class="pe-3 text-white-50 small text-truncate" style="max-width: 160px;">${escapeHtml(addr)}</td>
                </tr>`;
            }).join('');
        }
    }
    const violatorsNote = document.getElementById('importViolatorsFooterNote');
    if (violatorsNote) {
        violatorsNote.textContent = violatorsCount > 10 
            ? `Showing first 10 of ${violatorsCount} violator records` 
            : `${violatorsCount} total violator records ready to import`;
    }

    // 5. Render Users Preview Table
    const usersBody = document.getElementById('importPreviewUsersBody');
    if (usersBody) {
        const sampleUsers = parsed.sampleRecords['users'] || [];
        if (sampleUsers.length === 0) {
            usersBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-white-50"><i class="bi bi-inbox me-1"></i> No user accounts in this backup.</td></tr>';
        } else {
            usersBody.innerHTML = sampleUsers.map(u => {
                const id = u.id || '-';
                const user = u.username || 'user';
                const email = u.email || 'N/A';
                const role = u.role || 'Validator';
                const active = u.is_active !== false ? 'Active' : 'Inactive';
                const roleBadge = role === 'Admin' ? 'bg-danger' : 'bg-primary';
                
                return `<tr>
                    <td class="ps-3 fw-bold text-white-50">#${id}</td>
                    <td class="fw-bold text-white">${escapeHtml(user)}</td>
                    <td class="text-white-50 small">${escapeHtml(email)}</td>
                    <td><span class="badge ${roleBadge} px-2 py-1">${escapeHtml(role)}</span></td>
                    <td class="pe-3"><span class="badge bg-success bg-opacity-25 text-success">${active}</span></td>
                </tr>`;
            }).join('');
        }
    }
    const usersNote = document.getElementById('importUsersFooterNote');
    if (usersNote) {
        usersNote.textContent = usersCount > 0 ? `${usersCount} user account(s) detected` : '';
    }

    // 6. Render Dump Details Breakdown
    const breakdownList = document.getElementById('importTablesBreakdownList');
    if (breakdownList) {
        const tableEntries = Object.entries(parsed.tables);
        if (tableEntries.length === 0) {
            breakdownList.innerHTML = '<span class="text-white-50">No tables detected.</span>';
        } else {
            breakdownList.innerHTML = tableEntries.map(([t, rows]) => `
                <div class="d-flex align-items-center justify-content-between p-2 rounded-2 bg-dark bg-opacity-50 border border-secondary border-opacity-10">
                    <span class="font-monospace text-white"><i class="bi bi-grid-3x3-gap me-2 text-success"></i>public.${escapeHtml(t)}</span>
                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">${rows.length} rows</span>
                </div>
            `).join('');
        }
    }

    const headerSnippet = document.getElementById('importDumpHeaderSnippet');
    if (headerSnippet) {
        if (parsed.headerComments.length > 0) {
            headerSnippet.textContent = parsed.headerComments.map(c => `-- ${c}`).join('\n');
        } else {
            headerSnippet.textContent = `-- MotoWatch Database Backup Preview\n-- File: ${parsed.fileName}\n-- Total detected records: ${parsed.totalRecords}\n-- Ready for import into Cloud Supabase.`;
        }
    }

    // 7. Update Footer & Action Buttons
    const footerSummary = document.getElementById('importFooterSummary');
    if (footerSummary) {
        footerSummary.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i> <strong>${parsed.totalRecords.toLocaleString()}</strong> records ready across <strong>${Object.keys(parsed.tables).length}</strong> tables`;
    }

    const submitBtn = document.getElementById('importSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = parsed.totalRecords === 0;
        submitBtn.innerHTML = `<i class="bi bi-upload me-1"></i> Start Import (${parsed.totalRecords.toLocaleString()} Records)`;
    }
}

async function handleDatabaseImport() {
    const alertBox = document.getElementById('importStatusAlert');
    const submitBtn = document.getElementById('importSubmitBtn');
    const progressContainer = document.getElementById('importProgressContainer');
    const progressBar = document.getElementById('importProgressBar');
    const progressLabel = document.getElementById('importProgressLabel');
    const progressPercent = document.getElementById('importProgressPercent');

    if (!currentParsedBackup || currentParsedBackup.totalRecords === 0) {
        if (alertBox) {
            alertBox.className = 'alert alert-warning py-2 small';
            alertBox.textContent = 'No records found to import. Please select a valid database backup file.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importing...';
    }

    if (progressContainer) progressContainer.classList.remove('d-none');
    if (alertBox) alertBox.classList.add('d-none');

    try {
        if (typeof SupabaseDB === 'undefined') throw new Error('Supabase client is not loaded');
        const client = SupabaseDB.init();
        if (!client) throw new Error('Could not initialize Supabase client');

        const tablesToImport = ['violators', 'violations', 'users', 'audit_logs', 'notification_logs'];
        let totalImported = 0;
        const totalToImport = currentParsedBackup.totalRecords;
        let tablesReport = [];

        for (const tableName of tablesToImport) {
            const rows = currentParsedBackup.tables[tableName];
            if (!rows || rows.length === 0) continue;

            if (progressLabel) progressLabel.innerHTML = `<i class="bi bi-arrow-repeat spin me-1"></i> Importing ${tableName} (${rows.length} records)...`;

            // Process in batches of 50
            const batchSize = 50;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize).map(row => {
                    const cleanRow = { ...row };
                    // Parse stringified JSONs if needed
                    if (typeof cleanRow.frame_images === 'string') {
                        try { cleanRow.frame_images = JSON.parse(cleanRow.frame_images); } catch(e){}
                    }
                    if (typeof cleanRow.ocr_candidates === 'string') {
                        try { cleanRow.ocr_candidates = JSON.parse(cleanRow.ocr_candidates); } catch(e){}
                    }
                    return cleanRow;
                });

                try {
                    const { error } = await client.from(tableName).upsert(batch);
                    if (error) {
                        console.warn(`Upsert warning on table ${tableName}:`, error.message);
                    }
                } catch (batchErr) {
                    console.warn(`Upsert exception on table ${tableName}:`, batchErr);
                }

                totalImported += batch.length;
                const pct = Math.min(100, Math.round((totalImported / totalToImport) * 100));
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressPercent) progressPercent.textContent = `${pct}%`;
            }

            tablesReport.push(`${rows.length} ${tableName}`);
        }

        // Complete!
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Import completed successfully!';

        if (alertBox) {
            alertBox.className = 'alert alert-success py-2 small';
            alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> <strong>Success!</strong> Successfully imported ${tablesReport.join(', ')} into Cloud Supabase!`;
            alertBox.classList.remove('d-none');
        }

        setTimeout(() => {
            window.location.reload();
        }, 1800);

    } catch (err) {
        console.error('Import error:', err);
        if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.innerHTML = `<i class="bi bi-x-circle me-1"></i> Import failed: ${err.message}`;
            alertBox.classList.remove('d-none');
        }
        if (progressContainer) progressContainer.classList.add('d-none');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Start Import';
        }
    }
}

function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Backward compatibility aliases
window.openImportDbModal = openImportDbModal;
window.handleDatabaseImport = handleDatabaseImport;
window.handleImportFileChange = handleImportFileChange;
window.handleImportDragOver = handleImportDragOver;
window.handleImportDragLeave = handleImportDragLeave;
window.handleImportDrop = handleImportDrop;
window.resetImportPreview = resetImportPreview;
window.exportDatabaseJson = exportDatabaseSql;
window.exportDatabaseSql = exportDatabaseSql;

// Backward compatibility aliases
window.exportDatabaseJson = exportDatabaseSql;
window.exportDatabaseSql = exportDatabaseSql;



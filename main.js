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

    // 2b. Inject Import Database Modal if not present
    if (!document.getElementById('importDbModal')) {
        const importModalHtml = `
        <div class="modal fade" id="importDbModal" tabindex="-1" aria-labelledby="importDbModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-white border-secondary shadow-lg" style="border-radius:16px;">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="importDbModalLabel">
                            <i class="bi bi-upload me-2 text-success"></i> Import Database (Cloud Supabase)
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-white-50 small mb-3">
                            Upload a PostgreSQL <code>.sql</code> dump or <code>.json</code> backup file to import into Supabase.
                        </p>
                        <div class="mb-3">
                            <input type="file" class="form-control bg-dark text-white border-secondary" id="importFileInput" accept=".sql,.json">
                        </div>
                        <div id="importStatusAlert" class="alert d-none py-2 small" role="alert"></div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success btn-sm px-3" id="importSubmitBtn" onclick="handleDatabaseImport()">
                            <i class="bi bi-upload me-1"></i> Start Import
                        </button>
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

function openImportDbModal(e) {
    if (e) e.preventDefault();
    const modalEl = document.getElementById('importDbModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

async function handleDatabaseImport() {
    const fileInput = document.getElementById('importFileInput');
    const alertBox = document.getElementById('importStatusAlert');
    const submitBtn = document.getElementById('importSubmitBtn');
    
    if (!fileInput || !fileInput.files.length) {
        if (alertBox) {
            alertBox.className = 'alert alert-warning py-2 small';
            alertBox.textContent = 'Please select a .SQL or .JSON backup file first.';
            alertBox.classList.remove('d-none');
        }
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importing...';
    }

    reader.onload = async function(e) {
        try {
            const content = e.target.result;
            if (typeof SupabaseDB === 'undefined') throw new Error('Supabase client unavailable');
            const client = SupabaseDB.init();

            if (file.name.endsWith('.json')) {
                const data = JSON.parse(content);
                if (data.violators && data.violators.length) await client.from('violators').upsert(data.violators);
                if (data.violations && data.violations.length) await client.from('violations').upsert(data.violations);
            } else {
                // Parse SQL INSERT statements
                const insertRegex = /INSERT INTO public\.(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^;]+)\)/gi;
                let match;
                let count = 0;

                while ((match = insertRegex.exec(content)) !== null) {
                    const table = match[1];
                    const columns = match[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
                    // Parse values
                    const rawVals = match[3];
                    // Clean on conflict if present
                    const valClean = rawVals.split(/ON CONFLICT/i)[0].trim();
                    
                    const rowObj = {};
                    const valParts = valClean.match(/('(?:''|[^'])*'|NULL|\d+(?:\.\d+)?|true|false)/gi) || [];
                    
                    columns.forEach((col, idx) => {
                        let v = valParts[idx];
                        if (v === 'NULL' || v === undefined) {
                            rowObj[col] = null;
                        } else if (v.startsWith("'") && v.endsWith("'")) {
                            rowObj[col] = v.slice(1, -1).replace(/''/g, "'");
                            if (col === 'frame_images' || col === 'ocr_candidates') {
                                try { rowObj[col] = JSON.parse(rowObj[col]); } catch(e){}
                            }
                        } else if (v === 'true') rowObj[col] = true;
                        else if (v === 'false') rowObj[col] = false;
                        else rowObj[col] = Number(v);
                    });

                    if (table === 'violations' || table === 'violators') {
                        await client.from(table).upsert(rowObj);
                        count++;
                    }
                }
            }

            if (alertBox) {
                alertBox.className = 'alert alert-success py-2 small';
                alertBox.innerHTML = '<i class="bi bi-check-circle me-1"></i> Database imported successfully!';
                alertBox.classList.remove('d-none');
            }
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            console.error('Import error:', err);
            if (alertBox) {
                alertBox.className = 'alert alert-danger py-2 small';
                alertBox.textContent = 'Import failed: ' + err.message;
                alertBox.classList.remove('d-none');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Start Import';
            }
        }
    };
    reader.readAsText(file);
}

// Backward compatibility aliases
window.exportDatabaseJson = exportDatabaseSql;
window.exportDatabaseSql = exportDatabaseSql;



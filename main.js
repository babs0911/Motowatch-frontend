// MotoWatch Custom JavaScript

// File upload validation
document.addEventListener('DOMContentLoaded', function() {
    // File input validation
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (file) {
                // Check file size (100MB max)
                const maxSize = 100 * 1024 * 1024; // 100MB in bytes
                
                if (file.size > maxSize) {
                    alert('File size exceeds 100MB limit. Please choose a smaller file.');
                    e.target.value = '';
                    return;
                }
                
                // Show file name
                console.log('Selected file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
            }
        });
    });
    
    // Form submission loading state
    const uploadForms = document.querySelectorAll('form[enctype="multipart/form-data"]');
    
    uploadForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
            }
        });
    });
    
    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
    
    // Image gallery lightbox (simple implementation)
    const evidenceImages = document.querySelectorAll('.evidence-gallery img');
    
    evidenceImages.forEach(img => {
        img.addEventListener('click', function() {
            // Simple full-screen view
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
            
            const fullImg = document.createElement('img');
            fullImg.src = this.src;
            fullImg.style.cssText = 'max-width:90%;max-height:90%;';
            
            modal.appendChild(fullImg);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
        });
    });
});

// Uppercase input for plate numbers
const plateInputs = document.querySelectorAll('input[name="plate_number"]');

plateInputs.forEach(input => {
    input.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
});

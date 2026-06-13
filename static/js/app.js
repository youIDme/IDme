/**
 * IDme — Front-End Application logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── Global Toast Utility ────────────────────────────────
    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-notice toast-${type}`;
        
        // Icon based on type
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
        } else {
            iconSvg = `<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
        }

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // ── 1. Profile Page Animations & Interactions ──────────
    const gauge = document.getElementById('trust-gauge-circle');
    if (gauge) {
        const score = parseInt(gauge.getAttribute('data-score') || '0', 10);
        // Circumference of circle with r=70 is 439.82 (approximated as 440)
        const offset = 440 - (440 * score / 100);
        
        // Wait slightly for transition to kick in smoothly
        setTimeout(() => {
            gauge.style.strokeDashoffset = offset;
        }, 100);
    }

    // QR Code Toggle
    const qrBtn = document.getElementById('qr-toggle-btn');
    const qrContainer = document.getElementById('qr-container');
    if (qrBtn && qrContainer) {
        qrBtn.addEventListener('click', () => {
            qrContainer.classList.toggle('hidden');
        });
    }

    // Share Profile button
    const shareProfileBtn = document.getElementById('share-profile-btn');
    if (shareProfileBtn) {
        shareProfileBtn.addEventListener('click', () => {
            const url = shareProfileBtn.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                showToast('Profile link copied to clipboard!');
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        });
    }

    // Copy embed code snippet
    const copyBadgeBtn = document.getElementById('copy-badge-btn');
    const badgeCodeInput = document.getElementById('badge-code');
    if (copyBadgeBtn && badgeCodeInput) {
        copyBadgeBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(badgeCodeInput.value).then(() => {
                showToast('Embed code snippet copied!');
            }).catch(() => {
                showToast('Failed to copy code', 'error');
            });
        });
    }


    // ── 2. Onboarding Wizard Flow ───────────────────────────
    const slugInput = document.getElementById('slug-input');
    const reserveBtn = document.getElementById('reserve-btn');
    const slugFeedback = document.getElementById('slug-feedback');
    
    // Indicators
    const indLoading = document.getElementById('slug-indicator-loading');
    const indSuccess = document.getElementById('slug-indicator-success');
    const indError = document.getElementById('slug-indicator-error');

    let checkTimeout = null;
    let isSlugAvailable = false;

    // Check slug availability in real-time
    if (slugInput) {
        // Pre-fill slug from URL query param if present
        const urlParams = new URLSearchParams(window.location.search);
        const urlSlug = urlParams.get('slug');
        if (urlSlug) {
            slugInput.value = urlSlug;
            validateAndCheckSlug(urlSlug);
        }

        slugInput.addEventListener('input', (e) => {
            const slug = e.target.value.trim().toLowerCase();
            clearTimeout(checkTimeout);
            
            // Clean up indicators
            indLoading.classList.add('hidden');
            indSuccess.classList.add('hidden');
            indError.classList.add('hidden');
            slugFeedback.classList.add('hidden');
            reserveBtn.disabled = true;

            if (slug.length === 0) return;

            checkTimeout = setTimeout(() => {
                validateAndCheckSlug(slug);
            }, 300);
        });
    }

    async function validateAndCheckSlug(slug) {
        // Client-side validation
        const regex = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
        if (!regex.test(slug)) {
            showSlugError("Username must start with a letter/number and contain only alphanumeric, hyphens or underscores.");
            return;
        }
        if (slug.length < 3) {
            showSlugError("Username must be at least 3 characters.");
            return;
        }

        // Show spinner
        indLoading.classList.remove('hidden');

        try {
            const response = await fetch('/api/check-slug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug })
            });
            const data = await response.json();
            
            indLoading.classList.add('hidden');
            
            if (data.available) {
                indSuccess.classList.remove('hidden');
                slugFeedback.classList.add('hidden');
                reserveBtn.disabled = false;
                isSlugAvailable = true;
            } else {
                showSlugError(data.reason || "Username is already taken.");
            }
        } catch (err) {
            indLoading.classList.add('hidden');
            showSlugError("Could not verify username. Please try again.");
        }
    }

    function showSlugError(msg) {
        indError.classList.remove('hidden');
        slugFeedback.textContent = msg;
        slugFeedback.classList.remove('hidden');
        reserveBtn.disabled = true;
        isSlugAvailable = false;
    }

    // State Variables
    let currentSessionToken = null;
    let currentSlug = null;
    let oauthUrls = {};
    let pollInterval = null;

    // Reserve slug handler
    if (reserveBtn) {
        reserveBtn.addEventListener('click', async () => {
            const slug = slugInput.value.trim().toLowerCase();
            if (!slug || !isSlugAvailable) return;

            reserveBtn.disabled = true;
            try {
                const response = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug })
                });
                const data = await response.json();

                if (data.success) {
                    currentSessionToken = data.session_token;
                    currentSlug = data.slug;
                    oauthUrls = data.oauth_urls;

                    // Save to local storage for recovery
                    localStorage.setItem('idme_session_token', currentSessionToken);
                    localStorage.setItem('idme_slug', currentSlug);

                    goToStep2();
                    showToast('Username reserved successfully!');
                } else {
                    showToast(data.detail || 'Failed to reserve username', 'error');
                    reserveBtn.disabled = false;
                }
            } catch (err) {
                showToast('Server connection failed', 'error');
                reserveBtn.disabled = false;
            }
        });
    }

    function goToStep2() {
        const step1Div = document.getElementById('wizard-step-1');
        const step2Div = document.getElementById('wizard-step-2');
        const progressBar = document.getElementById('step-progress-bar');
        const badge1 = document.getElementById('step-1-badge');
        const badge2 = document.getElementById('step-2-badge');
        const text1 = document.getElementById('step-1-text');
        const text2 = document.getElementById('step-2-text');

        if (step1Div && step2Div) {
            step1Div.classList.add('hidden');
            step2Div.classList.remove('hidden');
            progressBar.style.width = '100%';

            badge1.innerHTML = '✓';
            badge1.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm';
            text1.className = 'text-sm font-semibold text-emerald-500';

            badge2.className = 'w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm';
            text2.className = 'text-sm font-semibold text-white';

            // Configure links
            updatePlatformLinks();

            // Start polling
            startPolling();
        }
    }

    function updatePlatformLinks() {
        // Set OAuth hrefs
        const ghBtn = document.getElementById('connect-btn-github');
        const inBtn = document.getElementById('connect-btn-linkedin');
        const fbBtn = document.getElementById('connect-btn-facebook');

        if (ghBtn) {
            if (oauthUrls.github) {
                ghBtn.href = oauthUrls.github;
                ghBtn.classList.remove('pointer-events-none', 'opacity-50');
            } else {
                ghBtn.href = '#';
                ghBtn.classList.add('pointer-events-none', 'opacity-50');
                document.getElementById('platform-status-github').innerText = 'Disabled (No Server Config)';
            }
        }

        if (inBtn) {
            if (oauthUrls.linkedin) {
                inBtn.href = oauthUrls.linkedin;
                inBtn.classList.remove('pointer-events-none', 'opacity-50');
            } else {
                inBtn.href = '#';
                inBtn.classList.add('pointer-events-none', 'opacity-50');
                document.getElementById('platform-status-linkedin').innerText = 'Disabled (No Server Config)';
            }
        }

        if (fbBtn) {
            if (oauthUrls.facebook) {
                fbBtn.href = oauthUrls.facebook;
                fbBtn.classList.remove('pointer-events-none', 'opacity-50');
            } else {
                fbBtn.href = '#';
                fbBtn.classList.add('pointer-events-none', 'opacity-50');
                document.getElementById('platform-status-facebook').innerText = 'Disabled (No Server Config)';
            }
        }
    }

    // Change slug/Reset button
    const changeSlugBtn = document.getElementById('change-slug-btn');
    if (changeSlugBtn) {
        changeSlugBtn.addEventListener('click', () => {
            // Stop polling
            stopPolling();

            // Clear session storage
            localStorage.removeItem('idme_session_token');
            localStorage.removeItem('idme_slug');
            currentSessionToken = null;
            currentSlug = null;
            oauthUrls = {};

            // Clear URL params
            window.history.replaceState({}, document.title, "/create");

            // Reset UI to step 1
            const step1Div = document.getElementById('wizard-step-1');
            const step2Div = document.getElementById('wizard-step-2');
            const progressBar = document.getElementById('step-progress-bar');
            const badge1 = document.getElementById('step-1-badge');
            const badge2 = document.getElementById('step-2-badge');
            const text1 = document.getElementById('step-1-text');
            const text2 = document.getElementById('step-2-text');

            if (step1Div && step2Div) {
                step1Div.classList.remove('hidden');
                step2Div.classList.add('hidden');
                progressBar.style.width = '0%';

                badge1.innerHTML = '1';
                badge1.className = 'w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm';
                text1.className = 'text-sm font-semibold text-white';

                badge2.className = 'w-8 h-8 rounded-full bg-white/10 text-gray-400 flex items-center justify-center font-bold text-sm';
                text2.className = 'text-sm font-medium text-gray-500';

                if (slugInput) {
                    slugInput.value = '';
                    indSuccess.classList.add('hidden');
                    indError.classList.add('hidden');
                    slugFeedback.classList.add('hidden');
                    reserveBtn.disabled = true;
                }
            }
        });
    }

    // Status polling functions
    function startPolling() {
        stopPolling();
        pollStatus(); // Immediate poll
        pollInterval = setInterval(pollStatus, 3000); // Every 3 seconds
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function pollStatus() {
        if (!currentSessionToken) return;

        try {
            const response = await fetch(`/api/session/${currentSessionToken}`);
            if (response.status === 404) {
                // Session expired or invalid
                changeSlugBtn.click();
                showToast("Session expired. Please choose a username again.", "error");
                return;
            }

            const data = await response.json();
            
            // Check if onboarding is complete on server side
            if (data.onboarding_complete) {
                stopPolling();
                localStorage.removeItem('idme_session_token');
                localStorage.removeItem('idme_slug');
                window.location.href = data.profile_url;
                return;
            }

            // Update UI card elements based on verifications
            let verifiedCount = 0;

            data.verifications.forEach(v => {
                if (v.status === 'verified') {
                    verifiedCount++;
                    const card = document.getElementById(`platform-card-${v.platform}`);
                    const statusText = document.getElementById(`platform-status-${v.platform}`);
                    const connBtn = document.getElementById(`connect-btn-${v.platform}`);

                    if (card) card.classList.add('platform-connected');
                    if (statusText) statusText.innerHTML = `<span class="text-emerald-400">Verified as @${v.username}</span>`;
                    
                    if (connBtn) {
                        connBtn.innerText = 'Connected';
                        connBtn.classList.add('pointer-events-none', 'opacity-50');
                        if (connBtn.tagName === 'A') {
                            connBtn.removeAttribute('href');
                        }
                    }
                }
            });

            // Enable complete button if at least one verified
            const completeBtn = document.getElementById('complete-btn');
            if (completeBtn) {
                completeBtn.disabled = (verifiedCount === 0);
            }

        } catch (err) {
            console.error('Error polling verification status:', err);
        }
    }

    // Complete Onboarding button click
    const completeBtn = document.getElementById('complete-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', async () => {
            if (!currentSessionToken) return;
            completeBtn.disabled = true;

            try {
                const response = await fetch(`/api/complete/${currentSessionToken}`, {
                    method: 'POST'
                });
                const data = await response.json();

                if (data.success) {
                    stopPolling();
                    localStorage.removeItem('idme_session_token');
                    localStorage.removeItem('idme_slug');
                    showToast('Identity verified successfully!');
                    setTimeout(() => {
                        window.location.href = data.profile_url;
                    }, 500);
                } else {
                    showToast(data.detail || 'Onboarding failed', 'error');
                    completeBtn.disabled = false;
                }
            } catch (err) {
                showToast('Failed to complete onboarding', 'error');
                completeBtn.disabled = false;
            }
        });
    }

    // ── 3. WhatsApp Modal Controls ──────────────────────────
    const waOpenBtn = document.getElementById('connect-btn-whatsapp');
    const waModal = document.getElementById('whatsapp-modal');
    const waCloseBtn = document.getElementById('whatsapp-close-btn');
    
    const waInputStep = document.getElementById('whatsapp-step-input');
    const waActionStep = document.getElementById('whatsapp-step-action');
    const waPhoneInput = document.getElementById('whatsapp-phone');
    const waPhoneFeedback = document.getElementById('whatsapp-phone-feedback');
    const waSubmitBtn = document.getElementById('whatsapp-submit-btn');

    const waCodeDisplay = document.getElementById('whatsapp-code-display');
    const waChatLink = document.getElementById('whatsapp-chat-link');
    const waConfirmBtn = document.getElementById('whatsapp-confirm-btn');

    let activeWaCode = null;

    if (waOpenBtn && waModal) {
        waOpenBtn.addEventListener('click', () => {
            if (!currentSessionToken) {
                showToast('Session not initialized. Claim username first.', 'error');
                return;
            }
            // Clear fields
            waPhoneInput.value = '';
            waPhoneFeedback.classList.add('hidden');
            
            // Show input step
            waInputStep.classList.remove('hidden');
            waActionStep.classList.add('hidden');
            waModal.classList.remove('hidden');
        });
    }

    if (waCloseBtn) {
        waCloseBtn.addEventListener('click', () => {
            waModal.classList.add('hidden');
        });
    }

    if (waSubmitBtn) {
        waSubmitBtn.addEventListener('click', async () => {
            const phone = waPhoneInput.value.trim();
            // Basic check matching backend validation
            const clean = phone.replace(/[\s\-\(\)]/g, '');
            const regex = /^\+?[1-9]\d{6,14}$/;
            if (!regex.test(clean)) {
                waPhoneFeedback.textContent = 'Invalid phone number format. Include country code (e.g. +447911123456).';
                waPhoneFeedback.classList.remove('hidden');
                return;
            }
            waPhoneFeedback.classList.add('hidden');
            waSubmitBtn.disabled = true;

            try {
                const response = await fetch('/api/whatsapp/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: clean,
                        session_token: currentSessionToken
                    })
                });
                const data = await response.json();

                if (data.success) {
                    activeWaCode = data.code;
                    waCodeDisplay.innerText = `IDme-verify-${data.code}`;
                    waChatLink.href = data.verification_link;

                    // Transition modal view
                    waInputStep.classList.add('hidden');
                    waActionStep.classList.remove('hidden');
                } else {
                    showToast(data.detail || 'Failed to start WhatsApp verification', 'error');
                }
            } catch (err) {
                showToast('Could not initiate verification', 'error');
            } finally {
                waSubmitBtn.disabled = false;
            }
        });
    }

    if (waConfirmBtn) {
        waConfirmBtn.addEventListener('click', async () => {
            if (!activeWaCode) return;
            waConfirmBtn.disabled = true;

            try {
                const response = await fetch(`/api/whatsapp/confirm/${activeWaCode}`, {
                    method: 'POST'
                });
                const data = await response.json();

                if (data.success) {
                    waModal.classList.add('hidden');
                    showToast('WhatsApp verification verified!');
                    
                    // Poll immediately to update cards
                    pollStatus();
                } else {
                    showToast(data.detail || 'Verification confirmation failed', 'error');
                }
            } catch (err) {
                showToast('Error confirming verification', 'error');
            } finally {
                waConfirmBtn.disabled = false;
            }
        });
    }


    // ── 4. Session Recovery & Callback Handling ─────────────
    if (window.location.pathname === '/create') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlSession = urlParams.get('session');
        const urlError = urlParams.get('error');

        // Show toast error if return from OAuth failed
        if (urlError) {
            let errorMsg = 'Verification failed.';
            if (urlError === 'invalid_state') errorMsg = 'OAuth security check failed. Try again.';
            if (urlError === 'github_auth_failed') errorMsg = 'GitHub authorization failed.';
            if (urlError === 'linkedin_auth_failed') errorMsg = 'LinkedIn authorization failed.';
            if (urlError === 'facebook_auth_failed') errorMsg = 'Facebook authorization failed.';
            showToast(errorMsg, 'error');
        }

        // Recover session: URL param takes precedence, fallback to localStorage
        let activeToken = urlSession || localStorage.getItem('idme_session_token');
        let activeSlug = localStorage.getItem('idme_slug');

        if (activeToken) {
            currentSessionToken = activeToken;
            currentSlug = activeSlug;
            
            // Clean up the URL to hide session tokens
            if (urlSession || urlError) {
                window.history.replaceState({}, document.title, "/create");
            }

            // Put session back to localStorage
            localStorage.setItem('idme_session_token', currentSessionToken);
            if (currentSlug) {
                localStorage.setItem('idme_slug', currentSlug);
            }

            // Check details and fetch oauth links for this session
            // Call API create with same slug is idempotent and returns session/oauth details
            // However, we can also reconstruct oauth links because we know the session token
            // Wait, we can fetch session status first.
            fetchSessionAndRun();
        }
    }

    async function fetchSessionAndRun() {
        if (!currentSessionToken) return;

        try {
            // First hit status to confirm it works and verify the slug
            const response = await fetch(`/api/session/${currentSessionToken}`);
            if (response.status === 404) {
                // Stale token, clear it
                localStorage.removeItem('idme_session_token');
                localStorage.removeItem('idme_slug');
                currentSessionToken = null;
                currentSlug = null;
                return;
            }
            const data = await response.json();
            currentSlug = data.slug;
            localStorage.setItem('idme_slug', currentSlug);

            if (data.oauth_urls) {
                oauthUrls = data.oauth_urls;
            }
            
            goToStep2();
        } catch (err) {
            console.error('Error restoring session:', err);
        }
    }
});

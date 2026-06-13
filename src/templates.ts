export function renderBase(title: string, content: string, ogMeta?: any): string {
  const metaTags = ogMeta ? `
    <meta name="description" content="${ogMeta['og:description'] || ''}">
    <meta property="og:title" content="${ogMeta['og:title'] || ''}">
    <meta property="og:description" content="${ogMeta['og:description'] || ''}">
    <meta property="og:url" content="${ogMeta['og:url'] || ''}">
    <meta property="og:type" content="${ogMeta['og:type'] || ''}">
    <meta property="og:site_name" content="${ogMeta['og:site_name'] || ''}">
    <meta name="twitter:card" content="${ogMeta['twitter:card'] || ''}">
    <meta name="twitter:title" content="${ogMeta['twitter:title'] || ''}">
    <meta name="twitter:description" content="${ogMeta['twitter:description'] || ''}">
  ` : `
    <meta name="description" content="A signup-less web portal where anyone connects their platforms via OAuth and gets a verified identity page. One link, fully verified.">
    <meta property="og:title" content="IDme — One verified link for all your work">
    <meta property="og:description" content="A signup-less web portal where anyone connects their platforms via OAuth and gets a verified identity page. One link, fully verified.">
    <meta property="og:type" content="website">
  `;

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/png" href="/static/images/logo.png">
    ${metaTags}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body class="bg-[#030712] text-gray-100 font-sans antialiased h-full flex flex-col overflow-x-hidden selection:bg-blue-600 selection:text-white">
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div class="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div class="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-purple-600/10 blur-[120px]"></div>
        <div class="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-600/5 blur-[100px]"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#030712_80%)]"></div>
        <div class="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
    </div>
    <header class="relative z-10 border-b border-white/5 bg-[#030712]/50 backdrop-blur-md">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="/" class="flex items-center gap-2.5 group">
                <img src="/static/images/logo.png" alt="IDme Logo" class="w-9 h-9 rounded-xl shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 object-cover">
                <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">IDme</span>
            </a>
            <nav class="flex items-center gap-4">
                <a href="/create" class="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-800 transition-all duration-300">
                    <span class="relative px-5 py-2 transition-all ease-in duration-75 bg-gray-900 rounded-md group-hover:bg-opacity-0">
                        Create Your IDme
                    </span>
                </a>
            </nav>
        </div>
    </header>
    <main class="relative z-10 flex-grow flex flex-col justify-center">
        ${content}
    </main>
    <footer class="relative z-10 border-t border-white/5 py-8 mt-12 bg-[#030712]/30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-sm text-gray-500">
                &copy; ${new Date().getFullYear()} IDme. One verified link for all your work.
            </div>
            <div class="flex gap-6 text-sm text-gray-400">
                <a href="#" class="hover:text-white transition-colors">Privacy</a>
                <a href="#" class="hover:text-white transition-colors">Terms</a>
                <a href="/health" class="hover:text-white transition-colors">Status</a>
            </div>
        </div>
    </footer>
    <div id="toast-container" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2"></div>
    <script src="/static/js/app.js"></script>
</body>
</html>`;
}

export function renderIndex(): string {
  const content = `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 flex flex-col items-center justify-center text-center">
    <div class="relative z-10 max-w-3xl mx-auto mb-16">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Zero Signups. 100% Verified.
        </div>
        <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            One verified link for <br>
            <span class="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
                all your work
            </span>
        </h1>
        <p class="text-lg sm:text-xl text-gray-400 font-normal mb-10 max-w-2xl mx-auto leading-relaxed">
            Connect your Github, LinkedIn, Facebook, and WhatsApp. Showcase a unified trust score and prove you are who you say you are, without passwords or usernames to remember.
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/create" class="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                Create Your IDme Page
            </a>
            <a href="#how-it-works" class="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl backdrop-blur-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                How It Works
            </a>
        </div>
    </div>

    <div class="relative w-full max-w-4xl mx-auto rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl shadow-2xl mb-32 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
        <div class="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
            <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-red-500/60"></span>
                <span class="w-3 h-3 rounded-full bg-yellow-500/60"></span>
                <span class="w-3 h-3 rounded-full bg-green-500/60"></span>
            </div>
            <div class="text-xs text-gray-500 font-mono bg-white/5 px-4 py-1.5 rounded-lg">idme.io/alex</div>
            <div class="w-16"></div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div class="md:col-span-2 flex flex-col justify-between">
                <div class="flex items-start gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold">
                        A
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                            Alex Morgan
                            <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <polyline points="9 12 11 14 15 10"/>
                            </svg>
                        </h3>
                        <p class="text-sm text-gray-400">Software Engineer & Tech Lead</p>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                <span class="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
                                Live Verification
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mt-8">
                    <div class="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-200">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">GitHub</p>
                            <p class="text-sm font-semibold text-white">@alexm</p>
                        </div>
                    </div>
                    
                    <div class="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-400">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">LinkedIn</p>
                            <p class="text-sm font-semibold text-white">Alex Morgan</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/5 rounded-2xl text-center">
                <div class="relative w-36 h-36 flex items-center justify-center mb-4">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="72" cy="72" r="62" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="transparent" />
                        <circle cx="72" cy="72" r="62" stroke="url(#blue-grad)" stroke-width="8" fill="transparent" 
                                stroke-dasharray="390" stroke-dashoffset="58" stroke-linecap="round" />
                        <defs>
                            <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#3b82f6" />
                                <stop offset="100%" stop-color="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div class="absolute flex flex-col items-center justify-center">
                        <span class="text-3xl font-extrabold text-white">85</span>
                        <span class="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Trust Score</span>
                    </div>
                </div>
                <h4 class="text-sm font-bold text-white mb-1">Excellent Integrity</h4>
                <p class="text-xs text-gray-500">Consistent naming and established account history.</p>
            </div>
        </div>
    </div>

    <div id="how-it-works" class="w-full py-16 scroll-mt-10">
        <h2 class="text-3xl font-bold text-white mb-4">How IDme Works</h2>
        <p class="text-gray-400 max-w-xl mx-auto mb-16">Designed for simplicity, speed, and cryptographic verification.</p>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.04] transition-all duration-300 text-left flex flex-col justify-between group">
                <div>
                    <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-3">1. Reserve Username</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        Pick your slug (e.g. \`idme.io/yourname\`). No signups, no forms, no passwords. An ephemeral cryptographic session handles your registration.
                    </p>
                </div>
            </div>

            <div class="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.04] transition-all duration-300 text-left flex flex-col justify-between group">
                <div>
                    <div class="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-6 group-hover:scale-110 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-3">2. Connect Platforms</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        Authorise platform access via OAuth callbacks or WhatsApp links. IDme queries profile metadata directly from the source APIs to verify ownership.
                    </p>
                </div>
            </div>

            <div class="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all duration-300 text-left flex flex-col justify-between group">
                <div>
                    <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-3">3. Claim Verification</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        Once verified, lock your profile. Share one consolidated link, embed your score badge on other sites, or use your QR code for physical interactions.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>`;

  return renderBase("IDme — One verified link for all your work", content);
}

export function renderCreate(): string {
  const content = `<div class="max-w-xl mx-auto px-4 py-12 flex-grow flex flex-col justify-center">
    <div class="relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
        
        <div class="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
            <div class="flex items-center gap-3">
                <div id="step-1-badge" class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm transition-all duration-300">1</div>
                <span id="step-1-text" class="text-sm font-semibold text-white">Choose Slug</span>
            </div>
            <div class="flex-grow mx-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div id="step-progress-bar" class="h-full bg-gradient-to-r from-blue-500 to-violet-500 w-[0%] transition-all duration-500"></div>
            </div>
            <div class="flex items-center gap-3">
                <div id="step-2-badge" class="w-8 h-8 rounded-full bg-white/10 text-gray-400 flex items-center justify-center font-bold text-sm transition-all duration-300">2</div>
                <span id="step-2-text" class="text-sm font-medium text-gray-500">Verify Identity</span>
            </div>
        </div>

        <div id="wizard-step-1" class="transition-opacity duration-300">
            <h2 class="text-2xl font-bold text-white mb-2">Claim your identity URL</h2>
            <p class="text-sm text-gray-400 mb-6">Choose a unique handle. This will be the public address of your verified profile page.</p>
            
            <div class="space-y-4">
                <div>
                    <label for="slug-input" class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Username / Handle</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500 font-mono text-sm pointer-events-none">idme.io/</span>
                        <input type="text" id="slug-input" class="w-full pl-[68px] pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl font-mono text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="username" autocomplete="off" spellcheck="false">
                        
                        <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                            <span id="slug-indicator-loading" class="hidden animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-blue-500"></span>
                            <svg id="slug-indicator-success" class="hidden w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <svg id="slug-indicator-error" class="hidden w-5 h-5 text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    </div>
                    <p id="slug-feedback" class="mt-2 text-xs text-red-400 hidden"></p>
                </div>
                
                <button type="button" id="reserve-btn" class="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" disabled>
                    Reserve Handle & Continue
                </button>
            </div>
        </div>

        <div id="wizard-step-2" class="hidden transition-opacity duration-300">
            <div class="flex items-center justify-between mb-2">
                <h2 class="text-2xl font-bold text-white">Verify who you are</h2>
                <button type="button" id="change-slug-btn" class="text-xs text-gray-500 hover:text-white transition-colors">Change URL</button>
            </div>
            <p class="text-sm text-gray-400 mb-6">Connect at least one platform to verify your identity. The more platforms you verify, the higher your Trust Score.</p>
            
            <div id="platform-list" class="space-y-3.5 mb-8">
                <div id="platform-card-github" class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all duration-300">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-300">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-white">GitHub</h4>
                            <p class="text-xs text-gray-500" id="platform-status-github">Not connected</p>
                        </div>
                    </div>
                    <a id="connect-btn-github" href="#" class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors">Connect</a>
                </div>

                <div id="platform-card-linkedin" class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all duration-300">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-white">LinkedIn</h4>
                            <p class="text-xs text-gray-500" id="platform-status-linkedin">Not connected</p>
                        </div>
                    </div>
                    <a id="connect-btn-linkedin" href="#" class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors">Connect</a>
                </div>

                <div id="platform-card-facebook" class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all duration-300">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-blue-800/10 flex items-center justify-center text-blue-500">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-white">Facebook</h4>
                            <p class="text-xs text-gray-500" id="platform-status-facebook">Not connected</p>
                        </div>
                    </div>
                    <a id="connect-btn-facebook" href="#" class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors">Connect</a>
                </div>

                <div id="platform-card-whatsapp" class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all duration-300">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-400">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.167 1.455 4.773 1.456 5.253 0 9.526-4.272 9.53-9.53.002-2.546-.99-4.94-2.793-6.746a9.467 9.467 0 00-6.737-2.793C6.166 1.54 1.897 5.812 1.893 11.07c-.001 1.714.453 3.39 1.317 4.887l-.995 3.635 3.732-.98.1 0z"/></svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-white">WhatsApp</h4>
                            <p class="text-xs text-gray-500" id="platform-status-whatsapp">Not connected</p>
                        </div>
                    </div>
                    <button type="button" id="connect-btn-whatsapp" class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors">Verify</button>
                </div>
            </div>

            <div id="headshot-upload-section" class="p-4 mb-6 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-3.5 transition-all duration-300">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-white">Professional Headshot</h4>
                            <p class="text-xs text-gray-500" id="headshot-status">Optional custom profile picture</p>
                        </div>
                    </div>
                    <div>
                        <input type="file" id="headshot-input" accept="image/*" class="hidden">
                        <button type="button" id="headshot-upload-btn" class="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors">Upload Image</button>
                    </div>
                </div>
                <div id="headshot-preview-container" class="hidden flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-lg">
                    <img id="headshot-preview" src="#" alt="Headshot Preview" class="w-12 h-12 rounded-full object-cover border border-white/10">
                    <span class="text-xs text-emerald-400">Headshot uploaded successfully!</span>
                </div>
            </div>

            <button type="button" id="complete-btn" class="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" disabled>
                Complete Identity Setup
            </button>
        </div>
    </div>
</div>

<div id="whatsapp-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
    <div class="relative bg-[#0d1321] border border-white/10 p-8 rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
        <button type="button" id="whatsapp-close-btn" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        
        <div id="whatsapp-step-input">
            <h3 class="text-xl font-bold text-white mb-2">Verify via WhatsApp</h3>
            <p class="text-sm text-gray-400 mb-6 font-normal">We'll generate a click-to-chat link. You'll send a pre-filled code from your phone to verify control.</p>
            <div class="space-y-4">
                <div>
                    <label for="whatsapp-phone" class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">WhatsApp Phone Number</label>
                    <input type="tel" id="whatsapp-phone" class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" placeholder="+44 7911 123456">
                    <p id="whatsapp-phone-feedback" class="mt-2 text-xs text-red-400 hidden"></p>
                </div>
                <button type="button" id="whatsapp-submit-btn" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all">
                    Generate Verification Link
                </button>
            </div>
        </div>
        
        <div id="whatsapp-step-action" class="hidden text-center">
            <h3 class="text-xl font-bold text-white mb-2">Send WhatsApp Message</h3>
            <p class="text-sm text-gray-400 mb-6 font-normal">Click the link below to open WhatsApp and send the pre-filled verification code.</p>
            <div class="bg-white/5 border border-white/10 p-4 rounded-xl font-mono text-white text-lg font-bold mb-6 tracking-widest relative group">
                <span id="whatsapp-code-display">IDme-verify-xxxx</span>
            </div>
            <div class="space-y-3">
                <a id="whatsapp-chat-link" href="#" target="_blank" class="block w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors">
                    Open WhatsApp Chat
                </a>
                <button type="button" id="whatsapp-confirm-btn" class="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl transition-colors">
                    I Have Sent The Message
                </button>
            </div>
        </div>
    </div>
</div>`;

  return renderBase("IDme — Verify Your Identity", content);
}

export function renderProfile(
  user: any,
  verifications: any,
  trustScore: number,
  trustBreakdown: any,
  customAvatar: string | null,
  profileUrl: string,
  jsonLd: string,
  ogMeta?: any
): string {
  const avatarHtml = customAvatar
    ? `<img src="${customAvatar}" alt="${user.display_name || user.slug}" class="relative w-24 h-24 rounded-full object-cover border border-white/10">`
    : verifications.github && verifications.github.metadata.avatar_url
    ? `<img src="${verifications.github.metadata.avatar_url}" alt="${user.display_name || user.slug}" class="relative w-24 h-24 rounded-full object-cover border border-white/10">`
    : verifications.linkedin && verifications.linkedin.metadata.picture
    ? `<img src="${verifications.linkedin.metadata.picture}" alt="${user.display_name || user.slug}" class="relative w-24 h-24 rounded-full object-cover border border-white/10">`
    : verifications.facebook && verifications.facebook.metadata.avatar_url
    ? `<img src="${verifications.facebook.metadata.avatar_url}" alt="${user.display_name || user.slug}" class="relative w-24 h-24 rounded-full object-cover border border-white/10">`
    : `<div class="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-3xl font-extrabold border border-white/10">${(user.display_name || user.slug)[0].toUpperCase()}</div>`;

  let verificationsList = "";

  if (verifications.github) {
    const meta = verifications.github.metadata;
    verificationsList += `
      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between">
          <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-300 mt-0.5">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </div>
              <div class="text-left">
                  <h4 class="text-sm font-bold text-white">GitHub</h4>
                  <p class="text-xs text-gray-400 mb-1">Username: @${verifications.github.username}</p>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2 font-mono">
                      <span>${meta.public_repos || 0} repositories</span>
                      <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span>${meta.followers || 0} followers</span>
                      ${meta.created_at ? `
                      <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span>Member since ${meta.created_at.slice(0, 4)}</span>
                      ` : ''}
                  </div>
              </div>
          </div>
          ${meta.html_url ? `
          <a href="${meta.html_url}" target="_blank" rel="noopener" class="text-gray-500 hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
          </a>
          ` : ''}
      </div>`;
  }

  if (verifications.linkedin) {
    const meta = verifications.linkedin.metadata;
    verificationsList += `
      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between">
          <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 mt-0.5">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </div>
              <div class="text-left">
                  <h4 class="text-sm font-bold text-white">LinkedIn</h4>
                  <p class="text-xs text-gray-400">Verified User: ${meta.given_name || ''} ${meta.family_name || ''}</p>
                  <div class="flex items-center gap-1.5 text-xs text-gray-500 mt-2 font-mono">
                      <span>Authenticated via OpenID Connect</span>
                  </div>
              </div>
          </div>
      </div>`;
  }

  if (verifications.facebook) {
    const meta = verifications.facebook.metadata;
    verificationsList += `
      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between">
          <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-blue-800/10 flex items-center justify-center text-blue-500 mt-0.5">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <div class="text-left">
                  <h4 class="text-sm font-bold text-white">Facebook</h4>
                  <p class="text-xs text-gray-400">Verified Username: ${verifications.facebook.username}</p>
                  <div class="flex items-center gap-1.5 text-xs text-gray-500 mt-2 font-mono">
                      <span>Connected Profile</span>
                  </div>
              </div>
          </div>
          ${meta.profile_url ? `
          <a href="${meta.profile_url}" target="_blank" rel="noopener" class="text-gray-500 hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
          </a>
          ` : ''}
      </div>`;
  }

  if (verifications.whatsapp) {
    const meta = verifications.whatsapp.metadata;
    verificationsList += `
      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start justify-between">
          <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-400 mt-0.5">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.167 1.455 4.773 1.456 5.253 0 9.526-4.272 9.53-9.53.002-2.546-.99-4.94-2.793-6.746a9.467 9.467 0 00-6.737-2.793C6.166 1.54 1.897 5.812 1.893 11.07c-.001 1.714.453 3.39 1.317 4.887l-.995 3.635 3.732-.98.1 0z"/></svg>
              </div>
              <div class="text-left">
                  <h4 class="text-sm font-bold text-white">WhatsApp</h4>
                  <p class="text-xs text-gray-400">Phone Verification Hash: <span class="font-mono">${meta.phone_hash || 'Verified'}</span></p>
                  <div class="flex items-center gap-1.5 text-xs text-gray-500 mt-2 font-mono">
                      <span>Verified Mobile Number Owner</span>
                  </div>
              </div>
          </div>
      </div>`;
  }

  const content = `<div class="max-w-4xl mx-auto px-4 py-12 flex-grow w-full">
    <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl shadow-2xl overflow-hidden relative">
        <div class="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none"></div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:border-r md:border-white/5 md:pr-8 flex flex-col items-center md:items-start text-center md:text-left">
                <div class="relative mb-5 group">
                    <div class="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 blur opacity-40 group-hover:opacity-60 transition duration-300"></div>
                    ${avatarHtml}
                </div>

                <h1 class="text-2xl font-bold text-white flex items-center justify-center md:justify-start gap-2 mb-1">
                    ${user.display_name || user.slug}
                    <svg class="w-6 h-6 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <polyline points="9 12 11 14 15 10"/>
                    </svg>
                </h1>
                
                <p class="text-sm font-mono text-gray-500 mb-4">@${user.slug}</p>

                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-8">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Verified Identity
                </div>

                <div class="w-full flex flex-col items-center mb-6">
                    <div class="relative w-40 h-40 flex items-center justify-center mb-4">
                        <svg class="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="transparent" />
                            <circle id="trust-gauge-circle" cx="80" cy="80" r="70" stroke="url(#score-grad)" stroke-width="8" fill="transparent" 
                                    stroke-dasharray="440" stroke-dashoffset="440" stroke-linecap="round" 
                                    data-score="${trustScore}" class="transition-all duration-[1500ms] ease-out" />
                            <defs>
                                <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#3b82f6" />
                                    <stop offset="100%" stop-color="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="absolute flex flex-col items-center justify-center">
                            <span class="text-4xl font-extrabold text-white">${trustScore}</span>
                            <span class="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Trust Score</span>
                        </div>
                    </div>
                    
                    ${trustScore >= 80 ? `<p class="text-sm font-bold text-emerald-400">Excellent Integrity</p>` :
                      trustScore >= 60 ? `<p class="text-sm font-bold text-blue-400">Strong Integrity</p>` :
                      trustScore >= 40 ? `<p class="text-sm font-bold text-amber-400">Moderate Integrity</p>` :
                      `<p class="text-sm font-bold text-gray-400">Low Integrity</p>`}
                </div>
            </div>

            <div class="md:col-span-2 flex flex-col justify-between">
                <div>
                    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-left">Verified Platforms</h3>
                    <div class="space-y-4">
                        ${verificationsList}
                    </div>
                </div>

                <div class="border-t border-white/5 pt-6 mt-8 space-y-6">
                    <div class="flex flex-wrap gap-3">
                        <button type="button" id="share-profile-btn" data-url="${profileUrl}" class="flex-grow sm:flex-grow-0 px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 10.742l4.636-2.318m0 0a3 3 0 102.243-4.077 3 3 0 00-2.243 4.077zM9.038 9.038A9 9 0 0012 21a9.003 9.003 0 008.361-5.63M9.038 9.038L7.461 7.461" />
                            </svg>
                            Share Profile Link
                        </button>
                        <button type="button" id="qr-toggle-btn" class="px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-16v4m0 4h.01M4 12h.01M4 8h.01M4 16h.01M8 8h.01M8 12h.01M8 16h.01M12 12h.01M12 16h.01M16 12h.01M16 16h.01M16 8h.01" />
                            </svg>
                            View QR Code
                        </button>
                    </div>

                    <div id="qr-container" class="hidden flex flex-col items-center justify-center bg-white/[0.01] border border-white/5 p-6 rounded-xl animate-fade-in">
                        <img src="/${user.slug}/qr" alt="QR Code" class="w-44 h-44 rounded-lg bg-white p-2">
                        <p class="text-xs text-gray-500 mt-3 font-mono">Scan to view profile</p>
                    </div>

                    <div class="text-left">
                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Embeddable Trust Badge</label>
                        <div class="flex gap-2">
                            <input type="text" id="badge-code" readonly value="&lt;script src=&quot;${profileUrl}/badge.js&quot;&gt;&lt;/script&gt;" class="flex-grow px-3 py-2 bg-white/5 border border-white/10 rounded-lg font-mono text-xs text-gray-400 focus:outline-none">
                            <button type="button" id="copy-badge-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="mt-8 pt-4 border-t border-white/5 text-center text-xs text-gray-600 font-mono">
            First verified on ${user.created_at ? user.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)}
        </div>
    </div>
</div>`;

  // Include JSON-LD and header metas inside extra head block!
  const extraHead = `
    <meta name="ai-agent-accessible" content="true">
    <meta name="ai-agent-optimized" content="true">
    <link rel="alternate" type="application/json" href="${profileUrl}/json">
    <link rel="alternate" type="application/json+ai" href="${profileUrl}/ai">
    <script type="application/ld+json">
    ${jsonLd}
    </script>
  `;

  // We patch the base template with the extra head tag for search crawlers/AI agents
  const base = renderBase(`${user.display_name || user.slug} — Verified IDme Profile`, content, ogMeta);
  return base.replace('</head>', `${extraHead}</head>`);
}

export function renderNotFound(slug: string): string {
  const content = `<div class="max-w-md mx-auto px-4 py-20 text-center">
    <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 mx-auto mb-6 border border-white/10">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    </div>
    <h2 class="text-2xl font-bold text-white mb-2">Profile Not Found</h2>
    <p class="text-gray-400 mb-8 font-normal text-sm leading-relaxed">The profile page for "@${slug}" does not exist or onboarding was not completed.</p>
    <a href="/" class="inline-flex px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm rounded-xl transition-all">Go Home</a>
  </div>`;
  return renderBase("Profile Not Found — IDme", content);
}

export function renderError(message: string): string {
  const content = `<div class="max-w-md mx-auto px-4 py-20 text-center">
    <div class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/20">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    </div>
    <h2 class="text-2xl font-bold text-white mb-2">An Error Occurred</h2>
    <p class="text-gray-400 mb-8 font-normal text-sm leading-relaxed">${message}</p>
    <a href="/" class="inline-flex px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm rounded-xl transition-all">Go Home</a>
  </div>`;
  return renderBase("Error — IDme", content);
}

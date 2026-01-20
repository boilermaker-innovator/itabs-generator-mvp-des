/* ============================================
   iTabs AI Assistant - Advanced Version
   Intelligent, learning chat assistant
   ============================================ */

(function() {
    'use strict';

    // ==========================================
    // STATE MANAGEMENT
    // ==========================================
    
    const STATE = {
        isOpen: false,
        isProfileOpen: false,
        currentStep: 1,
        hasUnread: true,
        isTyping: false,
        isLearning: false,
        detectedContentType: null,
        sessionStartTime: Date.now(),
        messagesThisSession: 0
    };

    // ==========================================
    // USER PROFILE & LEARNING SYSTEM
    // ==========================================
    
    const DEFAULT_PROFILE = {
        // User identity
        totalSessions: 0,
        totalGuidesCreated: 0,
        firstVisit: null,
        lastVisit: null,
        
        // Content patterns
        contentTypes: {}, // { "meeting": 5, "training": 3, ... }
        preferredTabCount: null,
        commonTabNames: [], // Most used tab names
        
        // Behavior patterns
        averageEditTime: 0,
        sectionsUsuallyAdded: 0,
        sectionsUsuallyRemoved: 0,
        usesTimestamps: false,
        usesClientBranding: false,
        
        // Successful patterns (saved by user)
        savedStructures: [], // { name, tabCount, tabNames, contentType }
        
        // Helpful suggestions tracking
        suggestionsAccepted: {},
        suggestionsDismissed: {},
        
        // Preferences
        preferredBrandColor: null,
        preferredAudience: null,
        commonGoals: []
    };

    let userProfile = { ...DEFAULT_PROFILE };

    // ==========================================
    // CONTENT TYPE DETECTION
    // ==========================================
    
    const CONTENT_PATTERNS = {
        meeting: {
            keywords: ['meeting', 'agenda', 'minutes', 'action item', 'attendee', 'discussed', 'decided', 'follow up', 'next steps'],
            icon: '📋',
            label: 'Meeting Notes',
            suggestedStructure: ['Key Decisions', 'Action Items', 'Discussion Points', 'Next Steps', 'Attendees']
        },
        training: {
            keywords: ['training', 'lesson', 'module', 'learn', 'exercise', 'practice', 'skill', 'certificate', 'course'],
            icon: '🎓',
            label: 'Training Material',
            suggestedStructure: ['Overview', 'Key Concepts', 'Step-by-Step', 'Practice Exercise', 'Summary']
        },
        tutorial: {
            keywords: ['how to', 'step 1', 'step 2', 'tutorial', 'guide', 'instructions', 'setup', 'install', 'configure'],
            icon: '📖',
            label: 'Tutorial',
            suggestedStructure: ['Prerequisites', 'Steps', 'Common Issues', 'Tips', 'Next Steps']
        },
        report: {
            keywords: ['report', 'analysis', 'findings', 'data', 'results', 'metrics', 'quarterly', 'annual', 'performance'],
            icon: '📊',
            label: 'Report',
            suggestedStructure: ['Executive Summary', 'Key Findings', 'Data Analysis', 'Recommendations', 'Appendix']
        },
        presentation: {
            keywords: ['slide', 'presentation', 'deck', 'pitch', 'keynote', 'audience', 'speaker notes'],
            icon: '📽️',
            label: 'Presentation',
            suggestedStructure: ['Introduction', 'Main Points', 'Supporting Data', 'Call to Action', 'Q&A Prep']
        },
        video: {
            keywords: ['[00:', 'timestamp', 'youtube', 'video', 'watch', 'clip', 'footage'],
            icon: '🎬',
            label: 'Video Content',
            suggestedStructure: ['Overview', 'Key Moments', 'Main Takeaways', 'Action Items', 'Resources']
        }
    };

    // ==========================================
    // STEP CONFIGURATION
    // ==========================================
    
    const STEP_CONFIG = {
        1: {
            context: "Step 1: Setup",
            greeting: "👋 Welcome back! Ready to create another great guide?",
            firstTimeGreeting: "👋 Hi there! I'm your iTabs assistant. I'll help you create interactive guides and learn your preferences over time.",
            tips: [
                "You need a <strong>free Gemini API key</strong> to get started.",
                "Your key is stored <strong>only in your browser</strong> - completely private.",
                "Takes about 30 seconds to get one from Google."
            ],
            quickReplies: ["How do I get a key?", "Is it really free?", "Is my data safe?"]
        },
        2: {
            context: "Step 2: Add Content",
            greeting: "Great! Now paste your content. I'll analyze it and suggest the best structure.",
            tips: [
                "<strong>Best content:</strong> Meeting notes, training videos, tutorials, reports.",
                "YouTube URLs will auto-embed with <strong>clickable timestamps</strong>.",
                "I'll detect your content type and suggest smart structures."
            ],
            quickReplies: ["What works best?", "Get transcript help", "Explain timestamps"]
        },
        3: {
            context: "Step 3: Edit & Polish",
            greeting: "Your guide is ready! Review the sections - I can suggest improvements based on what's worked before.",
            tips: [
                "Click any section to <strong>expand and edit</strong>.",
                "<strong>Key Points</strong> are what readers remember most.",
                "Use Preview to see exactly how it looks."
            ],
            quickReplies: ["Improve my titles", "Add more sections", "Preview help"]
        },
        4: {
            context: "Step 4: Download & Share",
            greeting: "Excellent work! Your guide is ready to share with the world.",
            tips: [
                "Works <strong>anywhere</strong> - websites, GitHub Pages, email.",
                "Save this structure for future guides with similar content."
            ],
            quickReplies: ["How to host?", "Save this structure", "Create another"]
        }
    };

    // ==========================================
    // SMART ACTIONS CONFIGURATION
    // ==========================================
    
    const SMART_ACTIONS = {
        universal: [
            { id: 'learn', icon: '🧠', label: 'Learn from this session', action: 'learnSession' }
        ],
        step2: [
            { id: 'detectType', icon: '🔍', label: 'Detect content type', action: 'detectContentType' },
            { id: 'suggestAudience', icon: '👥', label: 'Suggest audience', action: 'suggestAudience' }
        ],
        step3: [
            { id: 'betterNames', icon: '✏️', label: 'Suggest better tab names', action: 'suggestTabNames' },
            { id: 'optimize', icon: '📱', label: 'Optimize for mobile', action: 'optimizeMobile' },
            { id: 'professional', icon: '💼', label: 'Make more professional', action: 'makeProfessional' },
            { id: 'applyPrevious', icon: '📋', label: 'Apply previous structure', action: 'applyPreviousStructure', requiresHistory: true }
        ],
        contentSpecific: {
            meeting: [
                { id: 'actionItems', icon: '✅', label: 'Structure as action items', action: 'structureAsActions' }
            ],
            training: [
                { id: 'quizFormat', icon: '❓', label: 'Add quiz sections', action: 'addQuizSections' }
            ],
            tutorial: [
                { id: 'numbered', icon: '🔢', label: 'Number all steps', action: 'numberSteps' }
            ],
            report: [
                { id: 'executive', icon: '📝', label: 'Add executive summary', action: 'addExecutiveSummary' }
            ]
        }
    };

    // ==========================================
    // RESPONSE DATABASE
    // ==========================================
    
    const RESPONSES = {
        // Step 1
        "how do i get a key": "Easy! Click <strong>'Get your key'</strong> below the input. Sign in with Google, click 'Create API Key' - done in 30 seconds.",
        "is it really free": "Yes! Gemini's free tier is generous. You'd need to create hundreds of guides daily to hit any limits.",
        "is my data safe": "Absolutely. Your API key stays in <strong>your browser only</strong>. Your content is processed directly with Google's API - we never see it.",
        
        // Step 2
        "what works best": "Great content for iTabs:<br>• <strong>Meeting recordings</strong> → Action item guides<br>• <strong>Training videos</strong> → Quick reference cards<br>• <strong>Tutorials</strong> → Step-by-step checklists<br>• <strong>Reports</strong> → Executive summaries",
        "get transcript help": "For <strong>YouTube</strong>: Paste URL, click 'Get Transcript'.<br>For <strong>other videos</strong>: Try Otter.ai or Descript.<br>For <strong>meetings</strong>: Most video call apps can export transcripts.",
        "explain timestamps": "Timestamps like <strong>[00:01:23]</strong> become clickable links. Tap one in your final guide → video jumps to that moment. Perfect for training content!",
        
        // Step 3
        "improve my titles": "I'll analyze your sections and suggest clearer, more actionable titles. Want me to do that now?",
        "add more sections": "Click <strong>'+ Add Section'</strong> below. Aim for 4-6 sections - enough to be comprehensive but not overwhelming.",
        "preview help": "Click <strong>'👁️ Preview'</strong> to see exactly how your guide will look. Check it on mobile too!",
        
        // Step 4
        "how to host": "Easiest options:<br>1. <strong>GitHub Pages</strong> (free) - upload as index.html<br>2. <strong>Netlify</strong> - drag & drop<br>3. <strong>Email directly</strong> - HTML works offline!",
        "save this structure": "I'll remember this structure for future guides with similar content. Next time, you can apply it with one click!",
        "create another": "Click <strong>'← Back'</strong> to Step 2 with fresh content. Your API key is saved!",
        
        // Fallback
        "default": "I'm not sure about that. Here's what I can help with right now:"
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    function init() {
        loadUserProfile();
        createChatHTML();
        attachEventListeners();
        observeStepChanges();
        observeContentChanges();
        
        // Update session tracking
        userProfile.totalSessions++;
        userProfile.lastVisit = new Date().toISOString();
        if (!userProfile.firstVisit) {
            userProfile.firstVisit = userProfile.lastVisit;
        }
        saveUserProfile();
        
        // Show greeting after delay
        setTimeout(() => {
            showGreeting();
        }, 1500);
    }

    // ==========================================
    // LOCAL STORAGE
    // ==========================================
    
    function loadUserProfile() {
        try {
            const saved = localStorage.getItem('itabs_assistant_profile');
            if (saved) {
                userProfile = { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Could not load assistant profile:', e);
        }
    }

    function saveUserProfile() {
        try {
            localStorage.setItem('itabs_assistant_profile', JSON.stringify(userProfile));
        } catch (e) {
            console.warn('Could not save assistant profile:', e);
        }
    }

    function clearUserProfile() {
        userProfile = { ...DEFAULT_PROFILE };
        localStorage.removeItem('itabs_assistant_profile');
        showToast('Profile cleared', 'Your learning data has been reset');
    }

    // ==========================================
    // HTML CREATION
    // ==========================================
    
    function createChatHTML() {
        const isReturning = userProfile.totalSessions > 1;
        
        const chatHTML = `
            <button class="chat-toggle" id="chatToggle" aria-label="Open chat assistant">
                <span class="chat-toggle-icon">💬</span>
                <span class="chat-badge" id="chatBadge">1</span>
                <span class="chat-user-indicator ${isReturning ? '' : 'hidden'}" id="userIndicator">✓</span>
            </button>
            
            <div class="chat-window" id="chatWindow">
                <!-- Profile Panel (hidden by default) -->
                <div class="chat-profile-panel" id="profilePanel">
                    <div class="profile-header">
                        <button class="profile-back" id="profileBack">←</button>
                        <h4>📊 Your Profile</h4>
                    </div>
                    <div class="profile-content" id="profileContent">
                        <!-- Populated dynamically -->
                    </div>
                </div>
                
                <!-- Main Chat -->
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-avatar" id="chatAvatar">🤖</div>
                        <div class="chat-header-text">
                            <h4>iTabs Assistant</h4>
                            <span>Learning your style</span>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="chat-header-btn" id="profileBtn" title="View your profile">👤</button>
                        <button class="chat-header-btn" id="chatClose" title="Close">×</button>
                    </div>
                </div>
                
                <div class="chat-step-context" id="chatContext">
                    <span class="step-label">${STEP_CONFIG[1].context}</span>
                    <span class="content-type" id="contentTypeIndicator"></span>
                </div>
                
                <div class="chat-messages" id="chatMessages"></div>
                
                <div class="chat-smart-actions" id="chatSmartActions">
                    <div class="smart-actions-label">Smart Actions</div>
                    <div class="smart-actions-row" id="smartActionsRow"></div>
                </div>
                
                <div class="chat-quick-replies" id="chatQuickReplies"></div>
                
                <div class="chat-input-area">
                    <textarea class="chat-input" id="chatInput" placeholder="Ask me anything..." rows="1"></textarea>
                    <button class="chat-send" id="chatSend" aria-label="Send">➤</button>
                </div>
            </div>
            
            <div class="learning-toast" id="learningToast">
                <span class="learning-toast-icon">🧠</span>
                <span class="learning-toast-text" id="learningToastText"></span>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }
    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    
    function attachEventListeners() {
        document.getElementById('chatToggle').addEventListener('click', toggleChat);
        document.getElementById('chatClose').addEventListener('click', closeChat);
        document.getElementById('chatSend').addEventListener('click', sendMessage);
        document.getElementById('profileBtn').addEventListener('click', toggleProfile);
        document.getElementById('profileBack').addEventListener('click', closeProfile);
        
        const input = document.getElementById('chatInput');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
        
        document.getElementById('chatQuickReplies').addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-reply')) {
                handleQuickReply(e.target.textContent);
            }
        });
        
        document.getElementById('smartActionsRow').addEventListener('click', (e) => {
            const btn = e.target.closest('.smart-action');
            if (btn) {
                handleSmartAction(btn.dataset.action);
            }
        });
    }

    // ==========================================
    // OBSERVERS
    // ==========================================
    
    function observeStepChanges() {
        const checkStep = () => {
            const activeDot = document.querySelector('.step-dot.active');
            if (activeDot) {
                const text = activeDot.textContent.trim();
                const newStep = text === '✓' ? STATE.currentStep : parseInt(text);
                if (newStep && newStep !== STATE.currentStep && newStep >= 1 && newStep <= 4) {
                    STATE.currentStep = newStep;
                    onStepChange();
                }
            }
        };
        
        const observer = new MutationObserver(checkStep);
        const stepsIndicator = document.querySelector('.steps-indicator');
        if (stepsIndicator) {
            observer.observe(stepsIndicator, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        
        setInterval(checkStep, 1000);
    }

    function observeContentChanges() {
        // Watch for content changes in step 2
        setInterval(() => {
            if (STATE.currentStep === 2) {
                const contentArea = document.getElementById('rawContent');
                if (contentArea && contentArea.value.length > 100) {
                    const detectedType = detectContentType(contentArea.value);
                    if (detectedType !== STATE.detectedContentType) {
                        STATE.detectedContentType = detectedType;
                        onContentTypeDetected(detectedType);
                    }
                }
            }
        }, 2000);
    }

    // ==========================================
    // CONTENT TYPE DETECTION
    // ==========================================
    
    function detectContentType(content) {
        const lowerContent = content.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;
        
        for (const [type, config] of Object.entries(CONTENT_PATTERNS)) {
            let score = 0;
            for (const keyword of config.keywords) {
                if (lowerContent.includes(keyword)) {
                    score++;
                }
            }
            if (score > highestScore) {
                highestScore = score;
                bestMatch = type;
            }
        }
        
        return highestScore >= 2 ? bestMatch : null;
    }

    function onContentTypeDetected(type) {
        if (!type) return;
        
        const config = CONTENT_PATTERNS[type];
        const indicator = document.getElementById('contentTypeIndicator');
        
        indicator.innerHTML = `${config.icon} ${config.label}`;
        indicator.classList.add('detected');
        
        // Track in profile
        userProfile.contentTypes[type] = (userProfile.contentTypes[type] || 0) + 1;
        saveUserProfile();
        
        // Update smart actions
        updateSmartActions();
        
        // Proactive suggestion if chat is open
        if (STATE.isOpen) {
            setTimeout(() => {
                addMessage('assistant', `I detected this looks like <strong>${config.label}</strong>. I can suggest a structure optimized for this type of content.`);
            }, 500);
        }
        
        showToast('Content detected', `Looks like ${config.label}`);
    }

    // ==========================================
    // CHAT CONTROLS
    // ==========================================
    
    function toggleChat() {
        STATE.isOpen = !STATE.isOpen;
        const window = document.getElementById('chatWindow');
        const toggle = document.getElementById('chatToggle');
        const badge = document.getElementById('chatBadge');
        
        window.classList.toggle('open', STATE.isOpen);
        toggle.classList.toggle('active', STATE.isOpen);
        
        if (STATE.isOpen) {
            badge.classList.add('hidden');
            STATE.hasUnread = false;
            document.getElementById('chatInput').focus();
            updateSmartActions();
        }
    }

    function closeChat() {
        STATE.isOpen = false;
        document.getElementById('chatWindow').classList.remove('open');
        document.getElementById('chatToggle').classList.remove('active');
        closeProfile();
    }

    function toggleProfile() {
        STATE.isProfileOpen = !STATE.isProfileOpen;
        document.getElementById('profilePanel').classList.toggle('open', STATE.isProfileOpen);
        document.getElementById('profileBtn').classList.toggle('active', STATE.isProfileOpen);
        
        if (STATE.isProfileOpen) {
            renderProfile();
        }
    }

    function closeProfile() {
        STATE.isProfileOpen = false;
        document.getElementById('profilePanel').classList.remove('open');
        document.getElementById('profileBtn').classList.remove('active');
    }

    // ==========================================
    // STEP CHANGES
    // ==========================================
    
    function onStepChange() {
        updateContext();
        updateQuickReplies();
        updateSmartActions();
        
        if (STATE.isOpen) {
            const config = STEP_CONFIG[STATE.currentStep];
            addMessage('assistant', config.greeting);
        }
        
        // Track guide creation on step 3
        if (STATE.currentStep === 3) {
            userProfile.totalGuidesCreated++;
            saveUserProfile();
        }
    }

    // ==========================================
    // GREETING
    // ==========================================
    
    function showGreeting() {
        const config = STEP_CONFIG[STATE.currentStep];
        const isReturning = userProfile.totalSessions > 1;
        
        let greeting = isReturning ? config.greeting : (config.firstTimeGreeting || config.greeting);
        
        // Personalize for returning users
        if (isReturning && userProfile.totalGuidesCreated > 0) {
            greeting = `👋 Welcome back! You've created <strong>${userProfile.totalGuidesCreated} guides</strong> so far. Ready for another?`;
        }
        
        addMessage('assistant', greeting);
        
        // Add personalized tip
        setTimeout(() => {
            let tip;
            if (isReturning && userProfile.savedStructures.length > 0) {
                tip = `💡 You have <strong>${userProfile.savedStructures.length} saved structures</strong>. I can apply them to new content automatically.`;
            } else {
                tip = config.tips[Math.floor(Math.random() * config.tips.length)];
            }
            addMessage('assistant', tip);
        }, 800);
        
        updateQuickReplies();
        updateSmartActions();
    }

    // ==========================================
    // MESSAGES
    // ==========================================
    
    function addMessage(type, content, options = {}) {
        const messages = document.getElementById('chatMessages');
        const avatar = type === 'assistant' ? '🤖' : (type === 'system' ? '' : '👤');
        
        let insightHTML = '';
        if (options.insightSaved) {
            insightHTML = `<div class="message-insight-saved">✓ Insight saved to your profile</div>`;
        }
        
        const messageHTML = type === 'system' 
            ? `<div class="chat-message system"><div class="message-content">${content}</div></div>`
            : `<div class="chat-message ${type}">
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">${content}${insightHTML}</div>
               </div>`;
        
        messages.insertAdjacentHTML('beforeend', messageHTML);
        messages.scrollTop = messages.scrollHeight;
        
        STATE.messagesThisSession++;
        
        if (!STATE.isOpen && type === 'assistant') {
            STATE.hasUnread = true;
            const badge = document.getElementById('chatBadge');
            badge.textContent = '!';
            badge.classList.remove('hidden');
        }
    }

    function showTyping() {
        if (STATE.isTyping) return;
        STATE.isTyping = true;
        
        const messages = document.getElementById('chatMessages');
        messages.insertAdjacentHTML('beforeend', `
            <div class="chat-message assistant" id="typingIndicator">
                <div class="message-avatar">🤖</div>
                <div class="typing-indicator"><span></span><span></span><span></span></div>
            </div>
        `);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        STATE.isTyping = false;
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    // ==========================================
    // USER INPUT HANDLING
    // ==========================================
    
    function sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;
        
        addMessage('user', message);
        input.value = '';
        input.style.height = 'auto';
        
        showTyping();
        
        setTimeout(() => {
            hideTyping();
            const response = getResponse(message);
            addMessage('assistant', response);
        }, 600 + Math.random() * 500);
    }

    function handleQuickReply(text) {
        addMessage('user', text);
        showTyping();
        
        setTimeout(() => {
            hideTyping();
            const response = getResponse(text);
            addMessage('assistant', response);
        }, 500 + Math.random() * 400);
    }

    function getResponse(input) {
        const normalized = input.toLowerCase().trim();
        
        for (const [key, value] of Object.entries(RESPONSES)) {
            if (normalized.includes(key) || key.includes(normalized)) {
                return value;
            }
        }
        
        // Default with context tips
        const config = STEP_CONFIG[STATE.currentStep];
        return RESPONSES.default + '<br><br>' + config.tips.map(t => '• ' + t).join('<br>');
    }

    // ==========================================
    // UI UPDATES
    // ==========================================
    
    function updateContext() {
        const context = document.getElementById('chatContext');
        const stepLabel = context.querySelector('.step-label');
        if (stepLabel && STEP_CONFIG[STATE.currentStep]) {
            stepLabel.innerHTML = `<span class="step-label">${STEP_CONFIG[STATE.currentStep].context}</span>`;
        }
    }

    function updateQuickReplies() {
        const container = document.getElementById('chatQuickReplies');
        const config = STEP_CONFIG[STATE.currentStep];
        
        if (container && config) {
            container.innerHTML = config.quickReplies
                .map(r => `<button class="quick-reply">${r}</button>`)
                .join('');
        }
    }

    function updateSmartActions() {
        const container = document.getElementById('smartActionsRow');
        if (!container) return;
        
        let actions = [...SMART_ACTIONS.universal];
        
        // Add step-specific actions
        const stepActions = SMART_ACTIONS[`step${STATE.currentStep}`] || [];
        actions = [...actions, ...stepActions.filter(a => {
            if (a.requiresHistory && userProfile.savedStructures.length === 0) return false;
            return true;
        })];
        
        // Add content-specific actions
        if (STATE.detectedContentType && SMART_ACTIONS.contentSpecific[STATE.detectedContentType]) {
            actions = [...actions, ...SMART_ACTIONS.contentSpecific[STATE.detectedContentType]];
        }
        
        // Add personalized action for returning users
        if (userProfile.savedStructures.length > 0 && STATE.currentStep === 3) {
            const hasApply = actions.some(a => a.id === 'applyPrevious');
            if (!hasApply) {
                actions.unshift({
                    id: 'applyPrevious',
                    icon: '⚡',
                    label: `Apply "${userProfile.savedStructures[0].name}"`,
                    action: 'applyPreviousStructure',
                    isLearned: true
                });
            }
        }
        
        container.innerHTML = actions.map(a => `
            <button class="smart-action ${a.isLearned ? 'learned' : ''} ${a.suggested ? 'suggested' : ''}" 
                    data-action="${a.action}">
                <span class="smart-action-icon">${a.icon}</span>
                ${a.label}
            </button>
        `).join('');
    }
    // ==========================================
    // SMART ACTION HANDLERS
    // ==========================================
    
    function handleSmartAction(action) {
        switch(action) {
            case 'learnSession':
                learnFromSession();
                break;
            case 'detectContentType':
                manualDetectContent();
                break;
            case 'suggestAudience':
                suggestAudience();
                break;
            case 'suggestTabNames':
                suggestBetterTabNames();
                break;
            case 'optimizeMobile':
                optimizeForMobile();
                break;
            case 'makeProfessional':
                makeProfessional();
                break;
            case 'applyPreviousStructure':
                applyPreviousStructure();
                break;
            case 'structureAsActions':
                structureAsActionItems();
                break;
            case 'addQuizSections':
                addQuizSections();
                break;
            case 'numberSteps':
                numberAllSteps();
                break;
            case 'addExecutiveSummary':
                addExecutiveSummary();
                break;
            default:
                addMessage('assistant', "I'll help you with that! This feature is being refined based on user feedback.");
        }
        
        // Track suggestion acceptance
        userProfile.suggestionsAccepted[action] = (userProfile.suggestionsAccepted[action] || 0) + 1;
        saveUserProfile();
    }

    function learnFromSession() {
        setLearningMode(true);
        
        // Gather current session data
        const sections = document.querySelectorAll('.edit-section');
        const tabNames = [];
        sections.forEach(s => {
            const titleInput = s.querySelector('.sec-title-in');
            if (titleInput && titleInput.value) {
                tabNames.push(titleInput.value);
            }
        });
        
        const brandColor = document.getElementById('brandColor')?.value;
        const audience = document.getElementById('audience')?.value;
        const goal = document.getElementById('goal')?.value;
        
        // Save structure if meaningful
        if (tabNames.length >= 3) {
            const structureName = STATE.detectedContentType 
                ? `${CONTENT_PATTERNS[STATE.detectedContentType].label} (${tabNames.length} tabs)`
                : `Custom (${tabNames.length} tabs)`;
            
            userProfile.savedStructures.unshift({
                name: structureName,
                tabCount: tabNames.length,
                tabNames: tabNames,
                contentType: STATE.detectedContentType,
                savedAt: new Date().toISOString()
            });
            
            // Keep only last 5 structures
            userProfile.savedStructures = userProfile.savedStructures.slice(0, 5);
        }
        
        // Update preferences
        if (brandColor) userProfile.preferredBrandColor = brandColor;
        if (audience) userProfile.preferredAudience = audience;
        if (goal && !userProfile.commonGoals.includes(goal)) {
            userProfile.commonGoals.unshift(goal);
            userProfile.commonGoals = userProfile.commonGoals.slice(0, 5);
        }
        
        // Track tab name patterns
        tabNames.forEach(name => {
            if (!userProfile.commonTabNames.includes(name)) {
                userProfile.commonTabNames.unshift(name);
            }
        });
        userProfile.commonTabNames = userProfile.commonTabNames.slice(0, 20);
        
        // Calculate preferred tab count
        if (userProfile.preferredTabCount) {
            userProfile.preferredTabCount = Math.round((userProfile.preferredTabCount + tabNames.length) / 2);
        } else {
            userProfile.preferredTabCount = tabNames.length;
        }
        
        saveUserProfile();
        
        setTimeout(() => {
            setLearningMode(false);
            addMessage('system', '🧠 Session learned! I\'ll use these patterns for future suggestions.');
            showToast('Learned!', 'Saved your structure and preferences');
            updateSmartActions();
        }, 1500);
        
        addMessage('assistant', 'Learning from this session... I\'m saving your tab structure, naming patterns, and preferences.', { insightSaved: true });
    }

    function manualDetectContent() {
        const contentArea = document.getElementById('rawContent');
        if (!contentArea || contentArea.value.length < 50) {
            addMessage('assistant', 'Please paste some content first (at least a few sentences), then I can detect what type it is.');
            return;
        }
        
        const detected = detectContentType(contentArea.value);
        if (detected) {
            onContentTypeDetected(detected);
            const config = CONTENT_PATTERNS[detected];
            addMessage('assistant', `This looks like <strong>${config.label}</strong>! I'd suggest this structure:<br><br>` + 
                config.suggestedStructure.map((s, i) => `${i+1}. ${s}`).join('<br>'));
        } else {
            addMessage('assistant', 'I couldn\'t detect a specific content type. It might be general content - which is fine! The AI will create a good structure for it.');
        }
    }

    function suggestAudience() {
        const contentArea = document.getElementById('rawContent');
        const content = contentArea?.value.toLowerCase() || '';
        
        let suggestion = 'General audience';
        
        if (content.includes('beginner') || content.includes('introduction') || content.includes('getting started')) {
            suggestion = 'Beginners new to this topic';
        } else if (content.includes('advanced') || content.includes('expert') || content.includes('deep dive')) {
            suggestion = 'Experienced practitioners';
        } else if (content.includes('team') || content.includes('employee') || content.includes('staff')) {
            suggestion = 'Team members / employees';
        } else if (content.includes('client') || content.includes('customer')) {
            suggestion = 'Clients / customers';
        } else if (userProfile.preferredAudience) {
            suggestion = userProfile.preferredAudience;
            addMessage('assistant', `Based on your previous guides, I'd suggest: <strong>"${suggestion}"</strong><br><br>Want me to fill this in?`);
            return;
        }
        
        addMessage('assistant', `Based on the content, I'd suggest: <strong>"${suggestion}"</strong><br><br>You can adjust this in the 'Who is this guide for?' field.`);
        
        // Offer to fill it in
        const audienceField = document.getElementById('audience');
        if (audienceField && !audienceField.value) {
            audienceField.value = suggestion;
            addMessage('system', '✓ Filled in the audience field for you');
        }
    }

    function suggestBetterTabNames() {
        const sections = document.querySelectorAll('.edit-section');
        if (sections.length === 0) {
            addMessage('assistant', 'No sections to improve yet. Generate your guide first, then I can suggest better names.');
            return;
        }
        
        const improvements = [];
        const namePatterns = {
            'overview': 'What You\'ll Learn',
            'introduction': 'Quick Start',
            'conclusion': 'Key Takeaways',
            'summary': 'TL;DR',
            'steps': 'How To Do It',
            'resources': 'Tools & Links',
            'tips': 'Pro Tips',
            'examples': 'Real Examples'
        };
        
        sections.forEach((section, i) => {
            const titleInput = section.querySelector('.sec-title-in');
            if (titleInput) {
                const current = titleInput.value.toLowerCase();
                for (const [pattern, better] of Object.entries(namePatterns)) {
                    if (current.includes(pattern) && current !== better.toLowerCase()) {
                        improvements.push({ index: i, current: titleInput.value, suggested: better });
                        break;
                    }
                }
            }
        });
        
        if (improvements.length > 0) {
            let response = 'Here are some more engaging titles:<br><br>';
            improvements.forEach(imp => {
                response += `• "${imp.current}" → <strong>"${imp.suggested}"</strong><br>`;
            });
            response += '<br>Want me to apply these changes?';
            addMessage('assistant', response);
        } else {
            addMessage('assistant', 'Your tab names look good! They\'re clear and descriptive. If you want more action-oriented names, try starting with verbs like "Learn", "Do", "Check", "Get".');
        }
    }

    function optimizeForMobile() {
        addMessage('assistant', `Mobile optimization tips:<br><br>
            • <strong>Keep titles short</strong> - under 25 characters is best<br>
            • <strong>Use 4-5 sections max</strong> - easier to navigate on small screens<br>
            • <strong>Front-load key info</strong> - put the most important stuff first<br>
            • <strong>Short paragraphs</strong> - 2-3 sentences per section<br><br>
            Your guide already works on mobile - these tips just make it better!`);
    }

    function makeProfessional() {
        const brandName = document.getElementById('brandName');
        const clientName = document.getElementById('clientName');
        
        let tips = 'Making it more professional:<br><br>';
        
        if (!clientName?.value) {
            tips += '• <strong>Add a client name</strong> in the "Prepared For" field<br>';
        }
        
        tips += '• <strong>Use formal language</strong> - avoid casual phrases like "gonna", "kinda"<br>';
        tips += '• <strong>Add specific numbers</strong> - "3 steps" is better than "a few steps"<br>';
        tips += '• <strong>Include timeframes</strong> - "Takes 5 minutes" sets expectations<br>';
        
        if (userProfile.preferredBrandColor) {
            tips += `<br>💡 You usually use this brand color: <strong>${userProfile.preferredBrandColor}</strong>`;
        }
        
        addMessage('assistant', tips);
    }

    function applyPreviousStructure() {
        if (userProfile.savedStructures.length === 0) {
            addMessage('assistant', 'You don\'t have any saved structures yet. Create a guide and click "Learn from this session" to save one.');
            return;
        }
        
        const structure = userProfile.savedStructures[0];
        addMessage('assistant', `Applying your saved structure: <strong>"${structure.name}"</strong><br><br>` +
            `This had ${structure.tabCount} tabs:<br>` +
            structure.tabNames.map((n, i) => `${i+1}. ${n}`).join('<br>') +
            `<br><br>Note: The AI will use these as guidance when generating your guide.`);
        
        showToast('Structure applied', `Using "${structure.name}"`);
    }

    function structureAsActionItems() {
        addMessage('assistant', `Restructuring as action items...<br><br>
            I'll organize the content into:<br>
            • <strong>Decisions Made</strong> - What was agreed<br>
            • <strong>Action Items</strong> - Who does what by when<br>
            • <strong>Discussion Notes</strong> - Key points covered<br>
            • <strong>Next Meeting</strong> - Follow-up items<br><br>
            Tip: Make sure your transcript includes names and dates for best results.`);
    }

    function addQuizSections() {
        addMessage('assistant', `Adding quiz-style sections:<br><br>
            Each section will include:<br>
            • <strong>Key concept</strong> explained simply<br>
            • <strong>Quick check</strong> - "Can you answer this?"<br>
            • <strong>Common mistakes</strong> to avoid<br><br>
            Great for training content and certifications!`);
    }

    function numberAllSteps() {
        const sections = document.querySelectorAll('.edit-section');
        let count = 0;
        
        sections.forEach(section => {
            const titleInput = section.querySelector('.sec-title-in');
            if (titleInput) {
                const current = titleInput.value;
                if (!current.match(/^(Step )?\d+[.:]/)) {
                    count++;
                    titleInput.value = `Step ${count}: ${current}`;
                    // Update display
                    const titleDisplay = section.querySelector('.sec-title');
                    if (titleDisplay) titleDisplay.textContent = titleInput.value;
                }
            }
        });
        
        if (count > 0) {
            addMessage('system', `✓ Numbered ${count} sections`);
            addMessage('assistant', `Done! I've numbered your sections as steps. This makes tutorials much easier to follow.`);
        } else {
            addMessage('assistant', 'Your sections are already numbered or don\'t need numbering.');
        }
    }

    function addExecutiveSummary() {
        addMessage('assistant', `For a proper executive summary, I recommend:<br><br>
            <strong>Add a new first section called "Executive Summary" with:</strong><br>
            • One sentence on the topic/purpose<br>
            • 3 key findings as bullet points<br>
            • One recommended action<br><br>
            Click "+ Add Section", drag it to the top, and use this structure.`);
    }

    // ==========================================
    // PROFILE RENDERING
    // ==========================================
    
    function renderProfile() {
        const container = document.getElementById('profileContent');
        
        const mostUsedContentType = Object.entries(userProfile.contentTypes)
            .sort((a, b) => b[1] - a[1])[0];
        
        container.innerHTML = `
            <div class="profile-section">
                <h5>📊 Usage Stats</h5>
                <div class="profile-stat">
                    <span class="profile-stat-label">Guides Created</span>
                    <span class="profile-stat-value">${userProfile.totalGuidesCreated}</span>
                </div>
                <div class="profile-stat">
                    <span class="profile-stat-label">Sessions</span>
                    <span class="profile-stat-value">${userProfile.totalSessions}</span>
                </div>
                <div class="profile-stat">
                    <span class="profile-stat-label">Preferred Tab Count</span>
                    <span class="profile-stat-value">${userProfile.preferredTabCount || 'Learning...'}</span>
                </div>
            </div>
            
            <div class="profile-section">
                <h5>📁 Content Types Used</h5>
                <div class="profile-tags">
                    ${Object.entries(userProfile.contentTypes).length > 0 
                        ? Object.entries(userProfile.contentTypes)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, count]) => {
                                const config = CONTENT_PATTERNS[type];
                                return `<span class="profile-tag ${count > 2 ? 'frequent' : ''}">${config?.icon || '📄'} ${config?.label || type} (${count})</span>`;
                            }).join('')
                        : '<span class="profile-tag">No content yet</span>'
                    }
                </div>
            </div>
            
            <div class="profile-section">
                <h5>💾 Saved Structures</h5>
                <div class="profile-tags">
                    ${userProfile.savedStructures.length > 0 
                        ? userProfile.savedStructures.map(s => 
                            `<span class="profile-tag frequent">${s.name}</span>`
                        ).join('')
                        : '<span class="profile-tag">None saved yet</span>'
                    }
                </div>
            </div>
            
            <div class="profile-section">
                <h5>🏷️ Common Tab Names</h5>
                <div class="profile-tags">
                    ${userProfile.commonTabNames.slice(0, 10).length > 0 
                        ? userProfile.commonTabNames.slice(0, 10).map(n => 
                            `<span class="profile-tag">${n}</span>`
                        ).join('')
                        : '<span class="profile-tag">Learning your patterns...</span>'
                    }
                </div>
            </div>
            
            <div class="profile-section">
                <h5>⚙️ Settings</h5>
                <button class="profile-clear-btn" onclick="window.iTabs.clearProfile()">
                    🗑️ Clear All Learning Data
                </button>
            </div>
        `;
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    
    function setLearningMode(isLearning) {
        STATE.isLearning = isLearning;
        const avatar = document.getElementById('chatAvatar');
        if (avatar) {
            avatar.classList.toggle('learning', isLearning);
        }
    }

    function showToast(title, message) {
        const toast = document.getElementById('learningToast');
        const text = document.getElementById('learningToastText');
        
        text.innerHTML = `<strong>${title}</strong> - ${message}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    
    window.iTabs = {
        clearProfile: function() {
            if (confirm('This will clear all your learned preferences and saved structures. Continue?')) {
                clearUserProfile();
                renderProfile();
            }
        }
    };

    // ==========================================
    // INITIALIZE
    // ==========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

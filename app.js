// Selector helper that works with or without #
function $(selector) {
    if (selector.startsWith('#')) {
        return document.getElementById(selector.substring(1));
    }
    return document.getElementById(selector);
}

// Genre button configurations
const GENRE_BUTTONS = {
    default: ['edit', 'music', 'performance', 'sound', 'color', 'VFX', 'story', 'other'],
    comedy: ['funny', 'not funny', 'timing weird', 'performance', 'music', 'other'],
    action: ['VFX', 'performance', 'too long', 'confusing', 'music', 'other'],
    documentary: ['too long', 'needs context', 're-order', 'confusing', 'story', 'other']
};

// State
let state = {
    isRunning: false,
    startTime: null,
    pausedTime: 0,
    elapsedSeconds: 0,
    fps: 24,
    session: null,
    buttonLabels: ['Note 1', 'Note 2', 'Note 3', 'Note 4', 'Note 5', 'Note 6'],
    dimLevel: 0,
    genre: null,
    screeningName: '',
    setupComplete: false
};

let timerInterval = null;
let pendingConfirm = null;

// Initialize
function init() {
    // Check for app version - force setup if version changed
    const APP_VERSION = '2.0';
    const storedVersion = localStorage.getItem('screeningAppVersion');
    if (storedVersion !== APP_VERSION) {
        // New version - clear old state and force setup
        localStorage.removeItem('screeningAppState');
        localStorage.setItem('screeningAppVersion', APP_VERSION);
        state.setupComplete = false;
        state.genre = null;
        state.screeningName = '';
    }
    
    loadState();
    setupEventListeners();
    
    // Check if setup is needed
    if (!state.setupComplete || !state.genre || !state.screeningName) {
        // Don't close setup modal - show it
        showSetupModal();
    } else {
        closeAllModals();
        renderButtons();
        renderNotes();
        updateTimer();
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        // Use relative path for GitHub Pages compatibility
        const swPath = './sw.js';
        navigator.serviceWorker.register(swPath).catch(err => console.log('SW registration failed:', err));
    }
}

// Load state from localStorage
function loadState() {
    try {
        const saved = localStorage.getItem('screeningAppState');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.session) {
                state.session = parsed.session;
                // Restore notes with proper structure
                if (state.session.notes) {
                    state.session.notes = state.session.notes.map(note => ({
                        ...note,
                        elapsedSeconds: parseFloat(note.elapsedSeconds) || 0
                    }));
                }
            }
            if (parsed.fps) state.fps = parseFloat(parsed.fps);
            if (parsed.buttonLabels && Array.isArray(parsed.buttonLabels)) {
                state.buttonLabels = parsed.buttonLabels;
            }
            if (parsed.genre) state.genre = parsed.genre;
            if (parsed.screeningName) state.screeningName = parsed.screeningName;
            if (parsed.dimLevel !== undefined) state.dimLevel = parseInt(parsed.dimLevel) || 0;
            // Only trust setupComplete if genre and name are also present
            if (parsed.setupComplete !== undefined && parsed.genre && parsed.screeningName) {
                state.setupComplete = parsed.setupComplete;
            } else {
                // Force setup if data is incomplete
                state.setupComplete = false;
            }
        }
    } catch (e) {
        console.error('Failed to load state:', e);
        state.setupComplete = false;
    }
    
    // Update header with screening name if available
    if (state.screeningName) {
        const screeningNameEl = $('screeningName');
        if (screeningNameEl) {
            screeningNameEl.textContent = state.screeningName;
        }
    }
    
    // Restore dim level (will be set up in setupEventListeners)
    // Just ensure the slider value is set
    const dimSlider = $('dimSlider');
    if (dimSlider) {
        dimSlider.value = state.dimLevel || 0;
    }
}

// Save state to localStorage
function saveState() {
    try {
        localStorage.setItem('screeningAppState', JSON.stringify({
            session: state.session,
            fps: state.fps,
            buttonLabels: state.buttonLabels,
            genre: state.genre,
            screeningName: state.screeningName,
            setupComplete: state.setupComplete,
            dimLevel: state.dimLevel
        }));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// Create new session
function createNewSession() {
    const now = new Date();
    const sessionName = state.screeningName || `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    state.session = {
        id: Date.now().toString(),
        name: sessionName,
        createdAt: now.toISOString(),
        notes: [],
        genre: state.genre
    };
    saveState();
}

// Format elapsed seconds to HH:MM:SS
function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format elapsed seconds to timecode HH:MM:SS:FF
function formatTimecode(seconds, fps) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * fps);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

// Update timer display
function updateTimer() {
    const statusEl = $('status');
    const timecodeEl = $('timecode');
    const startPauseBtn = $('startPauseBtn');
    
    if (!statusEl || !timecodeEl || !startPauseBtn) return;
    
    if (state.isRunning) {
        const now = Date.now();
        const elapsed = (now - state.startTime) / 1000 + state.pausedTime;
        state.elapsedSeconds = elapsed;
        
        statusEl.textContent = 'RUNNING';
        statusEl.className = 'status running';
        startPauseBtn.textContent = 'Pause';
    } else {
        statusEl.textContent = state.elapsedSeconds > 0 ? 'PAUSED' : 'STOPPED';
        statusEl.className = state.elapsedSeconds > 0 ? 'status paused' : 'status';
        startPauseBtn.textContent = state.elapsedSeconds > 0 ? 'Resume' : 'Start';
    }
    
    timecodeEl.textContent = formatTimecode(state.elapsedSeconds, state.fps);
}

// Start/Pause timer
function toggleTimer() {
    if (state.isRunning) {
        // Pause
        state.pausedTime = state.elapsedSeconds;
        state.isRunning = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } else {
        // Start/Resume
        if (state.elapsedSeconds === 0) {
            state.startTime = Date.now();
            state.pausedTime = 0;
        } else {
            state.startTime = Date.now() - (state.pausedTime * 1000);
        }
        state.isRunning = true;
        timerInterval = setInterval(updateTimer, 100); // Update every 100ms
    }
    updateTimer();
}

// Show toast notification
function showToast(message, timecode) {
    const toast = $('toast');
    if (!toast) return;
    
    if (timecode) {
        toast.innerHTML = `<span class="toast-timecode">${escapeHtml(timecode)}</span><span class="toast-label">${escapeHtml(message)}</span>`;
    } else {
        toast.innerHTML = `<span class="toast-label">${escapeHtml(message)}</span>`;
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// Add visual feedback to button
function addButtonFeedback(button) {
    if (!button) return;
    
    // Remove any existing feedback classes
    button.classList.remove('clicked', 'clicked-success');
    
    // Add clicked class for immediate feedback
    button.classList.add('clicked');
    
    // After a brief moment, change to success state
    setTimeout(() => {
        button.classList.remove('clicked');
        button.classList.add('clicked-success');
        
        // Remove success state after animation
        setTimeout(() => {
            button.classList.remove('clicked-success');
        }, 300);
    }, 100);
}

// Add note
function addNote(label, customText = null) {
    if (!state.session) return;
    
    // Use custom text if provided, otherwise use capitalized label
    const displayLabel = customText ? `${capitalizeLabel(label)}: ${customText}` : capitalizeLabel(label);
    
    const note = {
        label: displayLabel,
        elapsedSeconds: state.elapsedSeconds,
        elapsedHMS: formatElapsed(state.elapsedSeconds),
        timecode: formatTimecode(state.elapsedSeconds, state.fps),
        deviceTimestamp: new Date().toISOString()
    };
    
    state.session.notes.push(note);
    saveState();
    renderNotes();
    
    // Show visual feedback - match by original label
    const buttons = document.querySelectorAll('.note-button');
    buttons.forEach(btn => {
        const btnLabel = btn.textContent.trim().toLowerCase();
        if (btnLabel === label.toLowerCase() || btnLabel === capitalizeLabel(label).toLowerCase()) {
            addButtonFeedback(btn);
        }
    });
    
    // Show toast notification
    showToast(displayLabel, note.timecode);
}

// Delete note
function deleteNote(index) {
    if (!state.session || !state.session.notes[index]) return;
    
    showConfirm('Delete this note?', () => {
        state.session.notes.splice(index, 1);
        saveState();
        renderNotes();
    });
}

// Clear all notes
function clearNotes() {
    showConfirm('Clear all notes? This cannot be undone.', () => {
        if (state.session) {
            state.session.notes = [];
            saveState();
            renderNotes();
        }
    });
}

// Capitalize button label - force capitalization on all buttons
function capitalizeLabel(label) {
    // Handle special cases first
    if (label.toLowerCase() === 'vfx') return 'VFX';
    if (label.toLowerCase() === 'vfx') return 'VFX';
    
    // Capitalize first letter of each word, rest lowercase
    return label.split(' ').map(word => {
        if (word.length === 0) return word;
        // Keep acronyms like VFX uppercase
        if (word.toUpperCase() === 'VFX') return 'VFX';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

// Render buttons
function renderButtons() {
    const grid = $('buttonsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    state.buttonLabels.forEach((label, index) => {
        const button = document.createElement('button');
        button.className = 'note-button';
        const displayLabel = capitalizeLabel(label);
        button.textContent = displayLabel;
        button.addEventListener('click', () => {
            if (state.isRunning || state.elapsedSeconds > 0) {
                // Special handling for "other" button (use original label for logic)
                if (label.toLowerCase() === 'other') {
                    showOtherNoteModal();
                } else {
                    addNote(label); // Store original label
                }
            } else {
                // Show feedback even if timer hasn't started
                addButtonFeedback(button);
                showToast('Start the timer first', null);
            }
        });
        // Prevent iOS context menu
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        grid.appendChild(button);
    });
}

// Render notes list
function renderNotes() {
    const list = $('notesList');
    if (!list) return;
    
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No notes yet</div>';
        return;
    }
    
    list.innerHTML = '';
    state.session.notes.forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.innerHTML = `
            <span class="note-item-label">${escapeHtml(note.label)}</span>
            <span class="note-item-timecode">${escapeHtml(note.timecode)}</span>
        `;
        item.addEventListener('click', () => deleteNote(index));
        list.appendChild(item);
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show summary
function showSummary() {
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        alert('No notes to summarize');
        return;
    }
    
    const counts = {};
    state.session.notes.forEach(note => {
        counts[note.label] = (counts[note.label] || 0) + 1;
    });
    
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }));
    
    const content = $('summaryContent');
    if (!content) return;
    
    content.innerHTML = '';
    sorted.forEach(({ label, count }) => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <span class="summary-label">${escapeHtml(label)}</span>
            <span class="summary-count">${count}</span>
        `;
        content.appendChild(item);
    });
    
    showModal('summaryModal');
}

// Export CSV
function exportCsv() {
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        alert('No notes to export');
        return;
    }
    
    const lines = ['SessionName,Date,Label,ElapsedTime,Timecode,FPS,DeviceTimestamp'];
    state.session.notes.forEach(note => {
        lines.push([
            escapeCsv(state.session.name),
            escapeCsv(state.session.createdAt),
            escapeCsv(note.label),
            note.elapsedSeconds.toFixed(3),
            escapeCsv(note.timecode),
            state.fps.toString(),
            escapeCsv(note.deviceTimestamp)
        ].join(','));
    });
    
    return lines.join('\n');
}

// Export Text
function exportText() {
    if (!state.session || !state.session.notes || !state.session.notes.length === 0) {
        alert('No notes to export');
        return;
    }
    
    return state.session.notes.map(note => `${note.timecode}  ${note.label}`).join('\n');
}

// Escape CSV
function escapeCsv(text) {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

// Share or download file
async function shareOrDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: filename
            });
            return;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Share failed:', e);
            } else {
                return; // User cancelled
            }
        }
    }
    
    // Fallback to download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard');
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                alert('Copied to clipboard');
            } catch (e) {
                alert('Failed to copy. Please select and copy manually.');
            }
            document.body.removeChild(textarea);
        }
    } catch (e) {
        console.error('Copy failed:', e);
        alert('Failed to copy. Please select and copy manually.');
    }
}

// Show modal
function showModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close all modals (except setup modal)
function closeAllModals() {
    closeModal('settingsModal');
    closeModal('summaryModal');
    closeModal('exportModal');
    closeModal('confirmModal');
    closeModal('otherNoteModal');
}

// Show confirmation
function showConfirm(message, callback) {
    const messageEl = $('confirmMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }
    pendingConfirm = callback;
    showModal('confirmModal');
}

// Show setup modal
function showSetupModal() {
    const modal = $('setupModal');
    if (modal) {
        // Force show the modal
        modal.style.display = 'flex';
        modal.classList.add('active');
        // Ensure it's on top
        modal.style.zIndex = '10001';
    }
    // Reset genre selection
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    // Clear inputs
    const nameInput = $('screeningNameInput');
    if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
    }
    const startBtn = $('startScreeningBtn');
    if (startBtn) startBtn.disabled = true;
    // Reset state
    state.genre = null;
}

// Start screening from setup
function startScreening() {
    const nameInput = $('screeningNameInput');
    const selectedGenre = state.genre;
    
    if (!selectedGenre) return;
    
    // Use entered name or default to "Untitled Screening"
    const screeningName = nameInput && nameInput.value.trim() 
        ? nameInput.value.trim() 
        : 'Untitled Screening';
    
    state.screeningName = screeningName;
    state.genre = selectedGenre;
    state.buttonLabels = GENRE_BUTTONS[selectedGenre];
    state.setupComplete = true;
    
    createNewSession();
    saveState();
    
    // Update header with screening name
    const screeningNameEl = $('screeningName');
    if (screeningNameEl) {
        screeningNameEl.textContent = screeningName;
    }
    
    // Close setup modal - force close
    const setupModal = $('setupModal');
    if (setupModal) {
        setupModal.classList.remove('active');
        setupModal.style.display = 'none';
    }
    
    // Initialize app
    renderButtons();
    renderNotes();
    updateTimer();
}

// Show other note modal
function showOtherNoteModal() {
    const modal = $('otherNoteModal');
    const input = $('otherNoteInput');
    if (modal) {
        modal.classList.add('active');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

// Log other note
function logOtherNote() {
    const input = $('otherNoteInput');
    const customText = input ? input.value.trim() : '';
    
    // Close modal first
    closeModal('otherNoteModal');
    
    // Add note (with or without custom text)
    addNote('other', customText || null);
}

// Setup event listeners
function setupEventListeners() {
    // Start/Pause button
    const startPauseBtn = $('startPauseBtn');
    if (startPauseBtn) {
        startPauseBtn.addEventListener('click', toggleTimer);
    }
    
    // Setup modal - genre selection
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selection from all
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
            // Add to clicked
            btn.classList.add('selected');
            state.genre = btn.dataset.genre;
            
            // Enable start button (name is optional, defaults to "Untitled Screening")
            const startBtn = $('startScreeningBtn');
            if (startBtn) {
                startBtn.disabled = false;
            }
        });
    });
    
    // Setup modal - name input (no longer required, but update button state)
    const nameInput = $('screeningNameInput');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            // Button is enabled as long as genre is selected
            const startBtn = $('startScreeningBtn');
            if (startBtn) {
                startBtn.disabled = !state.genre;
            }
        });
    }
    
    // Setup modal - start button
    const startScreeningBtn = $('startScreeningBtn');
    if (startScreeningBtn) {
        startScreeningBtn.addEventListener('click', startScreening);
    }
    
    // Other note modal
    const closeOtherNote = $('closeOtherNote');
    if (closeOtherNote) {
        closeOtherNote.addEventListener('click', () => closeModal('otherNoteModal'));
    }
    
    const logOtherNoteBtn = $('logOtherNoteBtn');
    if (logOtherNoteBtn) {
        logOtherNoteBtn.addEventListener('click', logOtherNote);
    }
    
    // Allow Enter key in other note input
    const otherNoteInput = $('otherNoteInput');
    if (otherNoteInput) {
        otherNoteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                logOtherNote();
            }
        });
    }
    
    // New session
    const newBtn = $('newBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            showConfirm('Start a new session? This will reset the timer and clear all notes.', () => {
                state.isRunning = false;
                state.elapsedSeconds = 0;
                state.pausedTime = 0;
                state.startTime = null;
                state.setupComplete = false;
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                showSetupModal();
            });
        });
    }
    
    // Settings
    const settingsBtn = $('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            renderSettings();
            showModal('settingsModal');
        });
    }
    
    const closeSettings = $('closeSettings');
    if (closeSettings) {
        closeSettings.addEventListener('click', () => closeModal('settingsModal'));
    }
    
    const saveSettings = $('saveSettings');
    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            // Get button labels from inputs and force capitalization
            const inputs = document.querySelectorAll('#buttonLabelsContainer input');
            const labels = Array.from(inputs)
                .map(input => input.value.trim())
                .filter(Boolean)
                .map(label => {
                    // Store lowercase version for logic, but display will be capitalized
                    // Keep special cases like VFX
                    if (label.toUpperCase() === 'VFX') return 'VFX';
                    return label.toLowerCase();
                });
            if (labels.length >= 6 && labels.length <= 9) {
                state.buttonLabels = labels;
            } else {
                alert('Please provide 6-9 button labels');
                return;
            }
            
            saveState();
            renderButtons();
            closeModal('settingsModal');
        });
    }
    
    // Summary
    const summaryBtn = $('summaryBtn');
    if (summaryBtn) {
        summaryBtn.addEventListener('click', showSummary);
    }
    
    const closeSummary = $('closeSummary');
    if (closeSummary) {
        closeSummary.addEventListener('click', () => closeModal('summaryModal'));
    }
    
    // Export
    const exportBtn = $('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => showModal('exportModal'));
    }
    
    const closeExport = $('closeExport');
    if (closeExport) {
        closeExport.addEventListener('click', () => closeModal('exportModal'));
    }
    
    const shareCsvBtn = $('shareCsvBtn');
    if (shareCsvBtn) {
        shareCsvBtn.addEventListener('click', async () => {
            const csv = exportCsv();
            if (csv) {
                await shareOrDownload(csv, `${state.session.name.replace(/[^a-z0-9]/gi, '_')}.csv`, 'text/csv');
            }
        });
    }
    
    const shareTextBtn = $('shareTextBtn');
    if (shareTextBtn) {
        shareTextBtn.addEventListener('click', async () => {
            const text = exportText();
            if (text) {
                await shareOrDownload(text, `${state.session.name.replace(/[^a-z0-9]/gi, '_')}.txt`, 'text/plain');
            }
        });
    }
    
    const copyCsvBtn = $('copyCsvBtn');
    if (copyCsvBtn) {
        copyCsvBtn.addEventListener('click', async () => {
            const csv = exportCsv();
            if (csv) {
                await copyToClipboard(csv);
            }
        });
    }
    
    const copyTextBtn = $('copyTextBtn');
    if (copyTextBtn) {
        copyTextBtn.addEventListener('click', async () => {
            const text = exportText();
            if (text) {
                await copyToClipboard(text);
            }
        });
    }
    
    // Clear
    const clearBtn = $('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearNotes);
    }
    
    // Confirmation
    const confirmOk = $('confirmOk');
    if (confirmOk) {
        confirmOk.addEventListener('click', () => {
            if (pendingConfirm) {
                pendingConfirm();
                pendingConfirm = null;
            }
            closeModal('confirmModal');
        });
    }
    
    const confirmCancel = $('confirmCancel');
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            pendingConfirm = null;
            closeModal('confirmModal');
        });
    }
    
    // Dim toggle button
    const dimToggleBtn = $('dimToggleBtn');
    const dimSliderContainer = $('dimSliderContainer');
    if (dimToggleBtn && dimSliderContainer) {
        dimToggleBtn.addEventListener('click', () => {
            const isVisible = dimSliderContainer.style.display !== 'none';
            dimSliderContainer.style.display = isVisible ? 'none' : 'flex';
        });
    }
    
    // Dim slider
    const dimSlider = $('dimSlider');
    const dimOverlay = $('dimOverlay');
    if (dimSlider && dimOverlay) {
        // Set initial value
        // With RTL: 0 = right (bright), 100 = left (dim)
        // Start at 0 (right side, bright)
        dimSlider.value = state.dimLevel || 0;
        updateDimOverlay(state.dimLevel || 0);
        
        // Use both input and change events for better mobile support
        // With RTL direction: 0 is on right (bright), 100 is on left (dim)
        // So slider value directly maps to dim level
        const updateDim = (e) => {
            const dimLevel = parseInt(e.target.value);
            state.dimLevel = dimLevel;
            updateDimOverlay(dimLevel);
            saveState();
        };
        
        dimSlider.addEventListener('input', updateDim);
        dimSlider.addEventListener('change', updateDim);
        
        // Touch events for better mobile support (reversed direction)
        let isDragging = false;
        dimSlider.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        }, { passive: false });
        dimSlider.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const rect = dimSlider.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                // With RTL direction: right side (higher x) = slider value 0 (bright), left side (lower x) = slider value 100 (dim)
                // So: right side (high x) = 0, left side (low x) = 100
                const sliderValue = Math.max(0, Math.min(100, 100 - (x / rect.width) * 100));
                dimSlider.value = sliderValue;
                updateDim({ target: dimSlider });
            }
        }, { passive: false });
        dimSlider.addEventListener('touchend', () => {
            isDragging = false;
        });
    }
}

// Update dim overlay opacity and text brightness
function updateDimOverlay(level) {
    const dimOverlay = $('dimOverlay');
    if (dimOverlay) {
        const opacity = level / 100;
        dimOverlay.style.opacity = opacity.toString();
        if (opacity > 0) {
            dimOverlay.classList.add('active');
        } else {
            dimOverlay.classList.remove('active');
        }
    }
    
    // Also dim text brightness - convert white to dark grey based on dim level
    const dimPercent = level / 100;
    // Interpolate from white (#ffffff) to dark grey (#333333)
    const r = Math.round(255 - (255 - 51) * dimPercent);
    const g = Math.round(255 - (255 - 51) * dimPercent);
    const b = Math.round(255 - (255 - 51) * dimPercent);
    const textColor = `rgb(${r}, ${g}, ${b})`;
    
    // Update specific text elements
    const textElements = document.querySelectorAll('.screening-name, .elapsed-time, .note-item-label, .summary-label, .note-button, .btn-primary, .btn-small');
    textElements.forEach(el => {
        if (level > 0) {
            el.style.color = textColor;
        } else {
            el.style.color = ''; // Reset to default
        }
    });
    
    // Update timecode and status (lighter text)
    const lightTextElements = document.querySelectorAll('.timecode, .status, .note-item-timecode, .summary-count');
    const lightR = Math.round(170 - (170 - 51) * dimPercent);
    const lightG = Math.round(170 - (170 - 51) * dimPercent);
    const lightB = Math.round(170 - (170 - 51) * dimPercent);
    const lightTextColor = `rgb(${lightR}, ${lightG}, ${lightB})`;
    lightTextElements.forEach(el => {
        if (level > 0) {
            el.style.color = lightTextColor;
        } else {
            el.style.color = ''; // Reset to default
        }
    });
    
    // Close modals on background click (except setup modal)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.id !== 'setupModal') {
                modal.classList.remove('active');
            }
        });
    });
}

// Render settings
function renderSettings() {
    const container = $('buttonLabelsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    state.buttonLabels.forEach((label, index) => {
        const div = document.createElement('div');
        div.className = 'button-label-input';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-text';
        // Show capitalized version in input, but store original
        input.value = capitalizeLabel(label);
        input.placeholder = `Button ${index + 1}`;
        
        // Add remove button (red X) - only show if more than 6 buttons
        if (state.buttonLabels.length > 6) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove button';
            removeBtn.addEventListener('click', () => {
                state.buttonLabels.splice(index, 1);
                saveState();
                renderSettings();
            });
            div.appendChild(removeBtn);
        }
        
        div.appendChild(input);
        container.appendChild(div);
    });
    
    // Add one empty input for adding more buttons (up to 9)
    if (state.buttonLabels.length < 9) {
        const div = document.createElement('div');
        div.className = 'button-label-input';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-text';
        input.placeholder = 'Add button (optional)';
        div.appendChild(input);
        container.appendChild(div);
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

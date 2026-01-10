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
    setupComplete: false,
    sessionHistory: [], // Array of past sessions
    lastAddedNoteIndex: null // Track most recently added note for toast click
};

let timerInterval = null;
let pendingConfirm = null;

// Initialize
function init() {
    // Scroll to top on load
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
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
        // Ensure all modals are closed
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
        
        // Ensure buttonLabels are set from genre if missing
        if (!state.buttonLabels || state.buttonLabels.length === 0) {
            if (state.genre && GENRE_BUTTONS[state.genre]) {
                state.buttonLabels = GENRE_BUTTONS[state.genre];
            } else {
                state.buttonLabels = GENRE_BUTTONS.default;
            }
            saveState();
        }
        
        renderButtons();
        renderNotes();
        updateTimer();
        
        // Apply dim text colors after rendering (if dim level was restored)
        if (state.dimLevel) {
            setTimeout(() => {
                updateDimOverlay(state.dimLevel);
            }, 50);
        }
    }
    
    // Ensure we're at the top after rendering
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, 100);
    
    // Register service worker with cache-busting
    if ('serviceWorker' in navigator) {
        // Use relative path for GitHub Pages compatibility with cache-busting query param
        const swPath = `./sw.js?v=${Date.now()}`;
        navigator.serviceWorker.register(swPath)
            .then(() => {
                // Unregister old service workers to force update
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    registrations.forEach((registration) => {
                        registration.update();
                    });
                });
            })
            .catch(err => console.log('SW registration failed:', err));
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
                    // Migrate old notes that don't have baseLabel/context
                    state.session.notes = state.session.notes.map(note => {
                        // Migrate old notes that don't have baseLabel/context
                        if (!note.baseLabel) {
                            if (note.label.includes(':')) {
                                const parts = note.label.split(':');
                                note.baseLabel = parts[0].trim();
                                note.context = parts.slice(1).join(':').trim();
                            } else {
                                note.baseLabel = note.label;
                                note.context = '';
                            }
                        }
                        return {
                            ...note,
                            elapsedSeconds: parseFloat(note.elapsedSeconds) || 0
                        };
                    });
                }
            }
            if (parsed.fps) state.fps = parseFloat(parsed.fps);
            if (parsed.buttonLabels && Array.isArray(parsed.buttonLabels)) {
                state.buttonLabels = parsed.buttonLabels;
            }
            if (parsed.genre) state.genre = parsed.genre;
            if (parsed.screeningName) state.screeningName = parsed.screeningName;
            if (parsed.dimLevel !== undefined) state.dimLevel = parseInt(parsed.dimLevel) || 0;
            if (parsed.sessionHistory && Array.isArray(parsed.sessionHistory)) {
                state.sessionHistory = parsed.sessionHistory;
            }
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
    
    // Restore dim level - will be applied in setupEventListeners after DOM is ready
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
            dimLevel: state.dimLevel,
            sessionHistory: state.sessionHistory
        }));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// Create new session
function createNewSession() {
    // Save current session to history if it exists and has notes
    if (state.session && state.session.notes && state.session.notes.length > 0) {
        // Save elapsed time with session
        state.session.elapsedSeconds = state.elapsedSeconds;
        state.session.isRunning = state.isRunning;
        
        // Check if session already exists in history (by ID)
        const existingIndex = state.sessionHistory.findIndex(s => s.id === state.session.id);
        if (existingIndex >= 0) {
            // Update existing session in history
            state.sessionHistory[existingIndex] = { 
                ...state.session,
                buttonLabels: state.buttonLabels // Save button labels with session
            };
        } else {
            // Add new session to history
            state.sessionHistory.push({ 
                ...state.session,
                buttonLabels: state.buttonLabels // Save button labels with session
            });
        }
        // Keep only last 50 sessions to avoid storage issues
        if (state.sessionHistory.length > 50) {
            state.sessionHistory = state.sessionHistory.slice(-50);
        }
    }
    
    const now = new Date();
    const sessionName = state.screeningName || `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    state.session = {
        id: Date.now().toString(),
        name: sessionName,
        createdAt: now.toISOString(),
        notes: [],
        genre: state.genre,
        elapsedSeconds: 0,
        isRunning: false
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

// Format elapsed seconds to timecode HH:MM:SS (no frames)
function formatTimecode(seconds, fps) {
    // Just use the same format as formatElapsed - HH:MM:SS
    return formatElapsed(seconds);
}

// Update timer display
function updateTimer() {
    const timecodeEl = $('timecode');
    const startPauseBtnEl = $('startPauseBtn');
    
    if (!timecodeEl || !startPauseBtnEl) return;
    
    if (state.isRunning) {
        const now = Date.now();
        const elapsed = (now - state.startTime) / 1000 + state.pausedTime;
        state.elapsedSeconds = elapsed;
        
        startPauseBtnEl.textContent = 'Pause';
        startPauseBtnEl.classList.remove('btn-play');
        startPauseBtnEl.classList.add('btn-pause');
    } else {
        startPauseBtnEl.textContent = state.elapsedSeconds > 0 ? 'Resume' : 'Start';
        startPauseBtnEl.classList.remove('btn-pause');
        startPauseBtnEl.classList.add('btn-play');
    }
    
    const formatted = formatTimecode(state.elapsedSeconds, state.fps);
    timecodeEl.textContent = formatted;
    timecodeEl.setAttribute('aria-label', `Current timecode: ${formatted}`);
}

// Start/Pause timer
function toggleTimer() {
    if (state.isRunning) {
        // Pause - save current elapsed time
        const now = Date.now();
        const elapsed = (now - state.startTime) / 1000 + state.pausedTime;
        state.elapsedSeconds = elapsed;
        state.pausedTime = elapsed; // Store total elapsed time
        state.isRunning = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } else {
        // Start/Resume
        if (state.elapsedSeconds === 0) {
            // Starting fresh
            state.startTime = Date.now();
            state.pausedTime = 0;
        } else {
            // Resuming - set startTime to now minus the elapsed time we want to continue from
            // pausedTime already contains the total elapsed, so use that
            const elapsedToContinue = state.pausedTime;
            state.startTime = Date.now() - (elapsedToContinue * 1000);
            state.pausedTime = 0; // Reset pausedTime since we're now running
        }
        state.isRunning = true;
        timerInterval = setInterval(updateTimer, 100); // Update every 100ms
    }
    updateTimer();
}

// Show toast notification
function showToast(message, timecode, noteIndex = null) {
    const toast = $('toast');
    if (!toast) return;
    
    // Clear existing event listeners by cloning and replacing
    const parent = toast.parentNode;
    if (parent) {
        const newToast = toast.cloneNode(false);
        newToast.id = 'toast';
        newToast.className = 'toast';
        parent.replaceChild(newToast, toast);
        const toastEl = newToast;
        
        if (timecode) {
            toastEl.innerHTML = `<span class="toast-timecode">${escapeHtml(timecode)}</span><span class="toast-label">${escapeHtml(message)}</span>`;
        } else {
            toastEl.innerHTML = `<span class="toast-label">${escapeHtml(message)}</span>`;
        }
        
        // If noteIndex is provided, make toast clickable to edit that note
        if (noteIndex !== null && noteIndex !== undefined) {
            toastEl.style.cursor = 'pointer';
            toastEl.setAttribute('role', 'button');
            toastEl.setAttribute('aria-label', 'Click to edit this note');
            toastEl.setAttribute('tabindex', '0');
            toastEl.dataset.noteIndex = noteIndex;
            
            const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(toastEl.dataset.noteIndex);
                if (!isNaN(index) && state.session && state.session.notes && state.session.notes[index]) {
                    editNote(index);
                    toastEl.classList.remove('show');
                }
            };
            
            toastEl.addEventListener('click', clickHandler);
            toastEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    clickHandler(e);
                }
            });
        }
        
        toastEl.classList.add('show');
        
        // Apply dimmer setting to toast
        if (state.dimLevel && state.dimLevel > 0) {
            const dimPercent = Math.min(state.dimLevel / 85, 1);
            // Apply dimming similar to other text elements
            const dimR = Math.round(255 - (255 - 51) * dimPercent);
            const dimG = Math.round(255 - (255 - 51) * dimPercent);
            const dimB = Math.round(255 - (255 - 51) * dimPercent);
            const dimColor = `rgb(${dimR}, ${dimG}, ${dimB})`;
            toastEl.style.color = dimColor;
            toastEl.style.backgroundColor = `rgba(${Math.round(26 - 26 * dimPercent)}, ${Math.round(26 - 26 * dimPercent)}, ${Math.round(26 - 26 * dimPercent)}, 1)`;
        } else {
            // Reset to default if no dimming
            toastEl.style.color = '';
            toastEl.style.backgroundColor = '';
        }
        
        setTimeout(() => {
            toastEl.classList.remove('show');
            // Clear the noteIndex and role after toast hides
            if (toastEl.dataset.noteIndex) {
                delete toastEl.dataset.noteIndex;
            }
            if (toastEl.getAttribute('role') === 'button') {
                toastEl.removeAttribute('role');
                toastEl.removeAttribute('aria-label');
                toastEl.removeAttribute('tabindex');
                toastEl.style.cursor = '';
            }
        }, 2000);
    }
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
    
    // Store base label and context separately
    const baseLabel = capitalizeLabel(label);
    const context = customText ? customText.trim() : '';
    
    const note = {
        baseLabel: baseLabel,
        context: context,
        label: context ? `${baseLabel}: ${context}` : baseLabel, // Keep for backward compatibility
        elapsedSeconds: state.elapsedSeconds,
        elapsedHMS: formatElapsed(state.elapsedSeconds),
        timecode: formatTimecode(state.elapsedSeconds, state.fps),
        deviceTimestamp: new Date().toISOString()
    };
    
    state.session.notes.push(note);
    // Store the index of the most recently added note (it's the last item in the array)
    state.lastAddedNoteIndex = state.session.notes.length - 1;
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
    
    // Show toast notification with click handler
    const displayLabel = context ? `${baseLabel}: ${context}` : baseLabel;
    const timecode = note.timecode || formatTimecode(state.elapsedSeconds, state.fps);
    showToast(displayLabel, timecode, state.lastAddedNoteIndex);
}

// Edit note
function editNote(index) {
    if (!state.session || !state.session.notes[index]) return;
    
    const note = state.session.notes[index];
    const baseLabel = note.baseLabel || (note.label && note.label.includes(':') ? note.label.split(':')[0].trim() : note.label || 'Note');
    const context = note.context || (note.label && note.label.includes(':') ? note.label.split(':').slice(1).join(':').trim() : '');
    
    // Store the index being edited
    const editIndexEl = $('editNoteIndex');
    if (editIndexEl) {
        editIndexEl.dataset.index = index;
    }
    
    // Set the input value first, before showing modal
    const editInput = $('editNoteInput');
    if (editInput) {
        editInput.value = context;
    }
    
    // Show modal
    const modal = $('editNoteModal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        currentOpenModal = 'editNoteModal';
    }
    
    // Force input to be visible and focusable - use requestAnimationFrame for proper timing
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const input = $('editNoteInput');
            if (input) {
                // Ensure input is visible
                input.style.display = 'block';
                input.style.visibility = 'visible';
                input.style.opacity = '1';
                
                // Multiple focus strategies for maximum compatibility
                input.focus();
                input.click();
                
                // For iOS/Safari, sometimes need to blur first then focus
                input.blur();
                setTimeout(() => {
                    input.focus();
                    input.click();
                    
                    // Select all text if there's existing context
                    if (context && input.value.length > 0) {
                        try {
                            input.setSelectionRange(0, input.value.length);
                        } catch (e) {
                            // Some browsers don't support setSelectionRange
                        }
                    }
                }, 100);
                
                // Additional attempts for stubborn mobile keyboards
                setTimeout(() => {
                    input.focus();
                    input.click();
                }, 250);
                
                setTimeout(() => {
                    input.focus();
                    input.click();
                }, 500);
            }
        });
    });
}

// Save edited note
function saveEditedNote() {
    const editIndexEl = $('editNoteIndex');
    if (!editIndexEl) return;
    
    const index = parseInt(editIndexEl.dataset.index);
    if (isNaN(index) || !state.session || !state.session.notes[index]) return;
    
    const editInput = $('editNoteInput');
    const context = editInput ? editInput.value.trim() : '';
    
    const note = state.session.notes[index];
    const baseLabel = note.baseLabel || (note.label.includes(':') ? note.label.split(':')[0].trim() : note.label);
    
    // Update note
    note.baseLabel = baseLabel;
    note.context = context;
    note.label = context ? `${baseLabel}: ${context}` : baseLabel;
    
    saveState();
    renderNotes();
    closeModal('editNoteModal');
    showToast('Note updated', null);
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

// Undo last note
function undoLastNote() {
    if (!state.session) {
        showToast('No session active', null);
        return;
    }
    
    if (!state.session.notes || state.session.notes.length === 0) {
        showToast('No notes to undo', null);
        return;
    }
    
    // Get the last note
    const lastNote = state.session.notes[state.session.notes.length - 1];
    const lastNoteLabel = lastNote.label;
    const lastNoteTimecode = lastNote.timecode;
    
    // Remove the last note
    state.session.notes.pop();
    saveState();
    renderNotes();
    
    // Show visual feedback - find and highlight the button that was used
    const buttons = document.querySelectorAll('.note-button');
    const baseLabel = lastNoteLabel.split(':')[0].trim();
    buttons.forEach(btn => {
        const btnText = btn.textContent.trim();
        // Check if this button matches the undone note
        if (lastNoteLabel.toLowerCase().startsWith('other') || baseLabel.toLowerCase() === 'other') {
            if (btnText.toLowerCase() === 'other') {
                addButtonFeedback(btn);
            }
        } else {
            const btnLabelLower = btnText.toLowerCase();
            const noteLabelLower = baseLabel.toLowerCase();
            if (btnLabelLower === noteLabelLower || btnLabelLower === capitalizeLabel(baseLabel).toLowerCase()) {
                addButtonFeedback(btn);
            }
        }
    });
    
    // Show toast with strikethrough text (both timecode and label)
    const toast = $('toast');
    if (toast) {
        toast.innerHTML = `<span class="toast-timecode toast-strikethrough">${escapeHtml(lastNoteTimecode)}</span><span class="toast-label toast-strikethrough">${escapeHtml(lastNoteLabel)}</span>`;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
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
    if (!grid) {
        console.error('buttonsGrid element not found!');
        return;
    }
    
    // Ensure buttonLabels exist
    if (!state.buttonLabels || state.buttonLabels.length === 0) {
        console.warn('No button labels found, using defaults');
        // Fallback to default genre buttons if none exist
        if (state.genre && GENRE_BUTTONS[state.genre]) {
            state.buttonLabels = GENRE_BUTTONS[state.genre];
        } else {
            state.buttonLabels = GENRE_BUTTONS.default;
        }
    }
    
    grid.innerHTML = '';
    
    // Add class based on number of buttons for responsive sizing
    const buttonCount = state.buttonLabels.length;
    grid.className = 'buttons-grid';
    if (buttonCount === 2 || buttonCount === 4 || buttonCount === 6) {
        grid.classList.add('buttons-grid-large');
    }
    
    // Ensure grid is visible
    grid.style.display = 'grid';
    grid.style.visibility = 'visible';
    grid.style.opacity = '1';
    
    state.buttonLabels.forEach((label, index) => {
        const button = document.createElement('button');
        button.className = 'note-button';
        button.setAttribute('aria-label', `${capitalizeLabel(label)} - log note`);
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
    
    // Ensure scroll stays at top after rendering buttons
    setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, 10);
}

// Render notes list
function renderNotes() {
    const list = $('notesList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-text">No notes yet</div>
            <div class="empty-state-hint">Tap a card above to log your first note</div>
        `;
        list.appendChild(emptyState);
        return;
    }
    
    state.session.notes.forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        
        // Get base label and context (handle backward compatibility)
        const baseLabel = note.baseLabel || (note.label && note.label.includes(':') ? note.label.split(':')[0].trim() : note.label || 'Note');
        const context = note.context || (note.label && note.label.includes(':') ? note.label.split(':').slice(1).join(':').trim() : '');
        const displayLabel = context ? `${baseLabel}: ${context}` : baseLabel;
        
        // Get timecode - handle both timecode and elapsedHMS formats
        const timecode = note.timecode || note.elapsedHMS || formatTimecode(note.elapsedSeconds || 0, state.fps);
        
        item.innerHTML = `
            <div class="note-item-content">
                <span class="note-item-label">${escapeHtml(displayLabel)}</span>
                ${context ? '<span class="note-item-context-indicator" aria-label="Has additional context">✎</span>' : ''}
            </div>
            <span class="note-item-timecode" aria-label="Timecode: ${escapeHtml(timecode)}">${escapeHtml(timecode)}</span>
        `;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Edit note: ${escapeHtml(displayLabel)} at ${escapeHtml(timecode)}`);
        item.setAttribute('tabindex', '0');
        
        // Store index as data attribute for debugging/verification
        item.dataset.noteIndex = index;
        
        // Click handler - use a closure to capture the correct index
        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const noteIndex = parseInt(item.dataset.noteIndex);
            if (!isNaN(noteIndex) && state.session && state.session.notes && state.session.notes[noteIndex]) {
                editNote(noteIndex);
            }
        };
        
        item.addEventListener('click', clickHandler, { passive: false });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler(e);
            }
        });
        
        list.appendChild(item);
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        alert('No notes to export');
        return;
    }
    
    return state.session.notes.map(note => `${note.timecode}  ${note.label}`).join('\n');
}

// Export to Notes app (formatted for Notes)
function exportToNotes() {
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        alert('No notes to export');
        return;
    }
    
    const sessionName = state.session.name || 'Untitled Screening';
    const sessionDate = new Date(state.session.createdAt).toLocaleString();
    
    let notesText = `${sessionName}\n${sessionDate}\n\n`;
    notesText += 'Notes:\n';
    notesText += '─'.repeat(30) + '\n\n';
    
    state.session.notes.forEach((note, index) => {
        notesText += `${index + 1}. ${note.timecode} - ${note.label}\n`;
    });
    
    return notesText;
}

// Export formatted for email
function exportForEmail() {
    if (!state.session || !state.session.notes || state.session.notes.length === 0) {
        alert('No notes to export');
        return;
    }
    
    const sessionName = state.session.name || 'Untitled Screening';
    const sessionDate = new Date(state.session.createdAt).toLocaleString();
    
    let emailText = `Screening Notes: ${sessionName}\n`;
    emailText += `Date: ${sessionDate}\n\n`;
    emailText += 'Notes:\n';
    emailText += '─'.repeat(40) + '\n\n';
    
    state.session.notes.forEach((note, index) => {
        emailText += `${index + 1}. ${note.timecode} - ${note.label}\n`;
    });
    
    emailText += '\n' + '─'.repeat(40) + '\n';
    emailText += `Total Notes: ${state.session.notes.length}\n`;
    
    return emailText;
}

// Render sessions list
function renderSessionsList() {
    const list = $('sessionsList');
    if (!list) return;
    
    // Include current session if it exists
    const allSessions = [...state.sessionHistory];
    if (state.session && state.session.notes && state.session.notes.length > 0) {
        // Check if current session is already in history
        const existsInHistory = state.sessionHistory.some(s => s.id === state.session.id);
        if (!existsInHistory) {
            allSessions.unshift({ ...state.session, isCurrent: true });
        } else {
            // Mark current session
            const index = allSessions.findIndex(s => s.id === state.session.id);
            if (index >= 0) {
                allSessions[index] = { ...allSessions[index], isCurrent: true };
            }
        }
    }
    
    if (allSessions.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📚</div>
            <div class="empty-state-text">No saved sessions</div>
            <div class="empty-state-hint">Your session history will appear here</div>
        `;
        list.appendChild(emptyState);
        return;
    }
    
    // Sort by date (newest first)
    allSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    list.innerHTML = '';
    allSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        const date = new Date(session.createdAt);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const noteCount = session.notes ? session.notes.length : 0;
        const isCurrent = session.isCurrent || (state.session && state.session.id === session.id);
        
        item.innerHTML = `
            <div class="session-info">
                <div class="session-name-row">
                    <span class="session-name">${escapeHtml(session.name)}</span>
                    ${isCurrent ? '<span class="session-current-badge">Current</span>' : ''}
                </div>
                <div class="session-meta">${dateStr} ${timeStr} • ${noteCount} note${noteCount !== 1 ? 's' : ''}</div>
            </div>
            <div class="session-actions">
                <button class="btn-small session-load-btn" data-session-id="${session.id}" aria-label="Load session: ${escapeHtml(session.name)}">Load</button>
                <button class="btn-small session-rename-btn" data-session-id="${session.id}" aria-label="Rename session: ${escapeHtml(session.name)}">Rename</button>
                <button class="btn-small btn-danger session-delete-btn" data-session-id="${session.id}" aria-label="Delete session: ${escapeHtml(session.name)}">Delete</button>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    // Add event listeners
    list.querySelectorAll('.session-load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sessionId = btn.dataset.sessionId;
            loadSession(sessionId);
        });
    });
    
    list.querySelectorAll('.session-rename-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sessionId = btn.dataset.sessionId;
            renameSession(sessionId);
        });
    });
    
    list.querySelectorAll('.session-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sessionId = btn.dataset.sessionId;
            deleteSession(sessionId);
        });
    });
}

// Load a session
function loadSession(sessionId) {
    // Save current session to history first
    if (state.session && state.session.notes && state.session.notes.length > 0) {
        // Save elapsed time
        state.session.elapsedSeconds = state.elapsedSeconds;
        state.session.isRunning = state.isRunning;
        
        const existingIndex = state.sessionHistory.findIndex(s => s.id === state.session.id);
        if (existingIndex >= 0) {
            state.sessionHistory[existingIndex] = { ...state.session };
        } else {
            state.sessionHistory.push({ ...state.session });
        }
    }
    
    // Find session in history or use current
    let sessionToLoad = null;
    if (state.session && state.session.id === sessionId) {
        sessionToLoad = state.session;
    } else {
        sessionToLoad = state.sessionHistory.find(s => s.id === sessionId);
    }
    
    if (!sessionToLoad) {
        alert('Session not found');
        return;
    }
    
    // Load the session
    state.session = { ...sessionToLoad };
    state.screeningName = sessionToLoad.name;
    if (sessionToLoad.genre) {
        state.genre = sessionToLoad.genre;
    }
    
    // Restore button labels if available
    if (sessionToLoad.buttonLabels) {
        state.buttonLabels = sessionToLoad.buttonLabels;
    }
    
    // Restore elapsed time and running state
    state.elapsedSeconds = sessionToLoad.elapsedSeconds || 0;
    state.isRunning = false; // Always start paused when loading
    state.pausedTime = 0;
    state.startTime = null;
    
    // Update UI
    const screeningNameEl = $('screeningName');
    if (screeningNameEl) {
        const date = new Date(sessionToLoad.createdAt);
        const dateStr = date.toLocaleDateString();
        screeningNameEl.textContent = `${sessionToLoad.name} • ${dateStr}`;
        screeningNameEl.dataset.sessionId = sessionToLoad.id;
    }
    
    renderButtons();
    renderNotes();
    updateTimer();
    
    saveState();
    closeModal('sessionsModal');
    showToast('Session loaded', null);
}

// Rename a session
function renameSession(sessionId) {
    let sessionToRename = null;
    if (state.session && state.session.id === sessionId) {
        sessionToRename = state.session;
    } else {
        sessionToRename = state.sessionHistory.find(s => s.id === sessionId);
    }
    
    if (!sessionToRename) {
        alert('Session not found');
        return;
    }
    
    // Extract just the name part (remove date if present)
    const currentName = sessionToRename.name.includes(' • ') 
        ? sessionToRename.name.split(' • ')[0] 
        : sessionToRename.name;
    
    const newName = prompt('Enter new session name:', currentName);
    if (!newName || newName.trim() === '') {
        return;
    }
    
    const trimmedName = newName.trim();
    
    // Update session
    if (state.session && state.session.id === sessionId) {
        state.session.name = trimmedName;
        state.screeningName = trimmedName;
        const screeningNameEl = $('screeningName');
        if (screeningNameEl) {
            const date = new Date(state.session.createdAt);
            const dateStr = date.toLocaleDateString();
            screeningNameEl.textContent = `${trimmedName} • ${dateStr}`;
        }
    } else {
        const index = state.sessionHistory.findIndex(s => s.id === sessionId);
        if (index >= 0) {
            state.sessionHistory[index].name = trimmedName;
        }
    }
    
    saveState();
    renderSessionsList();
    showToast('Session renamed', null);
}

// Delete a session
function deleteSession(sessionId) {
    // Don't allow deleting current session
    if (state.session && state.session.id === sessionId) {
        alert('Cannot delete the current session. Start a new session first.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this session?')) {
        return;
    }
    
    const index = state.sessionHistory.findIndex(s => s.id === sessionId);
    if (index >= 0) {
        state.sessionHistory.splice(index, 1);
        saveState();
        renderSessionsList();
        showToast('Session deleted', null);
    }
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

// Track which modal is currently open for Escape key handling
let currentOpenModal = null;

// Show modal
function showModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent body scroll
        currentOpenModal = modalId;
        
        // Special handling for sessions modal - render list
        if (modalId === 'sessionsModal') {
            renderSessionsList();
        }
        
        // Focus management - for edit note modal, focus is handled in editNote() function
        // For other modals, focus first focusable element
        if (modalId !== 'editNoteModal') {
            setTimeout(() => {
                // Try close button first (if exists)
                const closeButton = modal.querySelector('.btn-close');
                if (closeButton && !closeButton.disabled) {
                    closeButton.focus();
                } else {
                    // Otherwise focus first input or button
                    const firstFocusable = modal.querySelector('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
                    if (firstFocusable) {
                        firstFocusable.focus();
                    }
                }
            }, 100);
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Restore body scroll
        
        if (currentOpenModal === modalId) {
            currentOpenModal = null;
        }
        
        // Return focus to the element that opened the modal (if available)
        const triggerButton = document.querySelector(`[data-opens-modal="${modalId}"]`);
        if (triggerButton) {
            setTimeout(() => triggerButton.focus(), 100);
        }
    }
}

// Close all modals (except setup modal)
function closeAllModals() {
    const modals = ['settingsModal', 'exportModal', 'confirmModal', 'otherNoteModal', 'sessionsModal', 'editNoteModal'];
    modals.forEach(id => {
        const modal = $(id);
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
    });
    currentOpenModal = null;
    document.body.style.overflow = '';
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
        modal.setAttribute('aria-hidden', 'false');
        // Ensure it's on top
        modal.style.zIndex = '10001';
        // Force top positioning
        modal.style.alignItems = 'flex-start';
        modal.style.justifyContent = 'center';
        modal.style.paddingTop = '10px';
        modal.style.paddingBottom = '10px';
        modal.style.paddingLeft = '10px';
        modal.style.paddingRight = '10px';
        document.body.style.overflow = 'hidden';
        
        // Focus name input after a short delay
        setTimeout(() => {
            const nameInput = $('screeningNameInput');
            if (nameInput) {
                nameInput.focus();
            }
        }, 150);
    }
    // Clear inputs
    const nameInput = $('screeningNameInput');
    if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
    }
    
    // Auto-select "Default" genre
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.setAttribute('aria-checked', 'false');
        if (btn.dataset.genre === 'default') {
            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            state.genre = 'default';
        }
    });
    
    // Enable start button since genre is selected
    const startBtn = $('startScreeningBtn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.setAttribute('aria-disabled', 'false');
    }
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
    
    // Update header with screening name and date
    const screeningNameEl = $('screeningName');
    if (screeningNameEl) {
        const date = new Date();
        const dateStr = date.toLocaleDateString();
        screeningNameEl.textContent = `${screeningName} • ${dateStr}`;
        screeningNameEl.dataset.sessionId = state.session.id;
        screeningNameEl.style.cursor = 'pointer';
        screeningNameEl.title = 'Tap to rename';
    }
    
    // Force scroll to top BEFORE closing modal
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
    }
    
    // Close setup modal - force close
    const setupModal = $('setupModal');
    if (setupModal) {
        setupModal.classList.remove('active');
        setupModal.setAttribute('aria-hidden', 'true');
        setupModal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Force scroll to top immediately after closing modal
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Initialize app
    renderButtons();
    renderNotes();
    updateTimer();
    
    // Force scroll to top multiple times to ensure it sticks
    const forceScrollToTop = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (window.pageYOffset > 0) {
            window.scrollTo(0, 0);
        }
    };
    
    // Scroll immediately after rendering
    forceScrollToTop();
    
    // Scroll after multiple delays to catch any layout shifts
    setTimeout(forceScrollToTop, 0);
    setTimeout(forceScrollToTop, 10);
    setTimeout(forceScrollToTop, 50);
    setTimeout(forceScrollToTop, 100);
    setTimeout(forceScrollToTop, 200);
    setTimeout(forceScrollToTop, 300);
}

// Show other note modal
function showOtherNoteModal() {
    const modal = $('otherNoteModal');
    const input = $('otherNoteInput');
    if (modal) {
        // Ensure dim overlay stays at current level (don't reset it)
        // The dim overlay z-index is 9999, modal is 10001, so modal appears above
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
    // Global keyboard handlers
    document.addEventListener('keydown', (e) => {
        // Escape key - close current modal
        if (e.key === 'Escape' && currentOpenModal) {
            // Don't close setup modal with Escape (user must use Start button)
            if (currentOpenModal !== 'setupModal') {
                closeModal(currentOpenModal);
                e.preventDefault();
            }
        }
    });
    
    // Start/Pause button
    const startPauseBtn = $('startPauseBtn');
    if (startPauseBtn) {
        startPauseBtn.addEventListener('click', toggleTimer);
        
        // Allow Space/Enter to toggle timer
        startPauseBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTimer();
            }
        });
    }
    
    // Setup modal - genre selection
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selection from all
            document.querySelectorAll('.genre-btn').forEach(b => {
                b.classList.remove('selected');
                b.setAttribute('aria-checked', 'false');
            });
            // Add to clicked
            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            state.genre = btn.dataset.genre;
            
            // Enable start button (name is optional, defaults to "Untitled Screening")
            const startBtn = $('startScreeningBtn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.setAttribute('aria-disabled', 'false');
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
                startBtn.setAttribute('aria-disabled', (!state.genre).toString());
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
        closeOtherNote.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('otherNoteModal');
            }
        });
    }
    
    const logOtherNoteBtn = $('logOtherNoteBtn');
    if (logOtherNoteBtn) {
        logOtherNoteBtn.addEventListener('click', logOtherNote);
        logOtherNoteBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                logOtherNote();
            }
        });
    }
    
    // Allow Enter key in other note input
    const otherNoteInput = $('otherNoteInput');
    if (otherNoteInput) {
        otherNoteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                logOtherNote();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal('otherNoteModal');
            }
        });
    }
    
    // Allow Enter key in edit note input
    const editNoteInput = $('editNoteInput');
    if (editNoteInput) {
        editNoteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const saveBtn = $('saveEditNoteBtn');
                if (saveBtn) saveBtn.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal('editNoteModal');
            }
        });
    }
    
    // Allow Enter key in screening name input
    const screeningNameInput = $('screeningNameInput');
    if (screeningNameInput) {
        screeningNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const startBtn = $('startScreeningBtn');
                if (startBtn && !startBtn.disabled) {
                    startBtn.click();
                }
            }
        });
    }
    
    // New session
    const newBtn = $('newBtn');
    if (newBtn) {
        newBtn.setAttribute('data-opens-modal', 'confirmModal');
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
        settingsBtn.setAttribute('data-opens-modal', 'settingsModal');
        settingsBtn.addEventListener('click', () => {
            renderSettings();
            showModal('settingsModal');
        });
    }
    
    const closeSettings = $('closeSettings');
    if (closeSettings) {
        closeSettings.addEventListener('click', () => closeModal('settingsModal'));
        closeSettings.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('settingsModal');
            }
        });
    }
    
    const saveSettings = $('saveSettings');
    if (saveSettings) {
        saveSettings.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Trigger click handler
            }
        });
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
            if (labels.length >= 3 && labels.length <= 10) {
                state.buttonLabels = labels;
            } else {
                alert('Please provide 3-10 button labels');
                return;
            }
            
            saveState();
            renderButtons();
            closeModal('settingsModal');
        });
    }
    
    // Make screening name clickable to rename
    const screeningNameEl = $('screeningName');
    if (screeningNameEl) {
        screeningNameEl.addEventListener('click', () => {
            if (state.session && state.session.id) {
                renameSession(state.session.id);
            }
        });
    }
    
    // Undo
    const undoBtn = $('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastNote);
        undoBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                undoLastNote();
            }
        });
    }
    
    // Sessions
    const sessionsBtn = $('sessionsBtn');
    if (sessionsBtn) {
        sessionsBtn.setAttribute('data-opens-modal', 'sessionsModal');
        sessionsBtn.addEventListener('click', () => showModal('sessionsModal'));
    }
    
    const closeSessions = $('closeSessions');
    if (closeSessions) {
        closeSessions.addEventListener('click', () => closeModal('sessionsModal'));
        closeSessions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('sessionsModal');
            }
        });
    }
    
    // Export
    const exportBtn = $('exportBtn');
    if (exportBtn) {
        exportBtn.setAttribute('data-opens-modal', 'exportModal');
        exportBtn.addEventListener('click', () => showModal('exportModal'));
        exportBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showModal('exportModal');
            }
        });
    }
    
    const closeExport = $('closeExport');
    if (closeExport) {
        closeExport.addEventListener('click', () => closeModal('exportModal'));
        closeExport.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('exportModal');
            }
        });
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
    
    const shareEmailBtn = $('shareEmailBtn');
    if (shareEmailBtn) {
        shareEmailBtn.addEventListener('click', async () => {
            const emailText = exportForEmail();
            if (emailText) {
                if (navigator.share) {
                    try {
                        await navigator.share({
                            text: emailText,
                            title: `Screening Notes: ${state.session.name || 'Untitled Screening'}`,
                            subject: `Screening Notes: ${state.session.name || 'Untitled Screening'}`
                        });
                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            // Fallback to mailto link if share fails
                            const subject = encodeURIComponent(`Screening Notes: ${state.session.name || 'Untitled Screening'}`);
                            const body = encodeURIComponent(emailText);
                            window.location.href = `mailto:?subject=${subject}&body=${body}`;
                        }
                    }
                } else {
                    // Fallback to mailto link if Web Share API not available
                    const subject = encodeURIComponent(`Screening Notes: ${state.session.name || 'Untitled Screening'}`);
                    const body = encodeURIComponent(emailText);
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }
            }
        });
    }
    
    const exportNotesBtn = $('exportNotesBtn');
    if (exportNotesBtn) {
        exportNotesBtn.addEventListener('click', async () => {
            const notesText = exportToNotes();
            if (notesText) {
                if (navigator.share) {
                    try {
                        await navigator.share({
                            text: notesText,
                            title: `${state.session.name || 'Screening Notes'}`
                        });
                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            // Fallback to copy if share fails
                            await copyToClipboard(notesText);
                        }
                    }
                } else {
                    // Fallback to copy if Web Share API not available
                    await copyToClipboard(notesText);
                }
            }
        });
    }
    
    // Clear
    // Clear button removed from UI - moved to menu or hidden for cleaner design
    // Clear functionality still available via confirm modal if needed
    
    // Edit Note Modal
    const closeEditNote = $('closeEditNote');
    if (closeEditNote) {
        closeEditNote.addEventListener('click', () => closeModal('editNoteModal'));
        closeEditNote.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('editNoteModal');
            }
        });
    }
    
    const saveEditNoteBtn = $('saveEditNoteBtn');
    if (saveEditNoteBtn) {
        saveEditNoteBtn.addEventListener('click', saveEditedNote);
        saveEditNoteBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                saveEditedNote();
            }
        });
    }
    
    const cancelEditNoteBtn = $('cancelEditNoteBtn');
    if (cancelEditNoteBtn) {
        cancelEditNoteBtn.addEventListener('click', () => {
            // Just close the modal without saving changes
            closeModal('editNoteModal');
        });
        cancelEditNoteBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModal('editNoteModal');
            }
        });
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
        // With RTL: slider value 0 = right (bright), slider value 90 = left (dim)
        // Slider value directly maps to dim level
        dimSlider.value = state.dimLevel || 0;
        // Apply dim overlay and text colors immediately
        updateDimOverlay(state.dimLevel || 0);
        
        // Use both input and change events for better mobile support
        // With RTL direction: slider value 0 = right (bright), slider value 85 = left (dim)
        // Slider value directly maps to dim level
        const updateDim = (e) => {
            let dimLevel = parseInt(e.target.value);
            const maxDim = 85;
            if (dimLevel > maxDim) {
                dimLevel = maxDim;
                dimSlider.value = maxDim;
            }
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
                let sliderValue = Math.max(0, Math.min(85, 100 - (x / rect.width) * 100));
                // Limit to max dim of 85%
                const maxDim = 85;
                if (sliderValue > maxDim) {
                    sliderValue = maxDim;
                }
                dimSlider.value = sliderValue;
                state.dimLevel = sliderValue;
                updateDimOverlay(sliderValue);
                saveState();
            }
        }, { passive: false });
        dimSlider.addEventListener('touchend', () => {
            isDragging = false;
        });
    }
}

// Update dim overlay opacity and text brightness
function updateDimOverlay(level) {
    // Limit maximum dim to 85%
    const maxDim = 85;
    const clampedLevel = Math.min(level, maxDim);
    
    const dimOverlay = $('dimOverlay');
    if (dimOverlay) {
        const opacity = clampedLevel / 100;
        dimOverlay.style.opacity = opacity.toString();
        if (opacity > 0) {
            dimOverlay.classList.add('active');
        } else {
            dimOverlay.classList.remove('active');
        }
    }
    
    // Also dim text brightness - convert white to dark grey based on dim level
    const dimPercent = clampedLevel / 100;
    // Interpolate from white (#ffffff) to dark grey (#333333)
    const r = Math.round(255 - (255 - 51) * dimPercent);
    const g = Math.round(255 - (255 - 51) * dimPercent);
    const b = Math.round(255 - (255 - 51) * dimPercent);
    const textColor = `rgb(${r}, ${g}, ${b})`;
    
    // Update specific text elements (including modal content)
    // Exclude dimToggleBtn - it gets special treatment below
    const textElements = document.querySelectorAll('.screening-name, .elapsed-time, .note-item-label, .summary-label, .note-button, .btn-primary, .btn-small:not(#dimToggleBtn), .modal-header h2, .modal-body, .modal-body p, .input-text, .setting-group label');
    textElements.forEach(el => {
        // Skip dim button if it's in the list
        if (el.id === 'dimToggleBtn') return;
        if (clampedLevel > 0) {
            el.style.color = textColor;
        } else {
            el.style.color = ''; // Reset to default
        }
    });
    
    // Update toast notification dimming
    const toast = $('toast');
    if (toast && toast.classList.contains('show')) {
        if (clampedLevel > 0) {
            toast.style.color = textColor;
            // Dim background color too
            const bgR = Math.round(26 - 26 * dimPercent);
            const bgG = Math.round(26 - 26 * dimPercent);
            const bgB = Math.round(26 - 26 * dimPercent);
            toast.style.backgroundColor = `rgba(${bgR}, ${bgG}, ${bgB}, 1)`;
        } else {
            toast.style.color = '';
            toast.style.backgroundColor = '';
        }
    }
    
    // Dim button gets special treatment - only dims to 50% max so it stays visible
    const dimButton = $('dimToggleBtn');
    if (dimButton && clampedLevel > 0) {
        const dimButtonPercent = Math.min(clampedLevel, 50) / 100;
        const dimButtonR = Math.round(255 - (255 - 51) * dimButtonPercent);
        const dimButtonG = Math.round(255 - (255 - 51) * dimButtonPercent);
        const dimButtonB = Math.round(255 - (255 - 51) * dimButtonPercent);
        const dimButtonColor = `rgb(${dimButtonR}, ${dimButtonG}, ${dimButtonB})`;
        dimButton.style.color = dimButtonColor;
    } else if (dimButton) {
        dimButton.style.color = ''; // Reset to default
    }
    
    // Update timecode (lighter text)
    const lightTextElements = document.querySelectorAll('.timecode, .note-item-timecode, .summary-count, .btn-close');
    const lightR = Math.round(170 - (170 - 51) * dimPercent);
    const lightG = Math.round(170 - (170 - 51) * dimPercent);
    const lightB = Math.round(170 - (170 - 51) * dimPercent);
    const lightTextColor = `rgb(${lightR}, ${lightG}, ${lightB})`;
    lightTextElements.forEach(el => {
        if (clampedLevel > 0) {
            el.style.color = lightTextColor;
        } else {
            el.style.color = ''; // Reset to default
        }
    });
    
    // Update slider value if it exceeds max
    const dimSlider = $('dimSlider');
    if (dimSlider && level > maxDim) {
        // With RTL: slider value 0 = right (bright), so max dim (85) = slider value 15
        dimSlider.value = maxDim;
        state.dimLevel = maxDim;
        saveState();
    }
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
        input.id = `button-label-${index}`;
        // Show capitalized version in input, but store original
        input.value = capitalizeLabel(label);
        input.placeholder = `Button ${index + 1}`;
        input.setAttribute('aria-label', `Button ${index + 1} label`);
        
        // Add remove button (red X) - show if more than minimum (3 buttons)
        // Always allow deletion as long as we have more than 3
        if (state.buttonLabels.length > 3) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove button ${index + 1}`);
            removeBtn.title = 'Remove button';
            removeBtn.addEventListener('click', () => {
                if (state.buttonLabels.length > 3) {
                    state.buttonLabels.splice(index, 1);
                    saveState();
                    renderSettings();
                } else {
                    alert('Minimum 3 buttons required');
                }
            });
            div.appendChild(removeBtn);
        }
        
        input.addEventListener('blur', () => {
            const newValue = input.value.trim();
            if (newValue) {
                // Store lowercase version for logic, but display will be capitalized
                if (newValue.toUpperCase() === 'VFX') {
                    state.buttonLabels[index] = 'VFX';
                } else {
                    state.buttonLabels[index] = newValue.toLowerCase();
                }
            }
        });
        
        div.appendChild(input);
        container.appendChild(div);
    });
    
    // Add button with plus sign (up to 10 buttons) - always show at bottom
    const addButtonDiv = document.createElement('div');
    addButtonDiv.className = 'add-button-container';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add-button';
        addBtn.innerHTML = '<span class="add-button-plus" aria-hidden="true">+</span> Add Button';
        addBtn.setAttribute('aria-label', 'Add new button');
        
        if (state.buttonLabels.length >= 10) {
            addBtn.disabled = true;
            addBtn.setAttribute('aria-disabled', 'true');
            addBtn.setAttribute('aria-label', 'Maximum 10 buttons reached');
            addBtn.title = 'Maximum 10 buttons reached';
        } else {
            addBtn.addEventListener('click', () => {
                if (state.buttonLabels.length < 10) {
                    // Add new button label
                    state.buttonLabels.push(`button ${state.buttonLabels.length + 1}`);
                    renderSettings();
                    // Focus the new input
                    setTimeout(() => {
                        const inputs = container.querySelectorAll('input');
                        if (inputs.length > 0) {
                            const lastInput = inputs[inputs.length - 1];
                            lastInput.focus();
                            lastInput.select();
                        }
                    }, 100);
                }
            });
        }
    
    addButtonDiv.appendChild(addBtn);
    container.appendChild(addButtonDiv);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

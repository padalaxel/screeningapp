# Screening Notes

A lightweight web app optimized for taking time-coded notes during film screenings in a dark theater. Designed for iPhone use with large tap targets and minimal typing required.

## Features

- **Timer**: Elapsed time tracking with timecode display (supports 23.976, 24, 25, 29.97, 30 FPS)
- **Quick Notes**: 6-9 large, customizable buttons for rapid note-taking without typing
- **Time-coded Logging**: Each note includes elapsed time, timecode (HH:MM:SS:FF), and device timestamp
- **Export**: Share or download notes as CSV or plain text
- **Summary**: View counts per label
- **Dark Mode**: Extremely dark theme optimized for theater use
- **Dim Overlay**: Software dim layer for additional screen darkening
- **Offline Support**: Service worker for basic offline functionality

## GitHub Pages Deployment

This app is deployed to GitHub Pages from the repository root.

**Published URL Format:**
```
https://<your-username>.github.io/screeningapp/
```

or if the repository name is `screening-notes`:
```
https://<your-username>.github.io/screening-notes/
```

### Setting Up GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Source**, select:
   - **Deploy from a branch**: `main`
   - **Folder**: `/ (root)`
4. Click **Save**
5. GitHub will provide your published URL (usually takes 1-2 minutes to become active)

## Adding to iPhone Home Screen

1. Open the app in Safari on your iPhone
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Optionally customize the name, then tap **Add**
5. The app will now appear on your home screen and can be opened in standalone mode

## Usage

### Starting a Session

1. Tap **Start** when the first frame appears
2. The timer will begin counting elapsed time
3. Tap **Pause** to pause the timer (tap **Resume** to continue)

### Taking Notes

- Tap any of the large buttons to log a note at the current timecode
- Buttons are customizable in Settings (see below)
- Each note includes:
  - Label (button name)
  - Elapsed time (HH:MM:SS)
  - Timecode (HH:MM:SS:FF)
  - Device timestamp

### Viewing Notes

- All notes appear in the list below the buttons
- Tap a note to delete it (confirmation required)
- Tap **Summary** to see counts per label

### Settings

Tap **Settings** to configure:

- **FPS**: Select frame rate (23.976, 24, 25, 29.97, or 30)
- **Button Labels**: Edit button labels (6-9 buttons required)
  - Tap in the input fields to edit
  - Leave empty inputs to remove buttons (must maintain 6-9 total)
  - Tap **Save** to apply changes

### Exporting Notes

Tap **Export** to access export options:

- **Share CSV**: Share CSV file via iOS Share sheet or download
- **Share Text**: Share plain text file via iOS Share sheet or download
- **Copy CSV**: Copy CSV to clipboard
- **Copy Text**: Copy plain text to clipboard

**CSV Format:**
```csv
SessionName,Date,Label,ElapsedTime,Timecode,FPS,DeviceTimestamp
Session 12/25/2024 10:30 AM,2024-12-25T10:30:00.000Z,Note 1,125.500,00:02:05:12,24,2024-12-25T10:32:05.500Z
```

**Text Format:**
```
00:02:05:12  Note 1
00:05:30:08  Note 2
```

### Starting a New Session

- Tap **New** to start a fresh session
- This resets the timer and clears all notes (confirmation required)

### Clearing Notes

- Tap **Clear** to remove all notes from the current session (confirmation required)

### Dim Overlay

- Tap **Dim** to toggle a software dim layer over the entire app
- This provides additional screen darkening without changing system brightness

## Technical Details

- **No Build Required**: Pure HTML, CSS, and JavaScript
- **Local Storage**: All data persists locally in browser storage
- **Service Worker**: Basic offline caching with network-first strategy for navigation
- **Progressive Web App**: Can be installed as a standalone app

## Browser Compatibility

Optimized for iOS Safari. Works on modern browsers with:
- LocalStorage support
- Service Worker support (optional)
- Web Share API (optional, falls back to download)

## License

MIT License - feel free to use and modify as needed.

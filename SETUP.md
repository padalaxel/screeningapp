# Setup Instructions for GitHub Repository

Your Screening Notes app is ready to be pushed to GitHub! Follow these steps:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `screeningapp` (or `screening-notes` if `screeningapp` already exists)
3. **Description**: "Time-coded note-taking app for film screenings"
4. **Visibility**: Choose Public or Private
5. **IMPORTANT**: Do NOT check any of these boxes:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license
6. Click **"Create repository"**

## Step 2: Push Your Code

After creating the repository, GitHub will show you commands. Use these instead (already configured):

```bash
cd "/Users/paulrogers/Documents/screening app"
git remote add origin https://github.com/YOUR_USERNAME/screeningapp.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username.**

Or if you prefer to use the helper script:

```bash
cd "/Users/paulrogers/Documents/screening app"
./create-repo.sh YOUR_USERNAME screeningapp
# Then follow the instructions it prints
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (in the repository navigation bar)
3. Scroll down to **Pages** (in the left sidebar)
4. Under **Source**, select:
   - **Deploy from a branch**: `main`
   - **Folder**: `/ (root)`
5. Click **Save**
6. Wait 1-2 minutes for GitHub to build and deploy
7. Your site will be available at:
   ```
   https://YOUR_USERNAME.github.io/screeningapp/
   ```
   (or `screening-notes` if you used that name)

## Step 4: Verify Deployment

1. Visit your GitHub Pages URL
2. You should see the Screening Notes app
3. Test the timer and note-taking functionality
4. On iPhone Safari, test "Add to Home Screen"

## Troubleshooting

- **If the repository name is taken**: Use `screening-notes` instead
- **If push fails**: Make sure you're authenticated with GitHub (check `git config --global credential.helper`)
- **If Pages doesn't load**: Wait a few minutes, then check the Pages settings again
- **If service worker doesn't work**: Clear browser cache and reload

## Next Steps

Once deployed, you can:
- Share the GitHub Pages URL
- Add the app to your iPhone home screen
- Start taking screening notes!

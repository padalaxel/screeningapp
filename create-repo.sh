#!/bin/bash
# Script to create GitHub repository and push code
# Usage: ./create-repo.sh <github-username> [repo-name]

GITHUB_USER="${1:-}"
REPO_NAME="${2:-screeningapp}"

if [ -z "$GITHUB_USER" ]; then
    echo "Usage: $0 <github-username> [repo-name]"
    echo "Example: $0 paulrogers screeningapp"
    exit 1
fi

# Check if repo name should be screening-notes if screeningapp exists
echo "Attempting to create repository: $REPO_NAME"
echo "If it already exists, you may need to use 'screening-notes' instead"

# Add remote
git remote remove origin 2>/dev/null
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"

echo ""
echo "Repository remote configured."
echo ""
echo "Next steps:"
echo "1. Create the repository on GitHub:"
echo "   - Go to https://github.com/new"
echo "   - Repository name: $REPO_NAME"
echo "   - Make it Public (or Private)"
echo "   - DO NOT initialize with README, .gitignore, or license"
echo "   - Click 'Create repository'"
echo ""
echo "2. Then run:"
echo "   git push -u origin main"
echo ""
echo "Or if you have GitHub CLI (gh) installed:"
echo "   gh repo create $REPO_NAME --public --source=. --remote=origin --push"

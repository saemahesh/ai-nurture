#!/bin/bash

# Deployment script to update cache versions and push changes
# Run this script before deploying to increment version numbers and commit changes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current timestamp for version
NEW_VERSION=$(date +%s)

echo -e "${BLUE}🚀 Updating app version to: ${GREEN}v$NEW_VERSION${NC}"

# Update app.js version
sed -i.bak "s/const APP_VERSION = '[^']*'/const APP_VERSION = 'v$NEW_VERSION'/" backend/public/frontend/app.js

# Update service worker cache name
sed -i.bak "s/const CACHE_NAME = '[^']*'/const CACHE_NAME = 'whatspro-app-v$NEW_VERSION'/" backend/public/frontend/sw.js

# Clean up backup files
rm -f backend/public/frontend/app.js.bak
rm -f backend/public/frontend/sw.js.bak

echo -e "${GREEN}✅ Version updated successfully!${NC}"
echo -e "${BLUE}📦 New version: ${GREEN}v$NEW_VERSION${NC}"
echo ""
echo -e "${BLUE}📝 Files updated:${NC}"
echo "- backend/public/frontend/app.js"
echo "- backend/public/frontend/sw.js"
echo ""

# Check if git is available and we're in a git repository
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${BLUE}📋 Adding updated files to git...${NC}"
    
    # Add the updated files to git
    git add backend/public/frontend/app.js
    git add backend/public/frontend/sw.js
    
    echo -e "${GREEN}📋 Added version files to git staging${NC}"
    
    # Commit the version bump
    commit_message="chore: bump app version to v$NEW_VERSION"
    git commit -m "$commit_message"
    echo -e "${GREEN}📝 Committed version bump: $commit_message${NC}"
    
    # Ask if user wants to push
    echo -e "${YELLOW}🔄 Do you want to push the changes now? (y/n)${NC}"
    read -r push_choice
    if [[ "$push_choice" =~ ^[Yy]$ ]]; then
        git push
        echo -e "${GREEN}🚀 Changes pushed to remote repository${NC}"
    else
        echo -e "${BLUE}💡 Don't forget to push your changes: git push${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Git not available or not in a git repository${NC}"
    echo -e "${BLUE}💡 Remember to commit your changes manually${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Version update completed successfully!${NC}"
echo -e "${BLUE}📦 App version: ${GREEN}v$NEW_VERSION${NC}"
echo -e "${BLUE}🏷️  Cache version: ${GREEN}whatspro-app-v$NEW_VERSION${NC}"
echo ""

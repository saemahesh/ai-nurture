#!/bin/bash

# Deployment script to update cache versions
# Run this script before deploying to increment version numbers

# Get current timestamp for version
NEW_VERSION=$(date +%s)

echo "Updating app version to: $NEW_VERSION"

# Update app.js version
sed -i.bak "s/const APP_VERSION = '[^']*'/const APP_VERSION = 'v$NEW_VERSION'/" backend/public/frontend/app.js

# Update service worker cache name
sed -i.bak "s/const CACHE_NAME = '[^']*'/const CACHE_NAME = 'whatspro-app-v$NEW_VERSION'/" backend/public/frontend/sw.js

# Clean up backup files
rm -f backend/public/frontend/app.js.bak
rm -f backend/public/frontend/sw.js.bak

echo "Version updated successfully!"
echo "New version: v$NEW_VERSION"
echo ""
echo "Files updated:"
echo "- backend/public/frontend/app.js"
echo "- backend/public/frontend/sw.js"
echo ""
echo "You can now deploy these changes."

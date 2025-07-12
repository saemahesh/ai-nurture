#!/bin/bash

# Test curl command for scheduling with multiple groups
curl -v -X POST http://localhost:3000/schedule \
  -H 'Cookie: connect.sid=REPLACE_WITH_YOUR_SESSION_COOKIE' \
  -F 'groupIds=["1234","32323"]' \
  -F 'message=Test message from curl' \
  -F 'time=2025-05-01T14:47:00.000Z' \
  -F 'image=@public/uploads/test-image.jpg'

# Note: Before running this test:
# 1. Make sure you're logged in to the app in your browser
# 2. Copy your session cookie from the browser and replace it in the command above
# 3. Make sure there's an image at public/uploads/test-image.jpg
# 4. Run this script with: bash test-curl.sh
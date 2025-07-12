const express = require('express');
const http = require('http');
const path = require('path');

// Test data for campaign sequences
const testSequence = {
  "id": "test_seq_123",
  "name": "Test Campaign",
  "description": "Test campaign for deletion",
  "status": "active",
  "username": "testuser",
  "messages": [
    {
      "day": 1,
      "type": "text",
      "message": "Test message 1",
      "time": "09:00"
    }
  ],
  "total_days": 1,
  "created_at": new Date().toISOString(),
  "updated_at": new Date().toISOString()
};

const testEnrollment = {
  "id": "test_enroll_123",
  "sequence_id": "test_seq_123",
  "username": "testuser",
  "phone": "1234567890",
  "name": "Test User",
  "enrolled_at": new Date().toISOString(),
  "current_day": 1,
  "status": "active",
  "last_message_sent": null,
  "next_message_due": null,
  "messages_sent": 0,
  "total_messages": 1,
  "custom_fields": {}
};

const testLead = {
  "id": "test_lead_123",
  "campaignId": "test_seq_123",
  "username": "testuser",
  "phone": "1234567890",
  "name": "Test User",
  "createdAt": new Date().toISOString()
};

const testQueueEntry = {
  "id": "test_seq_123-1234567890-0-" + Date.now(),
  "campaignId": "test_seq_123",
  "username": "testuser",
  "phone": "1234567890",
  "leadData": testLead,
  "messageIndex": 0,
  "message": {
    "id": "msg-0",
    "type": "text",
    "message": "Test message 1",
    "mediaUrl": null,
    "day": 1
  },
  "scheduledAt": new Date().toISOString(),
  "status": "pending",
  "createdAt": new Date().toISOString(),
  "attempts": 0
};

console.log('Test data created:');
console.log('Enrollment:', testEnrollment);
console.log('Lead:', testLead);
console.log('Queue Entry:', testQueueEntry);

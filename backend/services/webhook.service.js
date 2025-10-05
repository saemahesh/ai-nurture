const axios = require('axios');

/**
 * Service for managing WhatsApp webhook registration with robomate.in
 */

/**
 * Register webhook URL with robomate.in for a specific instance
 * @param {string} instanceId - WhatsApp instance ID
 * @param {string} accessToken - Access token for robomate.in API
 * @param {string} webhookUrl - Webhook URL to register
 * @returns {Promise<Object>} Registration result
 */
async function registerWebhook(instanceId, accessToken, webhookUrl) {
  // Default webhook URL as specified by user requirements  
  if (!webhookUrl) {
    webhookUrl = 'https://whatspro.robomate.in/api/webhook/enroll';
  }
  try {
    console.log(`\n=== WEBHOOK REGISTRATION START ===`);
    console.log(`[WEBHOOK] Attempting to register webhook for instance: ${instanceId}`);
    console.log(`[WEBHOOK] Webhook URL: ${webhookUrl}`);
    console.log(`[WEBHOOK] Access Token: ${accessToken ? accessToken.substring(0, 10) + '...' : 'MISSING'}`);
    
    const apiUrl = 'https://wa.robomate.in/api/set_webhook';
    console.log(`[WEBHOOK] API URL: ${apiUrl}`);
    
    // Prepare parameters
    const params = {
      webhook_url: webhookUrl,
      enable: 'true',
      instance_id: instanceId,
      access_token: accessToken
    };
    
    console.log(`[WEBHOOK] Request parameters:`, {
      webhook_url: params.webhook_url,
      enable: params.enable,
      instance_id: params.instance_id,
      access_token: params.access_token ? params.access_token.substring(0, 10) + '...' : 'MISSING'
    });
    
    const requestConfig = {
      params: params,
      timeout: 30000 // 30 second timeout
    };
    
    console.log(`[WEBHOOK] Making GET request to robomate.in API...`);
    const startTime = Date.now();
    
    // Make GET request to robomate.in
    const response = await axios.get(apiUrl, requestConfig);
    
    const duration = Date.now() - startTime;
    console.log(`[WEBHOOK] Request completed in ${duration}ms`);
    console.log(`[WEBHOOK] Response status: ${response.status}`);
    console.log(`[WEBHOOK] Response headers:`, response.headers);
    console.log(`[WEBHOOK] Response data:`, JSON.stringify(response.data, null, 2));
    
    const result = {
      success: true,
      data: response.data,
      instanceId: instanceId,
      webhookUrl: webhookUrl,
      duration: duration
    };
    
    console.log(`[WEBHOOK] ✅ Registration SUCCESSFUL for instance ${instanceId}`);
    console.log(`=== WEBHOOK REGISTRATION END ===\n`);
    
    return result;
    
  } catch (error) {
    console.log(`\n=== WEBHOOK REGISTRATION ERROR ===`);
    console.error(`[WEBHOOK] ❌ Failed to register webhook for instance ${instanceId}`);
    console.error(`[WEBHOOK] Error type: ${error.constructor.name}`);
    console.error(`[WEBHOOK] Error message: ${error.message}`);
    
    if (error.code) {
      console.error(`[WEBHOOK] Error code: ${error.code}`);
    }
    
    if (error.response) {
      console.error(`[WEBHOOK] Response status: ${error.response.status}`);
      console.error(`[WEBHOOK] Response headers:`, error.response.headers);
      console.error(`[WEBHOOK] Response data:`, error.response.data);
    } else if (error.request) {
      console.error(`[WEBHOOK] No response received. Request config:`, error.request);
    }
    
    console.error(`[WEBHOOK] Full error stack:`, error.stack);
    console.log(`=== WEBHOOK REGISTRATION ERROR END ===\n`);
    
    return {
      success: false,
      error: error.message,
      instanceId: instanceId,
      webhookUrl: webhookUrl,
      details: error.response ? error.response.data : null,
      errorType: error.constructor.name,
      errorCode: error.code
    };
  }
}

/**
 * Unregister webhook for a specific instance
 * @param {string} instanceId - WhatsApp instance ID
 * @param {string} accessToken - Access token for robomate.in API
 * @returns {Promise<Object>} Unregistration result
 */
async function unregisterWebhook(instanceId, accessToken) {
  try {
    console.log(`[WEBHOOK] Unregistering webhook for instance ${instanceId}`);
    
    const apiUrl = 'https://wa.robomate.in/api/set_webhook';
    
    // Prepare parameters to disable webhook
    const params = {
      webhook_url: '',
      enable: 'false',
      instance_id: instanceId,
      access_token: accessToken
    };
    
    // Make POST request to robomate.in
    const response = await axios.get(apiUrl, {
      params: params,
      timeout: 30000
    });
    
    console.log(`[WEBHOOK] Unregistration response for ${instanceId}:`, response.data);
    
    return {
      success: true,
      data: response.data,
      instanceId: instanceId
    };
    
  } catch (error) {
    console.error(`[WEBHOOK] Failed to unregister webhook for instance ${instanceId}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      instanceId: instanceId,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Check webhook status for a specific instance
 * @param {string} instanceId - WhatsApp instance ID
 * @param {string} accessToken - Access token for robomate.in API
 * @returns {Promise<Object>} Webhook status
 */
async function getWebhookStatus(instanceId, accessToken) {
  try {
    console.log(`[WEBHOOK] Checking webhook status for instance ${instanceId}`);
    
    // This would need to be implemented if robomate.in provides a status endpoint
    // For now, we'll just return a placeholder
    return {
      success: true,
      instanceId: instanceId,
      status: 'unknown',
      message: 'Webhook status check not available in robomate.in API'
    };
    
  } catch (error) {
    console.error(`[WEBHOOK] Failed to check webhook status for instance ${instanceId}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      instanceId: instanceId
    };
  }
}

module.exports = {
  registerWebhook,
  unregisterWebhook,
  getWebhookStatus
};

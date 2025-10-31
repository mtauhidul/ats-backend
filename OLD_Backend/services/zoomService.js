/**
 * Zoom Service for managing Zoom API interactions
 * Handles OAuth token generation and provides utilities for Zoom meeting management
 */

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Generate OAuth access token for Zoom API
 * Uses server-to-server OAuth flow with account credentials
 * @returns {Promise<string>} Access token for Zoom API calls
 */
async function generateZoomAccessToken() {
  try {
    // Validate required environment variables
    const { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID } = process.env;
    
    if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_ACCOUNT_ID) {
      throw new Error('Missing required Zoom environment variables: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, or ZOOM_ACCOUNT_ID');
    }

    // Create base64 encoded credentials for Basic auth
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
    
    logger.info('Generating Zoom access token...');
    
    // Request access token from Zoom OAuth endpoint
    const response = await axios.post('https://zoom.us/oauth/token', 
      new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID
      }),
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const tokenData = response.data;
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from Zoom OAuth');
    }

    logger.info('Zoom access token generated successfully');
    return tokenData.access_token;
    
  } catch (error) {
    logger.error('Error generating Zoom access token:', error);
    throw error;
  }
}

/**
 * Make authenticated request to Zoom API
 * @param {string} endpoint - Zoom API endpoint (relative to base URL)
 * @param {object} options - Axios options (method, data, etc.)
 * @returns {Promise<object>} API response data
 */
async function makeZoomApiRequest(endpoint, options = {}) {
  try {
    const token = await generateZoomAccessToken();
    const baseUrl = 'https://api.zoom.us/v2';
    
    const axiosConfig = {
      url: `${baseUrl}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Convert body to data for axios
    if (options.body) {
      axiosConfig.data = JSON.parse(options.body);
      delete axiosConfig.body;
    }
    
    logger.info(`Making Zoom API request to: ${endpoint}`);
    
    const response = await axios(axiosConfig);
    return response.data;
    
  } catch (error) {
    logger.error(`Zoom API request failed for ${endpoint}:`, error);
    
    // Handle axios errors
    if (error.response) {
      throw new Error(`Zoom API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
    }
    
    throw error;
  }
}

/**
 * Validate meeting data structure
 * @param {object} meetingData - Meeting data to validate
 * @returns {boolean} True if valid
 */
function validateMeetingData(meetingData) {
  const requiredFields = ['topic'];
  const missingFields = requiredFields.filter(field => !meetingData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required meeting fields: ${missingFields.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  generateZoomAccessToken,
  makeZoomApiRequest,
  validateMeetingData
};
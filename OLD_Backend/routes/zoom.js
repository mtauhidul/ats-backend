/**
 * Zoom Meeting Management Routes
 * Provides API endpoints for creating, updating, deleting, and retrieving Zoom meetings
 */

const express = require('express');
const router = express.Router();
const { makeZoomApiRequest, validateMeetingData } = require('../services/zoomService');
const logger = require('../utils/logger');
const { validateApiKey } = require('../middleware/auth');

/**
 * POST /api/zoom/meetings - Create a new Zoom meeting
 * @body {object} meetingData - Meeting configuration object
 * @returns {object} Created meeting details
 */
router.post('/meetings', validateApiKey, async (req, res) => {
  try {
    logger.info('Creating new Zoom meeting', { body: req.body });
    
    // Validate meeting data
    validateMeetingData(req.body);
    
    // Default meeting settings if not provided
    const meetingDefaults = {
      type: 2, // Scheduled meeting
      duration: 60, // 60 minutes default
      timezone: 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        cn_meeting: false,
        in_meeting: false,
        join_before_host: false,
        mute_upon_entry: true,
        watermark: false,
        use_pmi: false,
        approval_type: 0, // Automatically approve
        audio: 'both', // Both telephony and VoIP
        auto_recording: 'none',
        enforce_login: false,
        registrants_email_notification: true,
        waiting_room: false,
        allow_multiple_devices: false
      }
    };

    // Merge provided data with defaults
    const meetingData = {
      ...meetingDefaults,
      ...req.body,
      settings: {
        ...meetingDefaults.settings,
        ...(req.body.settings || {})
      }
    };

    // Create meeting via Zoom API
    const meeting = await makeZoomApiRequest('/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData)
    });

    logger.info('Zoom meeting created successfully', { 
      meetingId: meeting.id, 
      topic: meeting.topic 
    });

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: meeting
    });

  } catch (error) {
    logger.error('Error creating Zoom meeting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create meeting'
    });
  }
});

/**
 * PATCH /api/zoom/meetings/:meetingId - Update an existing Zoom meeting
 * @param {string} meetingId - The Zoom meeting ID to update
 * @body {object} updateData - Meeting update data
 * @returns {object} Success confirmation
 */
router.patch('/meetings/:meetingId', validateApiKey, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }

    logger.info('Updating Zoom meeting', { 
      meetingId, 
      updateData: req.body 
    });

    // Update meeting via Zoom API
    await makeZoomApiRequest(`/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });

    logger.info('Zoom meeting updated successfully', { meetingId });

    res.json({
      success: true,
      message: 'Meeting updated successfully',
      meetingId
    });

  } catch (error) {
    logger.error('Error updating Zoom meeting:', error);
    
    // Handle specific Zoom API errors
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update meeting'
    });
  }
});

/**
 * DELETE /api/zoom/meetings/:meetingId - Delete a Zoom meeting
 * @param {string} meetingId - The Zoom meeting ID to delete
 * @query {string} occurrence_id - Optional occurrence ID for recurring meetings
 * @returns {object} Success confirmation
 */
router.delete('/meetings/:meetingId', validateApiKey, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { occurrence_id } = req.query;
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }

    logger.info('Deleting Zoom meeting', { meetingId, occurrence_id });

    // Build endpoint with optional occurrence_id
    let endpoint = `/meetings/${meetingId}`;
    if (occurrence_id) {
      endpoint += `?occurrence_id=${occurrence_id}`;
    }

    // Delete meeting via Zoom API
    await makeZoomApiRequest(endpoint, {
      method: 'DELETE'
    });

    logger.info('Zoom meeting deleted successfully', { meetingId });

    res.json({
      success: true,
      message: 'Meeting deleted successfully',
      meetingId
    });

  } catch (error) {
    logger.error('Error deleting Zoom meeting:', error);
    
    // Handle specific Zoom API errors
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete meeting'
    });
  }
});

/**
 * GET /api/zoom/meetings/:meetingId - Get Zoom meeting details
 * @param {string} meetingId - The Zoom meeting ID to retrieve
 * @query {string} occurrence_id - Optional occurrence ID for recurring meetings
 * @returns {object} Meeting details
 */
router.get('/meetings/:meetingId', validateApiKey, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { occurrence_id } = req.query;
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }

    logger.info('Retrieving Zoom meeting details', { meetingId, occurrence_id });

    // Build endpoint with optional occurrence_id
    let endpoint = `/meetings/${meetingId}`;
    if (occurrence_id) {
      endpoint += `?occurrence_id=${occurrence_id}`;
    }

    // Get meeting details via Zoom API
    const meeting = await makeZoomApiRequest(endpoint, {
      method: 'GET'
    });

    logger.info('Zoom meeting details retrieved successfully', { 
      meetingId,
      topic: meeting.topic 
    });

    res.json({
      success: true,
      data: meeting
    });

  } catch (error) {
    logger.error('Error retrieving Zoom meeting:', error);
    
    // Handle specific Zoom API errors
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve meeting'
    });
  }
});

/**
 * GET /api/zoom/meetings - List user's Zoom meetings
 * @query {string} type - Meeting type (scheduled, live, upcoming, etc.)
 * @query {number} page_size - Number of records per page (max 300)
 * @query {string} next_page_token - Token for next page of results
 * @returns {object} List of meetings
 */
router.get('/meetings', validateApiKey, async (req, res) => {
  try {
    const { type = 'scheduled', page_size = 30, next_page_token } = req.query;
    
    logger.info('Listing Zoom meetings', { type, page_size, next_page_token });

    // Build query parameters
    const queryParams = new URLSearchParams({
      type,
      page_size: Math.min(page_size, 300) // Zoom API limit
    });
    
    if (next_page_token) {
      queryParams.append('next_page_token', next_page_token);
    }

    // Get meetings list via Zoom API
    const meetingsList = await makeZoomApiRequest(`/users/me/meetings?${queryParams}`, {
      method: 'GET'
    });

    logger.info('Zoom meetings list retrieved successfully', { 
      count: meetingsList.meetings?.length || 0 
    });

    res.json({
      success: true,
      data: meetingsList
    });

  } catch (error) {
    logger.error('Error listing Zoom meetings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve meetings list'
    });
  }
});

/**
 * POST /api/zoom/meetings/:meetingId/registrants - Add registrant to meeting
 * @param {string} meetingId - The Zoom meeting ID
 * @body {object} registrantData - Registrant information
 * @returns {object} Registrant details
 */
router.post('/meetings/:meetingId/registrants', validateApiKey, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }

    // Validate required registrant fields
    const { email, first_name } = req.body;
    if (!email || !first_name) {
      return res.status(400).json({
        success: false,
        error: 'Email and first_name are required for registration'
      });
    }

    logger.info('Adding registrant to Zoom meeting', { 
      meetingId, 
      email: req.body.email 
    });

    // Add registrant via Zoom API
    const registrant = await makeZoomApiRequest(`/meetings/${meetingId}/registrants`, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });

    logger.info('Registrant added successfully', { 
      meetingId,
      registrantId: registrant.id 
    });

    res.status(201).json({
      success: true,
      message: 'Registrant added successfully',
      data: registrant
    });

  } catch (error) {
    logger.error('Error adding meeting registrant:', error);
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add registrant'
    });
  }
});

/**
 * POST /api/zoom/interviews/schedule - Schedule interview with Zoom meeting and send invitation
 * Creates a Zoom meeting and automatically sends interview invitation email to candidate
 * @body {object} interviewData - Interview and candidate information
 * @returns {object} Meeting details and email confirmation
 */
router.post('/interviews/schedule', validateApiKey, async (req, res) => {
  try {
    const {
      // Candidate information
      candidateEmail,
      candidateName,
      
      // Interview details
      jobTitle,
      interviewDate,
      interviewTime,
      duration = 60,
      
      // Interviewer/Recruiter information
      interviewerName,
      recruiterName,
      recruiterEmail,
      recruiterPhone,
      recruiterTitle = 'Recruiter',
      companyName = 'YTFCS',
      
      // Optional meeting settings
      meetingSettings = {},
      
      // Optional email settings
      sendEmail = true
    } = req.body;

    logger.info('Scheduling interview with Zoom meeting', {
      candidateEmail,
      candidateName,
      jobTitle,
      interviewDate
    });

    // Validate required fields
    if (!candidateEmail || !candidateName) {
      return res.status(400).json({
        success: false,
        error: 'candidateEmail and candidateName are required'
      });
    }

    if (!interviewDate) {
      return res.status(400).json({
        success: false,
        error: 'interviewDate is required'
      });
    }

    // Parse and validate the interview date
    const meetingDateTime = new Date(interviewDate);
    if (isNaN(meetingDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interviewDate format. Please use ISO 8601 format (e.g., 2025-01-15T10:00:00Z)'
      });
    }

    // Prepare meeting data for Zoom
    const meetingData = {
      topic: `Interview: ${candidateName} - ${jobTitle || 'Position'}`,
      type: 2, // Scheduled meeting
      start_time: meetingDateTime.toISOString(),
      duration: parseInt(duration) || 60,
      timezone: 'UTC',
      agenda: `Interview session with ${candidateName} for the ${jobTitle || 'position'} role.`,
      settings: {
        host_video: true,
        participant_video: true,
        cn_meeting: false,
        in_meeting: false,
        join_before_host: true,
        mute_upon_entry: true,
        watermark: false,
        use_pmi: false,
        approval_type: 0, // Automatically approve
        audio: 'both', // Both telephony and VoIP
        auto_recording: 'none',
        enforce_login: false,
        registrants_email_notification: false, // We'll send our own
        waiting_room: true, // Enable waiting room for security
        allow_multiple_devices: false,
        ...meetingSettings
      }
    };

    // Create the Zoom meeting
    logger.info('Creating Zoom meeting for interview');
    const zoomMeeting = await makeZoomApiRequest('/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData)
    });

    logger.info('Zoom meeting created successfully', {
      meetingId: zoomMeeting.id,
      joinUrl: zoomMeeting.join_url
    });

    let emailResult = null;

    // Send interview invitation email if requested
    if (sendEmail) {
      try {
        const { sendInterviewInvitation } = require('../services/emailService');
        
        logger.info('Sending interview invitation email');
        emailResult = await sendInterviewInvitation({
          candidateEmail,
          candidateName,
          jobTitle,
          interviewDate: meetingDateTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          interviewTime: interviewTime || meetingDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          }),
          duration,
          interviewerName: interviewerName || recruiterName || 'Hiring Team',
          recruiterName: recruiterName || 'Hiring Team',
          recruiterEmail: recruiterEmail,
          recruiterPhone: recruiterPhone,
          recruiterTitle,
          companyName,
          zoomMeeting
        });

        logger.info('Interview invitation sent successfully', {
          emailId: emailResult.emailId,
          candidateEmail
        });

      } catch (emailError) {
        logger.error('Failed to send interview invitation email:', emailError);
        
        // Email failure shouldn't fail the entire operation
        emailResult = {
          success: false,
          error: emailError.message,
          message: 'Meeting created but email invitation failed to send'
        };
      }
    }

    // Prepare the response
    const response = {
      success: true,
      message: 'Interview scheduled successfully',
      data: {
        meeting: {
          id: zoomMeeting.id,
          topic: zoomMeeting.topic,
          join_url: zoomMeeting.join_url,
          start_time: zoomMeeting.start_time,
          duration: zoomMeeting.duration,
          password: zoomMeeting.password,
          created_at: zoomMeeting.created_at
        },
        interview: {
          candidateName,
          candidateEmail,
          jobTitle,
          interviewDate: meetingDateTime.toISOString(),
          interviewTime,
          duration,
          recruiterName,
          recruiterEmail
        },
        email: emailResult || { message: 'Email sending was disabled' }
      }
    };

    logger.info('Interview scheduling completed', {
      meetingId: zoomMeeting.id,
      candidateEmail,
      emailSent: emailResult?.success || false
    });

    res.status(201).json(response);

  } catch (error) {
    logger.error('Error scheduling interview:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to schedule interview',
      details: 'Please check the server logs for more information'
    });
  }
});

module.exports = router;
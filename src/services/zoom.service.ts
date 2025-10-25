import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import { InternalServerError } from '../utils/errors';

interface ZoomMeeting {
  id: string;
  join_url: string;
  start_url: string;
  password: string;
  topic: string;
  start_time: string;
  duration: number;
  timezone: string;
}

interface CreateMeetingOptions {
  topic: string;
  startTime: Date;
  duration: number; // minutes
  timezone?: string;
  agenda?: string;
  password?: string;
}

class ZoomService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Get Zoom OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: config.zoom.accountId,
          },
          auth: {
            username: config.zoom.clientId,
            password: config.zoom.clientSecret,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      if (!this.accessToken) {
        throw new InternalServerError('Failed to get access token from Zoom');
      }

      return this.accessToken;
    } catch (error: any) {
      logger.error('Zoom authentication error:', error);
      throw new InternalServerError('Failed to authenticate with Zoom');
    }
  }

  /**
   * Create Zoom meeting
   */
  async createMeeting(options: CreateMeetingOptions): Promise<ZoomMeeting> {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: options.topic,
          type: 2, // Scheduled meeting
          start_time: options.startTime.toISOString(),
          duration: options.duration,
          timezone: options.timezone || 'UTC',
          agenda: options.agenda,
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            watermark: false,
            use_pmi: false,
            approval_type: 0,
            audio: 'both',
            auto_recording: 'none',
          },
          password: options.password,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Zoom meeting created: ${response.data.id}`);

      return {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
        timezone: response.data.timezone,
      };
    } catch (error: any) {
      logger.error('Zoom meeting creation error:', error);
      throw new InternalServerError(`Failed to create Zoom meeting: ${error.message}`);
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<ZoomMeeting> {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
        timezone: response.data.timezone,
      };
    } catch (error: any) {
      logger.error('Zoom get meeting error:', error);
      throw new InternalServerError(`Failed to get Zoom meeting: ${error.message}`);
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<CreateMeetingOptions>
  ): Promise<void> {
    try {
      const token = await this.getAccessToken();

      await axios.patch(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          topic: updates.topic,
          start_time: updates.startTime?.toISOString(),
          duration: updates.duration,
          timezone: updates.timezone,
          agenda: updates.agenda,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Zoom meeting updated: ${meetingId}`);
    } catch (error: any) {
      logger.error('Zoom meeting update error:', error);
      throw new InternalServerError(`Failed to update Zoom meeting: ${error.message}`);
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      await axios.delete(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logger.info(`Zoom meeting deleted: ${meetingId}`);
    } catch (error: any) {
      logger.error('Zoom meeting deletion error:', error);
      throw new InternalServerError(`Failed to delete Zoom meeting: ${error.message}`);
    }
  }

  /**
   * Test Zoom connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      
      // Try to get user info
      await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return true;
    } catch (error) {
      logger.error('Zoom connection test failed:', error);
      return false;
    }
  }
}

export default new ZoomService();

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import logger from '../utils/logger';
import { InternalServerError } from '../utils/errors';
import { IEmailAccount } from '../models/EmailAccount';

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  date: Date;
  messageId: string;
}

class IMAPService {
  /**
   * Connect to IMAP server
   */
  private createConnection(emailConfig: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
  }): Imap {
    return new Imap({
      user: emailConfig.user,
      password: emailConfig.password,
      host: emailConfig.host,
      port: emailConfig.port,
      tls: emailConfig.tls,
      tlsOptions: { rejectUnauthorized: false },
    });
  }

  /**
   * Fetch unread emails from inbox
   */
  async fetchUnreadEmails(emailAccount: IEmailAccount, maxEmails: number = 50): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const messages: EmailMessage[] = [];

      const imap = this.createConnection({
        host: emailAccount.imapHost,
        port: emailAccount.imapPort,
        user: emailAccount.imapUser,
        password: emailAccount.getDecryptedPassword(),
        tls: emailAccount.imapTls,
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, _box) => {
          if (err) {
            imap.end();
            return reject(new InternalServerError(`Failed to open inbox: ${err.message}`));
          }

          // Search for unread emails
          imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              imap.end();
              return reject(new InternalServerError(`Failed to search emails: ${err.message}`));
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve([]);
            }

            // Limit results
            const uids = results.slice(0, maxEmails);

            const fetch = imap.fetch(uids, {
              bodies: '',
              markSeen: false, // Don't mark as read yet
            });

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream as any, async (err, parsed) => {
                  if (err) {
                    logger.error('Email parsing error:', err);
                    return;
                  }

                  try {
                    const message = this.parseEmail(parsed);
                    messages.push(message);
                  } catch (error) {
                    logger.error('Error processing email:', error);
                  }
                });
              });
            });

            fetch.once('error', (err) => {
              logger.error('Fetch error:', err);
              imap.end();
              reject(new InternalServerError(`Failed to fetch emails: ${err.message}`));
            });

            fetch.once('end', () => {
              imap.end();
              resolve(messages);
            });
          });
        });
      });

      imap.once('error', (err: Error) => {
        logger.error('IMAP connection error:', err);
        reject(new InternalServerError(`IMAP connection failed: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailAccount: IEmailAccount, messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection({
        host: emailAccount.imapHost,
        port: emailAccount.imapPort,
        user: emailAccount.imapUser,
        password: emailAccount.getDecryptedPassword(),
        tls: emailAccount.imapTls,
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
            if (err || !results || results.length === 0) {
              imap.end();
              return reject(err || new Error('Email not found'));
            }

            imap.addFlags(results, ['\\Seen'], (err) => {
              imap.end();
              if (err) return reject(err);
              resolve();
            });
          });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  }

  /**
   * Test IMAP connection
   */
  async testConnection(emailAccount: IEmailAccount): Promise<boolean> {
    return new Promise((resolve) => {
      const imap = this.createConnection({
        host: emailAccount.imapHost,
        port: emailAccount.imapPort,
        user: emailAccount.imapUser,
        password: emailAccount.getDecryptedPassword(),
        tls: emailAccount.imapTls,
      });

      imap.once('ready', () => {
        imap.end();
        resolve(true);
      });

      imap.once('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        try {
          imap.end();
        } catch (e) {
          // Ignore
        }
        resolve(false);
      }, 10000); // 10 second timeout

      imap.connect();
    });
  }

  /**
   * Parse email object
   */
  private parseEmail(parsed: ParsedMail): EmailMessage {
    const attachments = parsed.attachments?.map(att => ({
      filename: att.filename || 'unnamed',
      content: att.content,
      contentType: att.contentType,
      size: att.size,
    })) || [];

    // Handle from and to addresses
    const fromText = parsed.from && 'text' in parsed.from ? parsed.from.text : '';
    const toText = parsed.to && 'text' in parsed.to ? parsed.to.text : '';

    return {
      from: fromText || '',
      to: toText ? [toText] : [],
      subject: parsed.subject || '',
      body: parsed.text || '',
      bodyHtml: parsed.html || undefined,
      attachments,
      date: parsed.date || new Date(),
      messageId: parsed.messageId || '',
    };
  }
}

export default new IMAPService();

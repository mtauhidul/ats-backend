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
        logger.info('[IMAP] Connection ready, opening INBOX...');
        
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(new InternalServerError(`Failed to open inbox: ${err.message}`));
          }

          logger.info(`[IMAP] INBOX opened successfully. Total messages: ${box.messages.total}, New: ${box.messages.new}, Unseen: ${box.messages.unseen}`);

          // Search for unread emails
          imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              logger.error('[IMAP] Search error:', err);
              imap.end();
              return reject(new InternalServerError(`Failed to search emails: ${err.message}`));
            }

            logger.info(`[IMAP] Search completed. Found ${results?.length || 0} UNSEEN messages. UIDs: ${JSON.stringify(results)}`);

            if (!results || results.length === 0) {
              logger.warn('[IMAP] No unread emails found, closing connection');
              imap.end();
              return resolve([]);
            }

            // Limit results
            const uids = results.slice(0, maxEmails);
            logger.info(`[IMAP] Fetching ${uids.length} email(s)...`);

            const fetch = imap.fetch(uids, {
              bodies: '',
              markSeen: false, // Don't mark as read yet
            });

            const parsePromises: Promise<void>[] = [];

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                const parsePromise = new Promise<void>((resolveMsg) => {
                  simpleParser(stream as any, async (err, parsed) => {
                    if (err) {
                      logger.error('[IMAP] Email parsing error:', err);
                      resolveMsg();
                      return;
                    }

                    try {
                      const message = this.parseEmail(parsed);
                      messages.push(message);
                      logger.info(`[IMAP] ✓ Parsed email from: ${message.from}`);
                    } catch (error) {
                      logger.error('[IMAP] Error processing email:', error);
                    }
                    resolveMsg();
                  });
                });
                parsePromises.push(parsePromise);
              });
            });

            fetch.once('error', (err) => {
              logger.error('[IMAP] Fetch error:', err);
              imap.end();
              reject(new InternalServerError(`Failed to fetch emails: ${err.message}`));
            });

            fetch.once('end', async () => {
              logger.info('[IMAP] Fetch completed, waiting for parsing...');
              await Promise.all(parsePromises);
              logger.info(`[IMAP] ✓ All emails parsed. Total: ${messages.length}`);
              imap.end();
              resolve(messages);
            });
          });
        });
      });

      imap.once('error', (err: Error) => {
        logger.error('[IMAP] Connection error:', err);
        reject(new InternalServerError(`IMAP connection failed: ${err.message}`));
      });

      logger.info(`[IMAP] Connecting to ${emailAccount.imapHost}:${emailAccount.imapPort} as ${emailAccount.imapUser}...`);
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

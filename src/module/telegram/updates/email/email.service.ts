import { Injectable } from '@nestjs/common';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

@Injectable()
export class EmailService {
    private readonly receiptSubjectPatterns: RegExp[] = [/Электронный чек/, /Кассовый чек/];

    private readonly receiptLinkPatterns: RegExp[] = [
        /https:\/\/consumer\.1-ofd\.ru\/v1\?.*?t=\d+T\d+&s=\d+&fn=\d+&i=\d+&fp=\d+&n=1/g,
        /https:\/\/ofd\.ru\/b\/[a-fA-F0-9]{32}/g,
    ];

    public async findEmailCashReceipt(email: string, password: string): Promise<{ subject: string; links: string[] }[]> {
        const hostServer = email.includes('rambler.ru') ? 'imap.rambler.ru' : 'imap.mail.ru';

        return new Promise((resolve, reject) => {
            const imap = new Imap({
                user: email,
                password,
                host: hostServer,
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
            });

            const results: { subject: string; links: string[] }[] = [];

            imap.once('ready', async () => {
                try {
                    const mailboxes = await this.listMailboxes(imap);
                    for (const mailbox of mailboxes) {
                        await this.openMailbox(imap, mailbox);
                        const messageIds = await this.searchMessages(imap);
                        for (const id of messageIds) {
                            await this.processMessage(imap, id, results);
                        }
                    }

                    resolve(results.filter(result => result.links.length > 0));
                } catch (error) {
                    console.error('Error during IMAP operations:', error);
                    reject(error);
                } finally {
                    imap.end();
                }
            });

            imap.once('error', (error: any) => {
                console.error('IMAP Error:', error);
                reject(error);
            });

            imap.once('end', () => {
                console.log('IMAP connection closed');
            });

            imap.connect();
        });
    }

    private async processMessage(imap: Imap, messageId: number, results: { subject: string; links: string[] }[]): Promise<void> {
        const fetch = imap.fetch(messageId, { bodies: '' });

        return new Promise((resolve, reject) => {
            fetch.on('message', msg => {
                let rawMessage = '';

                msg.on('body', stream => {
                    stream.on('data', chunk => {
                        rawMessage += chunk.toString('utf8');
                    });
                });

                msg.once('end', async () => {
                    try {
                        const parsed = await simpleParser(rawMessage);
                        if (parsed.subject && this.isReceiptSubject(parsed.subject)) {
                            const content = [parsed.subject, parsed.text || '', parsed.html || ''].join('\n');
                            const links = this.extractLinks(content);

                            if (parsed.html) {
                                links.push(...this.extractLinksFromHtml(parsed.html));
                            }

                            const filteredLinks = this.filterValidLinks(links);

                            if (filteredLinks.length > 0) {
                                results.push({
                                    subject: parsed.subject,
                                    links: [...new Set(filteredLinks)], // Remove duplicates
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    } finally {
                        resolve();
                    }
                });
            });

            fetch.once('error', error => {
                console.error('Fetch error:', error);
                reject(error);
            });

            fetch.once('end', () => {
                resolve();
            });
        });
    }

    private isReceiptSubject(subject: string): boolean {
        return this.receiptSubjectPatterns.some(pattern => pattern.test(subject));
    }

    private extractLinks(content: string): string[] {
        const links: string[] = [];
        for (const pattern of this.receiptLinkPatterns) {
            links.push(...(content.match(pattern) || []));
        }
        return links;
    }

    private extractLinksFromHtml(html: string): string[] {
        const hrefPattern = /href=["'](https?:\/\/[^"'>]+)["']/g;
        const links: string[] = [];
        let match;
        while ((match = hrefPattern.exec(html)) !== null) {
            links.push(match[1]);
        }
        return links;
    }

    private filterValidLinks(links: string[]): string[] {
        return links.map(link => this.normalizeLink(link)).filter(link => this.receiptLinkPatterns.some(pattern => pattern.test(link)));
    }

    private normalizeLink(link: string): string {
        return link.replace(/&amp;/g, '&');
    }

    private listMailboxes(imap: Imap): Promise<string[]> {
        return new Promise((resolve, reject) => {
            imap.getBoxes((err, boxes) => {
                if (err) return reject(err);
                resolve(Object.keys(boxes));
            });
        });
    }

    private openMailbox(imap: Imap, mailbox: string): Promise<void> {
        return new Promise((resolve, reject) => {
            imap.openBox(mailbox, false, err => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    private searchMessages(imap: Imap): Promise<number[]> {
        return new Promise((resolve, reject) => {
            imap.search(['ALL'], (err, results) => {
                if (err) return reject(err);
                resolve(results || []);
            });
        });
    }
}

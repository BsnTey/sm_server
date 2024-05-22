import { Injectable } from '@nestjs/common';
import Imap from 'imap';
import { ParsedMail, simpleParser } from 'mailparser';
import { Readable } from 'stream';
import { mimeWordDecode } from 'emailjs-mime-codec';
import iconv from 'iconv-lite';

@Injectable()
export class EmailService {
    private async searchRegex(bodys: Array<string | undefined>): Promise<Array<string>> {
        const regex = /https:\/\/consumer\.1-ofd\.ru\/v1\?.*?t=\d+T\d+&s=\d+&fn=\d+&i=\d+&fp=\d+&n=1/g;
        const cashReceipts: string[] = [];

        for (const body of bodys) {
            try {
                if (body) {
                    const receipts = body.match(regex);
                    if (receipts) {
                        cashReceipts.push(...receipts);
                    }
                }
            } catch (error) {
                console.error('Error parsing body:', error);
            }
        }
        return cashReceipts;
    }

    public async findEmailCashReceipt(email: string, passImap: string): Promise<Array<string>> {
        const serverImap = email.split('@')[1];
        const hostServer = 'imap.' + (serverImap == 'rambler.ru' ? 'rambler.ru' : 'mail.ru');
        return new Promise((resolve, reject) => {
            const imap = new Imap({
                user: email,
                password: passImap,
                host: hostServer,
                port: 993,
                tls: true,
            });

            const bodys: Array<string | undefined> = [];

            imap.once('ready', async () => {
                try {
                    await this.processMail(imap, bodys);
                    const cashReceipts = await this.searchRegex(bodys);
                    resolve(cashReceipts);
                } catch (error) {
                    console.error('Error processing mail:', error);
                    reject(error);
                } finally {
                    imap.end();
                }
            });

            imap.once('error', (error: any) => {
                console.error('IMAP error:', error);
                reject(error);
            });

            imap.once('end', () => {
                console.log('IMAP connection closed');
            });

            imap.connect();
        });
    }

    private async processMail(imap: Imap, bodys: Array<string | undefined>): Promise<void> {
        try {
            const boxes = await this.getBoxes(imap);
            for (const box of boxes) {
                await this.openBox(imap, box);
                const messageNums = await this.searchMessages(imap);
                for (const num of messageNums) {
                    await this.fetchMessage(imap, num, bodys);
                }
            }
        } catch (error) {
            console.error('Error processing mailboxes:', error);
            throw error;
        }
    }

    private getBoxes(imap: Imap): Promise<string[]> {
        return new Promise((resolve, reject) => {
            imap.getBoxes((err, boxes) => {
                if (err) {
                    return reject(err);
                }
                resolve(Object.keys(boxes));
            });
        });
    }

    private openBox(imap: Imap, box: string): Promise<void> {
        return new Promise((resolve, reject) => {
            imap.openBox(box, false, err => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    private searchMessages(imap: Imap): Promise<number[]> {
        return new Promise((resolve, reject) => {
            imap.search(['ALL'], (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            });
        });
    }

    private fetchMessage(imap: Imap, num: number, bodys: Array<string | undefined>): Promise<void> {
        return new Promise((resolve, reject) => {
            const fetch = imap.fetch(num, { bodies: 'HEADER.FIELDS (SUBJECT)', struct: true });

            fetch.on('message', msg => {
                msg.on('body', async stream => {
                    let subject = '';
                    stream.on('data', chunk => {
                        subject += chunk.toString('utf8');
                    });

                    stream.on('end', async () => {
                        const decodedSubject = this.decodeMimeWords(subject.trim());
                        const cleanedSubject = decodedSubject.replace(/\s+/g, ' ');
                        if (this.isTargetSubject(cleanedSubject)) {
                            await this.fetchFullMessage(imap, num, bodys);
                        }
                        resolve();
                    });
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

    private decodeMimeWords(encodedText: string): string {
        return encodedText.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, encodedText) => {
            if (encoding.toUpperCase() === 'B') {
                return iconv.decode(Buffer.from(encodedText, 'base64'), charset);
            } else if (encoding.toUpperCase() === 'Q') {
                return iconv.decode(Buffer.from(mimeWordDecode(encodedText), 'binary'), charset);
            }
            return match;
        });
    }

    private isTargetSubject(subject: string): boolean {
        const targetPattern = /СПОРТМАСТЕР/;
        return targetPattern.test(subject);
    }

    private fetchFullMessage(imap: Imap, num: number, bodys: Array<string | undefined>): Promise<void> {
        return new Promise((resolve, reject) => {
            const fetch = imap.fetch(num, { bodies: 'TEXT' });

            fetch.on('message', msg => {
                msg.on('body', async stream => {
                    try {
                        const parsed: ParsedMail = await simpleParser(stream as unknown as Readable);
                        bodys.push(parsed.text);
                    } catch (error) {
                        console.error('Error parsing message:', error);
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
}

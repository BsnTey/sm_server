import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DeviceInfoEntity } from '@core/device/entities/device-info.entity';

@Injectable()
export class DeviceGeneratorService implements OnModuleInit {
    private readonly logger = new Logger(DeviceGeneratorService.name);

    private devices: string[][] = []; // [ver, build, brand, model, res]
    private ipRanges: { start: number; end: number }[] = [];
    private chromeVersions: string[] = [];

    private readonly DATA_PATH = path.join(process.cwd(), './files');

    async onModuleInit() {
        this.loadDevices();
        this.loadIps();
        this.loadChromeVersions();
    }

    /**
     * Создает случайный DeviceInfoEntity
     */
    public generate(): DeviceInfoEntity {
        const deviceRaw = this.getRandomElement(this.devices);
        const ip = this.generateRandomIp();
        const chrome = this.getRandomElement(this.chromeVersions);

        // Парсинг строки: 14;UP1A.231005.007_NN;Vivo;V2424;2800x1260
        const [osVersion, buildVersion, brand, model, screenResolution] = deviceRaw;

        return new DeviceInfoEntity({
            osVersion,
            buildVersion,
            brand,
            model,
            screenResolution,
            browserVersion: chrome,
            IP: ip,
        });
    }

    // --- Private Loaders ---

    private loadDevices() {
        const content = this.readFile('device_info.txt');
        this.devices = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.split(';'));
        this.logger.log(`Loaded ${this.devices.length} devices`);
    }

    private loadChromeVersions() {
        const content = this.readFile('version_chrome.txt');
        this.chromeVersions = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    private loadIps() {
        const content = this.readFile('ip.txt');
        const lines = content.split('\n').filter(l => l.trim().length > 0);

        this.ipRanges = lines.map(line => {
            // Пример: 85.234.21.0 - 85.234.21.255
            const [startIp, endIp] = line.split('-').map(s => s.trim());
            return {
                start: this.ipToLong(startIp),
                end: this.ipToLong(endIp),
            };
        });
    }

    // --- Helpers ---

    private readFile(filename: string): string {
        try {
            return fs.readFileSync(path.join(this.DATA_PATH, filename), 'utf-8');
        } catch (e: any) {
            this.logger.error(`Failed to load ${filename}: ${e.message}`);
            return '';
        }
    }

    private getRandomElement<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    private generateRandomIp(): string {
        if (this.ipRanges.length === 0) return '94.45.172.45';
        const range = this.getRandomElement(this.ipRanges);
        // Рандомное число в диапазоне
        const randomLong = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
        return this.longToIp(randomLong);
    }

    // Преобразование IP в число для математики
    private ipToLong(ip: string): number {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    // Обратно число в IP строку
    private longToIp(long: number): string {
        return [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');
    }
}

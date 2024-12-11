import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotTHeadersService {
    private userAgentWeb: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    private host: string = this.configService.getOrThrow('HOST_BOTT');
    private cookie: string =
        '_identity=43de6ff6f603486a1d96939938761bc7002cccdfb0d932abad726ef0a43ef1d9a%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A51%3A%22%5B722008%2C%22qVxIcyWHT2XUY5Ea-DeBfpyeJL3tTJmU%22%2C2592000%5D%22%3B%7D; _csrf-frontend=0e8f0ae498913ab4c6d4f3048d6813d4fbe291322e2fc418eb02a7ed036a3974a%3A2%3A%7Bi%3A0%3Bs%3A14%3A%22_csrf-frontend%22%3Bi%3A1%3Bs%3A32%3A%22rMtflHWpjZWExnwYJT7uR8TqPIwQs7j0%22%3B%7D';

    headers = {
        'User-Agent': this.userAgentWeb,
        Host: this.host,
        Cookie: this.cookie,
    };

    constructor(private configService: ConfigService) {}
}

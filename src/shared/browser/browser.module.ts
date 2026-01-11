import { Module } from '@nestjs/common';
import { HttpBrowserGateway } from './browser.service';
import { HttpModule } from '../../module/http/http.module';

@Module({
    imports: [HttpModule],
    providers: [HttpBrowserGateway],
    exports: [HttpBrowserGateway],
})
export class BrowserModule {}

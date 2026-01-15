import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { UpdatingPreferenceStatusRequestDto } from './dto/update-preference-status.dto';
import { StartOrderTrackingRequestDto, StartOrderTrackingResponseDto } from './dto/start-order-tracking.dto';
import { NotificationPrefsService } from './notificationPrefs.service';

@Controller('notification')
export class NotificationPrefsController {
    constructor(private readonly notificationPrefsService: NotificationPrefsService) {}

    @Get(':tgId/preferences')
    @HttpCode(200)
    async getPreferences(@Param('tgId') tgId: string) {
        return this.notificationPrefsService.getPreferences(tgId);
    }

    @Put(':tgId/preferences')
    @HttpCode(200)
    async updatePreferenceStatusOrder(@Body() dto: UpdatingPreferenceStatusRequestDto, @Param('tgId') tgId: string) {
        return this.notificationPrefsService.setPreferences(tgId, dto);
    }

    @Post('order/track')
    @HttpCode(202)
    async enqueueOrderTracking(@Body() dto: StartOrderTrackingRequestDto): Promise<StartOrderTrackingResponseDto> {
        return this.notificationPrefsService.startTracking(dto);
    }
}

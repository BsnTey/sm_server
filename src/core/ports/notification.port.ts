export abstract class INotificationPort {
    abstract notifyUser(userId: string | number, message: string): Promise<void>;
    abstract notifyAdmin(message: string): Promise<void>;
}
import * as argon2 from 'argon2';

export class AuthenticationProvider {
    static async generateHash(password: string): Promise<string> {
        return await argon2.hash(password);
    }

    static async validateHash(password: string, passwordHash: string): Promise<boolean> {
        return await argon2.verify(passwordHash, password);
    }
}

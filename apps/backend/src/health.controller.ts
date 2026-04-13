import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      },
    };
  }
}

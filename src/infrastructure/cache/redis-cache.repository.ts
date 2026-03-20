import { Redis } from '@upstash/redis';
import { ICacheRepository } from './cache.repository';

export class RedisCacheRepository implements ICacheRepository {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }

  async hgetall(key: string): Promise<Record<string, any> | null> {
    const result = await this.client.hgetall(key).catch(() => null);
    if (!result || Object.keys(result).length === 0) return null;
    return result;
  }

  async hset(key: string, data: Record<string, any>): Promise<void> {
    await this.client.hset(key, data);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
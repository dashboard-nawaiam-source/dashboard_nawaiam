export interface ICacheRepository {
  hgetall(key: string): Promise<Record<string, any> | null>;
  hset(key: string, data: Record<string, any>): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
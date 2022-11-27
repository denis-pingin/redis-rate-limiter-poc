import { createClient, defineScript } from "redis";

export default class RedisRateLimiter {
  #redis: ReturnType<typeof createClient>;
  readonly #windowSize: number;
  readonly #maxRequests: number;

  public constructor(config: {
    redis: {
      host: string,
      port: number,
      password: string
    }
    windowSize: number,
    maxRequests: number
  }) {
    this.#windowSize = config.windowSize ?? 30;
    this.#maxRequests = config.maxRequests ?? 100;

    // @ts-ignore
    this.#redis = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      scripts: {
        rateLimiter: defineScript({
          NUMBER_OF_KEYS: 1,
          SCRIPT: `
            local key = KEYS[1]
            local window_size = ARGV[1]
            local max_requests = ARGV[2]
            local current_time = redis.call('TIME')
            local trim_time = tonumber(current_time[1]) - window_size
            redis.call('ZREMRANGEBYSCORE', key, 0, trim_time)
            local request_count = redis.call('ZCARD', key)

            if request_count < tonumber(max_requests) then
                redis.call('ZADD', key, current_time[1], current_time[1] .. current_time[2])
                redis.call('EXPIRE', key, window_size)
                return tonumber(max_requests) - request_count - 1
            end
            return -1`,
          transformArguments(key: string, windowSize: number, maxRequests: number): Array<string> {
            return [key, windowSize.toString(), maxRequests.toString()];
          },
          transformReply(reply: number): number {
            return reply;
          }
        })
      }
    });

    this.#redis.connect();

    this.#redis.on("error", (error) => {
      console.error(`Redis error: ${error.message ?? error}`);
    });

    this.#redis.on("connect", () => {
      console.log(`Redis connected`);
    });
  }

  // Returns either the amount of calls left in the current window or -1 if the rate limit has been exceeded
  public async attemptCall(key: string): Promise<number> {
    // @ts-ignore
    return await this.#redis.rateLimiter(key, this.#windowSize, this.#maxRequests);
  }
}

import { createClient, defineScript } from "redis";

export default class RedisCircuitBreaker {
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
        registerCall: defineScript({
          NUMBER_OF_KEYS: 1,
          SCRIPT: `
            local key = KEYS[1]
            local window_size = ARGV[1]
            local outcome = ARGV[2]
            local current_time = redis.call('TIME')
            local trim_time = tonumber(current_time[1]) - window_size
            redis.call('ZREMRANGEBYSCORE', key, 0, trim_time)
            
            local requests = redis.call('ZRANGE', key, 0, current_time[1])
            local totalCount = 0
            local successCount = 0
            for k, v in pairs(requests) do
              local json = cjson.decode(v)
              totalCount = totalCount + 1
              if (json['o'] == "S") then
                successCount = successCount + 1
              end
            end
            redis.log(redis.LOG_NOTICE, "totalCount", totalCount)
            redis.log(redis.LOG_NOTICE, "successCount", successCount)

            local value = cjson.encode({ ['t'] = current_time[1] .. current_time[2], ['o'] = outcome })
            redis.log(redis.LOG_NOTICE, "value", value)
            redis.call('ZADD', key, current_time[1], value)
            redis.call('EXPIRE', key, window_size)
            
            return cjson.encode({ ['totalCount'] = totalCount, ['successCount'] = successCount })`,
          transformArguments(key: string, windowSize: number, outcome: string): Array<string> {
            return [key, windowSize.toString(), outcome];
          },
          transformReply(reply: any): number {
            console.log(reply);
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
  public async attemptCall(key: string, outcome: string): Promise<number> {
    // @ts-ignore
    return await this.#redis.registerCall(key, this.#windowSize, outcome);
  }
}

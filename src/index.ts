import RedisRateLimiter from "./redisRateLimiter.js";
import dotenv from "dotenv";
import RedisCircuitBreaker from "./redisCircuitBreaker.js";
dotenv.config();

// Test constants
const WINDOW_SIZE = 2; // in seconds
const MAX_REQUESTS = 50; // per window
const TEST_DURATION = 120; // in seconds
const NUM_THREADS = 8;

const main = async () => {
  const startTime = new Date()
  console.log("Starting at:", startTime);

  await startThreadCircuitBreaker(0, startTime);

  // const promises = [];
  // for (let i = 0; i < NUM_THREADS; i++) {
  //   promises.push(startThread(i, startTime));
  // }

  // const results = await Promise.all(promises);

  // const endTime = new Date();
  // console.log("Finished at:", endTime);
  //
  // console.log("Thread results:", results);
  //
  // const result: any = results.reduce((prev: any, cur: any) => {
  //   return {
  //     successCount: prev.successCount + cur.successCount,
  //     errorCount: prev.errorCount + cur.errorCount,
  //     totalCount: prev.totalCount + cur.successCount + cur.errorCount
  //   };
  // }, {
  //   successCount: 0,
  //   errorCount: 0,
  //   totalCount: 0
  // });
  //
  // console.log("Totals:", result);
  //
  // const duration = (endTime.getTime() - startTime.getTime()) / 1000;
  // console.log("Test duration:", duration);
  //
  // console.log("Success rate:", result.successCount / result.totalCount);
  //
  // console.log("Requests/s:", result.totalCount / duration)
  // console.log("Requests/window:", result.totalCount * WINDOW_SIZE / duration)
  //
  // console.log("Successes/s:", result.successCount / duration)
  // console.log("Successes/window:", result.successCount * WINDOW_SIZE / duration)

  process.exit(0);
}

const startThread = async (id: number, startTime: Date) => {
  return new Promise(resolve => {
    const rateLimiter = new RedisRateLimiter({
      redis: {
        host: process.env.REDIS_HOST as string,
        port: parseInt(process.env.REDIS_PORT as string),
        password: process.env.REDIS_PASSWORD as string
      },
      windowSize: WINDOW_SIZE,
      maxRequests: MAX_REQUESTS
    });

    let successCount = 0;
    let errorCount = 0;
    let now = new Date();
    const call = () => {
      rateLimiter.attemptCall("app-id:rate-limiter:TEST_API_KEY").then(result => {
        console.debug(`${id} - ${now.toISOString()}: ${result}`);

        result >= 0 ? successCount++ : errorCount++;

        now = new Date();
        if (now.getTime() - startTime.getTime() < TEST_DURATION * 1000) {
          setTimeout(call, 150 + Math.random() * 150);
        } else {
          resolve({
            successCount,
            errorCount
          });
        }
      });
    }
    call();
  });
}

const startThreadCircuitBreaker = async (id: number, startTime: Date) => {
  return new Promise(resolve => {
    const circuitBreaker = new RedisCircuitBreaker({
      redis: {
        host: process.env.REDIS_HOST as string,
        port: parseInt(process.env.REDIS_PORT as string),
        password: process.env.REDIS_PASSWORD as string
      },
      windowSize: WINDOW_SIZE,
      maxRequests: MAX_REQUESTS
    });

    let successCount = 0;
    let errorCount = 0;
    let now = new Date();
    const call = () => {
      circuitBreaker.attemptCall("app-id:circuit-breaker", "S").then(result => {
        console.debug(`${id} - ${now.toISOString()}: ${result}`);

        result >= 0 ? successCount++ : errorCount++;

        now = new Date();
        if (now.getTime() - startTime.getTime() < TEST_DURATION * 1000) {
          setTimeout(call, 150 + Math.random() * 150);
        } else {
          resolve({
            successCount,
            errorCount
          });
        }
      });
    }
    call();
  });
}

main();
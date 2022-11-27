# Redis-based sliding window rate limiter

This is a sample implementation of the Redis-based sliding window rate limiter.

It uses Redis [sorted sets](https://redis.io/docs/data-types/sorted-sets/) under the hood. 
Set scores are second-resolution timestamps and values - microsecond-resolution timestamps.
It uses a custom LUA script `rateLimiter` to perform computation transactionally.

As a key you can use any arbitrary string (usually some sort of API key is used).

If using the same key, multiple threads/processes can synchronize their rate limiter states using this implementation.

## Usage
### Set environment variables

    cp .env.example .env

Adjust variables in `.env` if needed.

### Start redis in Docker

    docker-compose up -d

### Define test parameters

Adjust test constants in `./src/index.ts`.

### Start the test

    yarn install
    yarn start

Wait for the test to complete and evaluate results.
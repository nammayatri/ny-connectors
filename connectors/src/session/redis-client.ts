import Redis, { Cluster } from 'ioredis';
import { config } from '../config';

// All Redis keys are namespaced under this prefix to avoid collisions
// when sharing a Redis instance with other services.
export const REDIS_KEY_PREFIX = 'ny-connector-backend:';

export type RedisClient = Redis | Cluster;

// Creates a Redis client based on the resolved mode in config:
//   - 'cluster'    → ioredis Cluster client (uses REDIS_CLUSTER_NODES)
//   - 'standalone' → ioredis client (uses REDIS_URL)
//
// The mode is set via REDIS_MODE env var ('cluster' | 'standalone'), or
// inferred automatically: if REDIS_CLUSTER_NODES is provided, cluster mode
// is selected; otherwise standalone. This lets the same binary connect to
// either deployment style without code changes.
export function createRedisClient(): RedisClient {
  if (config.redisMode === 'cluster') {
    if (config.redisClusterNodes.length === 0) {
      throw new Error(
        '[redis] REDIS_MODE=cluster but no nodes provided. Set REDIS_CLUSTER_NODES=host1:6379,host2:6379,...',
      );
    }
    console.log(
      `[redis] Connecting to cluster (${config.redisClusterNodes.length} nodes)`,
    );
    return new Redis.Cluster(config.redisClusterNodes, {
      redisOptions: {
        keyPrefix: REDIS_KEY_PREFIX,
      },
    });
  }

  console.log(`[redis] Connecting to standalone instance (${config.redisUrl})`);
  return new Redis(config.redisUrl, {
    keyPrefix: REDIS_KEY_PREFIX,
  });
}

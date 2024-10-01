import { Redis } from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6380,
});

const revokeToken = async () => {
  // token passed as arg
  const workerId = process.argv[2];
  if (!workerId) {
    console.error("Error: worker ID not provided");
    console.log("Usage: bun run revoke-token.ts <worker-id>");
    process.exit(1);
  }

  await redis.set(`revoked:${workerId}`, "true");
};

revokeToken()
  .catch((e) => {
    console.log("Error revoking token", e);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });

import { connect, StringCodec } from "nats";

import * as Jwt from "nats-jwt";

const revokeToken = async () => {
  const nc = await connect({
    servers: "nats://localhost:4223",
    reconnect: true,
    user: "auth_service_user",
    pass: "auth_service_user",
  });

  // token passed as arg
  const userNkey = process.argv[2];
  if (!userNkey) {
    console.error("Error: user Nkey not provided");
    console.log("Usage: bun run revoke-token.ts <user-nkey>");
    process.exit(1);
  }

  const payload = {
    nkey: userNkey.trim(),
  };

  const sc = StringCodec();
  console.log("Revoking token for user", userNkey);
  nc.publish("$SYS.REQ.CLAIMS.DELETE", sc.encode(JSON.stringify(payload)));
  //   console.log("Received response:", response);
  console.log("Published $SYS.REQ.CLAIMS.DELETE");

  await nc.drain();
  console.log("Drained");
};

revokeToken()
  .catch((e) => {
    console.log("Error revoking token", e);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });

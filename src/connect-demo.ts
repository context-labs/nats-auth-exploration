import { connect } from "nats";
import { getUserToken } from "./get-user-token";

const run = async () => {
  const natsUrl = "nats://localhost:4223";

  console.log("Getting token for user1");
  const token = await getUserToken("abe");
  console.log(`Token: ${token}`);

  console.log("Connecting to NATS");
  const nc = await connect({
    servers: natsUrl,
    token: token,
  });

  console.log("Connected to NATS");
};

run();

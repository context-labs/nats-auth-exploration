import { connect } from "nats";
import { getUserToken } from "./get-user-token";
import * as Jwt from "nats-jwt";

const run = async () => {
  const natsUrl = "nats://localhost:4223";

  console.log("Getting token for user1");
  const token = await getUserToken("abe");
  const decodedToken = Jwt.decode(token);
  console.log(`Token: ${token}`);
  console.log(JSON.stringify(decodedToken, null, 2));

  console.log("Connecting to NATS");
  const nc = await connect({
    servers: natsUrl,
    token: token,
  });

  console.log("Connected to NATS");

  while (true) {
    let subject = "";

    // get subject name from stdin
    process.stdout.write("Enter subject name: ");
    for await (const line of console) {
      subject = line.trim();
      break;
    }

    try {
      const sub = nc.subscribe(subject);
      nc.publish(subject, "Hello World");

      for await (const msg of sub) {
        console.log(
          "Received message:",
          msg.data.toString(),
          "on subject",
          msg.subject
        );
        break;
      }
    } catch (e) {
      console.log("Error subscribing to subject", e);
    }
  }
};

run();

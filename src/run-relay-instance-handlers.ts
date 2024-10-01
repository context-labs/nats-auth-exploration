import { connect } from "nats";

// these would be secure credentials used by our internal relay service
const kuzcoRelayUser = "kuzco_relay_user";
const kuzcoRelayPassword = "kuzco_relay_user";

const setupFakeRelayInstanceSubscriber = async () => {
  const nc = await connect({
    servers: "nats://localhost:4223",
    reconnect: true,
    user: kuzcoRelayUser,
    pass: kuzcoRelayPassword,
  });
  console.log("✅ Fake relay connected to NATS");

  const subscription = nc.subscribe("instance.>", {
    queue: "relay",
  });
  console.log("Subscribed to instance.>");

  for await (const msg of subscription) {
    console.log(
      `Received message at subject ${msg.subject}, responding with pong`
    );
    msg.respond(JSON.stringify({ message: "pong" }));
  }

  console.log("✅ Fake relay instance subscriber setup complete!");
};

setupFakeRelayInstanceSubscriber().catch((e) => {
  console.log("Error setting up fake relay instance subscriber", e);
  process.exit(1);
});

import { connect } from "nats";
import * as Jwt from "nats-jwt";
import { getUserToken } from "./get-user-token";
import { ensureNatsStream } from "./lib/nats/ensureNatsStream";
import { ensureNatsConsumer } from "./lib/nats/ensureNatsConsumer";

const fakeJetstreamName = "inference-fast";

const fakeInstanceId = "test-instance-id";

const setupJetstream = async () => {
  const natsUrl = "nats://localhost:4223";
  const natsUser = "kuzco_relay_user";
  const natsPass = "kuzco_relay_user";

  const nc = await connect({
    servers: natsUrl,
    user: natsUser,
    pass: natsPass,
  });

  const js = nc.jetstream();
  const manager = await js.jetstreamManager();

  console.log("Ensuring NATS stream exists");
  await ensureNatsStream({
    streamName: fakeJetstreamName,
    natsJetstreamManager: manager,
    streamConfig: {
      subjects: [`${fakeJetstreamName}.>`],
      name: fakeJetstreamName,
    },
  });

  console.log("Ensuring NATS consumer exists");
  await ensureNatsConsumer({
    streamName: fakeJetstreamName,
    consumerName: "test-worker-id",
    consumerOptions: {
      ack_wait: 30000000000,
      filter_subject: `${fakeJetstreamName}.>`,
      durable_name: "test-worker-id",
    },
    natsJetstreamManager: manager,
  });

  console.log("✅ Ensured NATS consumer exists");
};

const run = async () => {
  const natsUrl = "nats://localhost:4223";

  await setupJetstream();

  console.log("Getting token for user1");
  const token = await getUserToken({
    userId: "abe",
    workerId: "test-worker-id",
    instanceId: fakeInstanceId,
    teamId: "test-team-id",
  });
  const decodedToken = Jwt.decode(token);
  console.log(`Token: ${token}`);
  console.log(JSON.stringify(decodedToken, null, 2));

  console.log("Connecting to NATS");
  const nc = await connect({
    servers: natsUrl,
    token: token,
    reconnect: true,
  });

  console.log("✅ Connected to NATS");

  const subject = `inference-benchmarking.benchmark.${fakeInstanceId}.>`;
  console.log("Attempting to subscribe to the benchmarking subject");

  try {
    const sub = nc.subscribe(subject);
    console.log("Subscription ID", sub.getID());
    console.log(
      "✅ Was able to get the subscription ID, which means we can subscribe"
    );
  } catch (e) {
    console.log("❌ Error subscribing to subject", e);
    process.exit(1);
  }

  console.log("Connecting to JetStream");
  const js = nc.jetstream();
  const consumer = await js.consumers.get(fakeJetstreamName, "test-worker-id");
  console.log("✅ got consumer");

  new Promise(async (resolve, reject) => {
    console.log("Starting consumer loop");
    while (true) {
      console.log("\n\n\nWaiting for messages...");

      const messages = await consumer.fetch({
        max_messages: 1,
        expires: 5000,
      });
      for await (const message of messages) {
        console.log("Received message:", message.data.toString());
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  console.log("\n\n");
  console.log("Now we will try to publish messages");
  console.log(
    "The token issued has permission to publish to the 'public.>' subject as well as the 'instance.>' subject"
  );

  while (true) {
    let subject = "";

    // get subject name from stdin
    process.stdout.write("Enter subject name: ");
    for await (const line of console) {
      subject = line.trim();
      break;
    }

    if (subject.startsWith("instance")) {
      console.log("You are publishing to the relay instance subject");
      try {
        const response = await nc.request(subject, "Hello World", {
          timeout: 60 * 1000,
        });

        const data = response.json();
        console.log(" ✅ Received response:", data);
      } catch (e) {
        console.log(" ❌ Error publishing to subject", e);
      }
      continue;
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

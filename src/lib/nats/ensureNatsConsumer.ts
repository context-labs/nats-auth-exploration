import type { ConsumerConfig, JetStreamManager } from "nats";

/**
 * Given a NATS stream and consumer name, ensures that the consumer exists.
 * If it does, it updates the consumer with the given options.
 * If it doesn't, it creates the consumer with the given options.
 *
 * @param streamName - The name of the NATS stream
 * @param consumerName - The name of the NATS consumer
 * @param consumerOptions - The options to use when creating the consumer
 * @param natsJetstreamManager - The NATS JetStream manager
 * @param logger - The logger to use
 */
export const ensureNatsConsumer = async ({
  streamName,
  consumerName,
  consumerOptions,
  natsJetstreamManager,
}: {
  streamName: string;
  consumerName: string;
  consumerOptions: Partial<ConsumerConfig>;
  natsJetstreamManager: JetStreamManager;
}) => {
  const consumerExists = await new Promise((resolve, reject) => {
    natsJetstreamManager.consumers
      .info(streamName, consumerName)
      .then((_) => resolve(true))
      .catch((e) => {
        const consumerNotFoundError = e.message.includes("consumer not found");
        if (consumerNotFoundError) {
          resolve(false);
        } else {
          console.error(`Failed to get consumer info for ${streamName}`, e);
          reject(e);
        }
      });
  });

  if (consumerExists) {
    console.log(`NATS consumer ${consumerName} already exists, updating.`);
    await natsJetstreamManager.consumers.update(
      streamName,
      consumerName,
      consumerOptions
    );
  } else {
    console.log(`Ensuring NATS consumer exists: ${consumerName}`);
    await natsJetstreamManager.consumers.add(streamName, consumerOptions);
  }
};

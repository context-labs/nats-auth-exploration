import type { JetStreamManager, StreamConfig } from "nats";

export const ensureNatsStream = async ({
  streamName,
  streamConfig,
  natsJetstreamManager,
}: {
  streamName: string;
  streamConfig: Partial<StreamConfig>;
  natsJetstreamManager: JetStreamManager;
}) => {
  const existingStream = await new Promise((resolve, reject) => {
    natsJetstreamManager.streams
      .info(streamName)
      .then((stream) => resolve(stream))
      .catch((e) => {
        const streamNotFoundError = e.message.includes("stream not found");

        if (streamNotFoundError) {
          resolve(undefined);
        } else {
          console.error(`Failed to get stream info for ${streamName}`, e);
          reject(e);
        }
      });
  });

  if (existingStream !== undefined) {
    console.log(`NATS stream ${streamName} already exists, updating.`);
    await natsJetstreamManager.streams.update(streamName, streamConfig);
    console.log(`NATS stream ${streamName} updated.`);
    return;
  }

  console.log(`Ensuring NATS stream exists: ${streamName}`);
  await natsJetstreamManager.streams.add(streamConfig);
  console.log(`NATS stream ${streamName} ensured.`);

  return natsJetstreamManager.streams.get(streamName);
};

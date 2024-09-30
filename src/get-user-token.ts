import * as Jwt from "nats-jwt";
import * as Nkeys from "nkeys.js";

// This needs to be PRIVATE
export const issuerSeed =
  "SAACGJQQQOYJVPXT522AZIXQKS5HRHKX6QJ6H3I5D3DAQ4YXFJ2LAUEXV4";

const enc = new TextEncoder();

export interface KuzcoWorkerJwtClaims
  extends Jwt.ClaimsData<{
    user_nkey: string;
    client_info: {
      worker_id: string;
      name: string;
    };
    server_id: {
      id: string;
    };
  }> {}

/**
 * This function is intended to generate a JWT for a given user,
 * and is not a real implementation.
 *
 * We will simply issue a JWT with the user's name and a random UUID
 * and sign it using the nkey of the auth service user.
 *
 * @param user
 */
export const getUserToken = async (user: string) => {
  const nkey = "auth_service_user";

  console.log("nkey", nkey);
  const uniqueUserNkey = Nkeys.createPair(Nkeys.Prefix.User);
  console.log("uniqueUserNkey", uniqueUserNkey);

  const claims: KuzcoWorkerJwtClaims = {
    sub: user,
    nats: {
      user_nkey: uniqueUserNkey.getPublicKey(),
      server_id: {
        id: "1234567890",
      },
      client_info: {
        name: user,
        worker_id: "test-worker-id",
      },
    },
    aud: "nats://localhost:4223",
    jti: "1234567890",
    iat: new Date().getTime(),
    iss: "auth_service",
    name: "auth_service",
  };

  const issuerKeyPair = Nkeys.fromSeed(enc.encode(issuerSeed));

  const token = Jwt.encode(Jwt.Algorithms.v2, claims, issuerKeyPair);
  console.log("Token generated:", token);

  return token;
};

import * as Jwt from "nats-jwt";
import * as Nkeys from "nkeys.js";

// This needs to be PRIVATE
const issuerSeed = "SAANDLKMXL6CUS3CP52WIXBEDN6YJ545GDKC65U5JZPPV6WH6ESWUA6YAI";

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

  const claims: Jwt.ClaimsData<unknown> = {
    sub: user,
    nats: {
      user_nkey: user,
    },
    aud: "nats://localhost:4223",
    jti: "1234567890",
    iat: new Date().getTime(),
    iss: "auth_service",
    name: "auth_service",
  };

  var enc = new TextEncoder();

  const issuerKeyPair = Nkeys.fromSeed(enc.encode(issuerSeed));

  const token = Jwt.encode(Jwt.Algorithms.v2, claims, issuerKeyPair);
  console.log("Token generated:", token);

  return token;
};

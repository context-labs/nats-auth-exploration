import * as Nats from "nats";
import * as Nkeys from "nkeys.js";
import * as Jwt from "nats-jwt";
import type { AuthorizationRequestClaims } from "./types/AuthorizationRequestClaims";
import { issuerSeed, type KuzcoWorkerJwtClaims } from "./get-user-token";

run();

interface MyAuthToken {
  user: string;
  signature: string;
}

const userData: {
  [key: string]: {
    account: string;
    permissions: {
      publish: { allow: string[] };
      subscribe: { allow: string[] };
    };
    rooms: {
      [key: string]: { users: string[] };
    };
  };
} = {
  user1: {
    account: "account1",
    permissions: {
      publish: { allow: ["public", "room1"] },
      subscribe: { allow: ["public", "room1"] },
    },
    rooms: {
      room1: {
        users: ["user1"],
      },
    },
  },
};

async function run() {
  const natsUrl = "nats://localhost:4223";
  const natsUser = "auth_service_user";
  const natsPass = "auth_service_user";

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  // Parse the issuer account signing key.
  const issuerKeyPair = Nkeys.fromSeed(enc.encode(issuerSeed));

  // Open the NATS connection passing the auth account creds file.
  const nc = await Nats.connect({
    servers: natsUrl,
    user: natsUser,
    pass: natsPass,
  });

  // Start subscription
  const sub = nc.subscribe("$SYS.REQ.USER.AUTH");
  console.log(`listening for ${sub.getSubject()} requests...`);
  for await (const msg of sub) {
    await msgHandler(msg, enc, dec, issuerKeyPair);
  }
}

async function msgHandler(
  req: Nats.Msg,
  enc: TextEncoder,
  dec: TextDecoder,
  issuerKeyPair: Nkeys.KeyPair
) {
  // Helper function to construct an authorization response.
  const respondMsg = async (
    req: Nats.Msg,
    userNkey: string,
    serverId: string,
    userJwt: string,
    errMsg: string
  ) => {
    let token: string;
    try {
      token = await Jwt.encodeAuthorizationResponse(
        userNkey,
        serverId,
        issuerKeyPair,
        { jwt: userJwt, error: errMsg },
        {}
      );
    } catch (err) {
      console.log("error encoding response JWT: %s", err);
      req.respond(undefined);
      return;
    }
    let data = enc.encode(token);
    req.respond(data);
  };

  // Check for Xkey header and decrypt
  let token: Uint8Array = req.data;

  const jwtPayload = Jwt.decode<AuthorizationRequestClaims>(dec.decode(token));
  console.log(`Auth service got message:`);
  console.log(JSON.stringify(jwtPayload, null, 2));

  // Decode the authorization request claims.
  let rc: AuthorizationRequestClaims;
  try {
    Jwt.encodeAuthorizationResponse;
    rc = Jwt.decode<AuthorizationRequestClaims>(
      dec.decode(token)
    ) as AuthorizationRequestClaims;
  } catch (e) {
    console.log(`Error decoding token: ${e}`);
    return respondMsg(req, "", "", "", (e as Error).message);
  }

  // console.log(`Decoded token: ${JSON.stringify(rc, null, 2)}`);

  // Used for creating the auth response.
  const userNkey = rc.nats.user_nkey;
  const serverId = rc.nats.server_id.id;

  console.log(`User Nkey: ${userNkey}`);
  console.log(`Server ID: ${serverId}`);

  // Try parse token
  const authToken = rc.nats.connect_opts.auth_token;
  if (!authToken) {
    console.log(`No auth_token in request`);
    return respondMsg(req, userNkey, serverId, "", "no auth_token in request");
  }

  console.log(`Auth token: ${authToken}`);

  const parsedAuthToken: KuzcoWorkerJwtClaims = Jwt.decode(authToken);
  console.log(`Decoded auth token: ${parsedAuthToken}`);

  if (!parsedAuthToken.nats.client_info?.worker_id) {
    return respondMsg(req, userNkey, serverId, "", "no worker_id in request");
  }

  if (!parsedAuthToken.nats.user_nkey) {
    return respondMsg(req, userNkey, serverId, "", "no user_nkey in request");
  }

  // Check if the token is valid (this where we check the signature of the JWT token, which should be issued by the Kuzco auth service)
  // if (parsedAuthToken.signature !== "signature-that-should-be-encrypted") {
  //   return respondMsg(req, userNkey, serverId, "", "invalid credentials");
  // }

  // User part of the JWT token to issue
  // Add "public" because if the allowed array is empty then all is allowed
  const user: Partial<Jwt.User> = {
    pub: { allow: ["public", "public.>"], deny: [] },
    sub: { allow: ["public", "public.>"], deny: [] },
  };

  console.log(`Auth service user: ${JSON.stringify(user)}`);

  // Prepare a user JWT.
  let ejwt: string;
  try {
    ejwt = await Jwt.encodeUser(
      rc.nats.connect_opts.user!,
      rc.nats.user_nkey,
      issuerKeyPair,
      user,
      { aud: "WORKERS" }
    );
  } catch (e) {
    console.log(`Error signing user JWT: ${e}`);
    return respondMsg(req, userNkey, serverId, "", "error signing user JWT");
  }

  console.log(`Encoded user JWT: ${ejwt}`);
  return respondMsg(req, userNkey, serverId, ejwt, "");
}

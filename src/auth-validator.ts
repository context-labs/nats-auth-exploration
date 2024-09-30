import * as Nats from "nats";
import * as Nkeys from "nkeys.js";
import * as Jwt from "nats-jwt";
import type { AuthorizationRequestClaims } from "./types/AuthorizationRequestClaims";

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
  const issuerSeed =
    "SAANDLKMXL6CUS3CP52WIXBEDN6YJ545GDKC65U5JZPPV6WH6ESWUA6YAI";

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
    console.log("Auth service got message");
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

  console.log(`Auth service got message: ${dec.decode(token)}`);

  // Decode the authorization request claims.
  let rc: AuthorizationRequestClaims;
  try {
    Jwt.encodeAuthorizationResponse;
    rc = Jwt.decode<AuthorizationRequestClaims>(
      dec.decode(token)
    ) as AuthorizationRequestClaims;
  } catch (e) {
    return respondMsg(req, "", "", "", (e as Error).message);
  }

  // Used for creating the auth response.
  const userNkey = rc.nats.user_nkey;
  const serverId = rc.nats.server_id.id;

  // Try parse token
  const authToken = rc.nats.connect_opts.auth_token;
  if (!authToken) {
    return respondMsg(req, userNkey, serverId, "", "no auth_token in request");
  }
  let parsedAuthToken: MyAuthToken;
  try {
    parsedAuthToken = JSON.parse(authToken);
  } catch (e) {
    return respondMsg(req, "", "", "", (e as Error).message);
  }

  // Check if the token is valid.
  if (parsedAuthToken.signature !== "signature-that-should-be-encrypted") {
    return respondMsg(req, userNkey, serverId, "", "invalid credentials");
  }

  // Check if the user exists.
  const userProfile = userData[parsedAuthToken.user];
  if (!userProfile) {
    return respondMsg(req, userNkey, serverId, "", "user not found");
  }

  // Get the requested subjects/rooms for this connection (passed in the user field but should be passed in client_info field somewhow?)
  const requestedRooms = rc.nats.connect_opts.user?.split(";") ?? [];
  console.log(
    `Auth service requested permission to rooms: ${JSON.stringify(
      requestedRooms
    )}`
  );

  // User part of the JWT token to issue
  // Add "public" because if the allowed array is empty then all is allowed
  const user: Partial<Jwt.User> = {
    pub: { allow: ["public", ...requestedRooms], deny: [] },
    sub: { allow: ["public", ...requestedRooms], deny: [] },
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
      { aud: userProfile.account }
    );
  } catch (e) {
    return respondMsg(req, userNkey, serverId, "", "error signing user JWT");
  }

  return respondMsg(req, userNkey, serverId, ejwt, "");
}

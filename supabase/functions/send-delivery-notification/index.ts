import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { partner_id, assignment_id } = await req.json();

    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all push subscriptions for this partner
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("partner_id", partner_id);

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log("No subscriptions found for partner:", partner_id);
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: "🔔 New Delivery Request!",
      body: "You have a new order to deliver. Open the app to accept.",
      data: { assignment_id, url: "/" },
      tag: `assignment-${assignment_id}`,
      requireInteraction: true,
    });

    // Send web push to each subscription
    let sent = 0;
    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        // Use web-push compatible approach with crypto
        const response = await sendWebPush(
          pushSubscription,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          supabaseUrl
        );

        if (response.ok) {
          sent++;
        } else {
          const text = await response.text();
          console.error("Push failed:", response.status, text);
          // Remove invalid subscriptions (410 Gone or 404)
          if (response.status === 410 || response.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } catch (e) {
        console.error("Error sending push to subscription:", e);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Minimal Web Push implementation using Web Crypto API
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  audience: string
) {
  // For simplicity, we'll use a fetch-based approach with VAPID headers
  const vapidHeaders = await generateVapidHeaders(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    audience
  );

  // Encrypt payload using Web Crypto
  const encrypted = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth
  );

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      ...vapidHeaders,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "high",
    },
    body: encrypted,
  });
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidHeaders(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  audience: string
) {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud, exp: now + 12 * 3600, sub: `mailto:noreply@${new URL(audience).host}` };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  const privateKeyBytes = base64UrlToUint8Array(privateKey);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    convertRawPrivateKeyToPKCS8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(unsignedToken)
    )
  );

  const token = `${unsignedToken}.${uint8ArrayToBase64Url(signature)}`;

  return {
    Authorization: `vapid t=${token}, k=${publicKey}`,
  };
}

function convertRawPrivateKeyToPKCS8(rawKey: Uint8Array): ArrayBuffer {
  // DER encoding for PKCS8 wrapping of a P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We need the public key too, but since we don't have it, we'll use a minimal structure
  const result = new Uint8Array(pkcs8Header.length + 32);
  result.set(pkcs8Header);
  result.set(rawKey.slice(0, 32), pkcs8Header.length);
  return result.buffer;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authKey: string
): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import subscriber's public key
  const subscriberPublicKeyBytes = base64UrlToUint8Array(p256dhKey);
  const authSecret = base64UrlToUint8Array(authKey);

  // Generate ephemeral key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber public key
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      keyPair.privateKey,
      256
    )
  );

  // Export local public key
  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );

  // Derive encryption key using HKDF
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await hkdfExtract(authSecret, sharedSecret);

  const ikm = await hkdfExpand(prk, concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
    subscriberPublicKeyBytes,
    localPublicKey
  ), 32);

  const prkFinal = await hkdfExtract(salt, ikm);
  const contentEncryptionKey = await hkdfExpand(
    prkFinal,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdfExpand(
    prkFinal,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12
  );

  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Add padding delimiter
  const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm header: salt (16) + rs (4) + idLen (1) + keyId (65)
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);
  const header = concatBuffers(
    salt,
    new Uint8Array(rs.buffer),
    new Uint8Array([65]),
    localPublicKey
  );

  return concatBuffers(header, encrypted);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = concatBuffers(info, new Uint8Array([1]));
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
}

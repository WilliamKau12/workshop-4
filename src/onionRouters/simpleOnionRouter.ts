import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt } from "../crypto";

export async function simpleOnionRouter(routerId: number) {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  let lastEncryptedMessage: string | null = null;
  let lastDecryptedMessage: string | null = null;
  let lastDestination: number | null = null;

  // Generate RSA key pair
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const publicKeyBase64 = await exportPubKey(publicKey);
  const privateKeyBase64 = await exportPrvKey(privateKey);

  // Register the node with the registry
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId: routerId, pubKey: publicKeyBase64 }),
  });

  // Status endpoint
  app.get("/status", (req, res) => {
    res.status(200).send("live");
  });

  // Get last received encrypted message
  app.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastEncryptedMessage });
  });

  // Get last received decrypted message
  app.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastDecryptedMessage });
  });

  // Get last message destination
  app.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastDestination });
  });

  // Get private key
  app.get("/getPrivateKey", (req, res) => {
    res.json({ result: privateKeyBase64 });
  });

  // Handle incoming messages
  app.post("/message", async (req, res) => {
    const { message } = req.body;

    // Split the message into encrypted symmetric key and encrypted layer
    const encryptedSymmetricKey = message.slice(0, 344);
    const encryptedMessageLayer = message.slice(344);

    // Decrypt the symmetric key using RSA
    const symmetricKey = await rsaDecrypt(encryptedSymmetricKey, privateKey);

    // Decrypt the message layer using the symmetric key
    const decryptedLayer = await symDecrypt(symmetricKey, encryptedMessageLayer);

    // Extract destination and inner message
    const destination = parseInt(decryptedLayer.slice(0, 10), 10);
    const innerMessage = decryptedLayer.slice(10);

    // Update state
    lastEncryptedMessage = message;
    lastDecryptedMessage = innerMessage;
    lastDestination = destination;

    // Forward the message to the next destination
    if (destination) {
      await fetch(`http://localhost:${destination}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: innerMessage }),
      });
      res.status(200).send("success");
    } else {
      res.status(400).send("failed");
    }
  });

  // Start the server
  const port = BASE_ONION_ROUTER_PORT + routerId;
  const server = app.listen(port, () => {
    console.log(`Onion router ${routerId} is listening on port ${port}`);
  });

  return server;
}
import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT } from "../config";
import crypto from "crypto";

// Global state to store node information
let lastReceivedEncryptedMessage: string | null = null;
let lastReceivedDecryptedMessage: string | null = null;
let lastMessageDestination: number | null = null;
let registeredNodes: { nodeId: number; pubKey: string }[] = [];

export async function simpleOnionRouter(nodeId: number) {
  // Generate a pair of private and public keys for the node
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  // Convert keys to base64 strings for storage and transmission
  const privateKeyBase64 = privateKey.export({ type: "pkcs1", format: "pem" }).toString("base64");
  const publicKeyBase64 = publicKey.export({ type: "spki", format: "pem" }).toString("base64");

  // Create an Express app
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Register the node on startup
  registeredNodes.push({ nodeId, pubKey: publicKeyBase64 });

  // Route to check the status of the node
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // Route to get the last received encrypted message
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  // Route to get the last received decrypted message
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  // Route to get the last message destination
  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  // Route to register a new node
  onionRouter.post("/registerNode", (req, res) => {
    const { nodeId, pubKey } = req.body;

    // Validate the request
    if (typeof nodeId !== "number" || typeof pubKey !== "string") {
      return res.status(400).json({ error: "Invalid nodeId or pubKey" });
    }

    // Check if the node is already registered
    if (registeredNodes.some((node) => node.nodeId === nodeId)) {
      return res.status(400).json({ error: "Node already registered" });
    }

    // Register the node
    registeredNodes.push({ nodeId, pubKey });
    return res.json({ result: "Node registered successfully" });
  });

  // Route to get the private key of the node (for testing purposes)
  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: privateKeyBase64 });
  });

  // Route to get the list of all registered nodes
  onionRouter.get("/getNodeRegistry", (req, res) => {
    res.json({ nodes: registeredNodes });
  });

  // Start the server
  const port = BASE_ONION_ROUTER_PORT + nodeId;
  const server = onionRouter.listen(port, () => {
    console.log(`Onion router ${nodeId} is listening on port ${port}`);
  });

  return server;
}
import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { createRandomSymmetricKey, importSymKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";
import { GetNodeRegistryBody } from "../registry/registry";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export type ReceiveMessageBody = {
  message: string;
};

export type NodeCircuit = {
  nodeId: number;
  pubKey: string;
};

let lastCircuit: NodeCircuit[] | null = null;

export async function user(userId: number) {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

  // Status endpoint
  app.get("/status", (req, res) => {
    res.status(200).send("live");
  });

  // Get the last received message
  app.get("/getLastReceivedMessage", (req, res) => {
    res.status(200).json({ result: lastReceivedMessage });
  });

  // Get the last sent message
  app.get("/getLastSentMessage", (req, res) => {
    res.status(200).json({ result: lastSentMessage });
  });

  // Receive a message
  app.post("/message", (req, res) => {
    const { message } = req.body as ReceiveMessageBody;
    lastReceivedMessage = message;
    res.status(200).send("success");
  });

  // Get the last circuit used
  app.get("/getLastCircuit", (req, res) => {
    if (lastCircuit) {
      const nodeIds = lastCircuit.map((node) => node.nodeId);
      res.status(200).json({ result: nodeIds });
    } else {
      res.status(404).send("No circuit found");
    }
  });

  // Send a message
  app.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;

    // Fetch the node registry
    const registryResponse = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
    const { nodes } = (await registryResponse.json()) as GetNodeRegistryBody;

    // Create a random circuit of 3 distinct nodes
    const circuit: NodeCircuit[] = [];
    while (circuit.length < 3) {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (!circuit.some((node) => node.nodeId === randomNode.nodeId)) {
        circuit.push(randomNode);
      }
    }
    lastCircuit = circuit;

    // Encrypt the message layer by layer
    let encryptedMessage = message;
    let destination = String(BASE_USER_PORT + destinationUserId).padStart(10, "0");

    for (const node of circuit) {
      // Generate a symmetric key for this layer
      const symKey = await createRandomSymmetricKey();
      const symKeyString = await exportSymKey(symKey);

      // Encrypt the message with the symmetric key
      const tempMessage = await symEncrypt(symKey, destination + encryptedMessage);

      // Update the destination for the next layer
      destination = String(BASE_ONION_ROUTER_PORT + node.nodeId).padStart(10, "0");

      // Encrypt the symmetric key with the node's public key
      const encryptedSymKey = await rsaEncrypt(symKeyString, node.pubKey);

      // Combine the encrypted symmetric key and the encrypted message
      encryptedMessage = encryptedSymKey + tempMessage;
    }

    // Reverse the circuit for tracking purposes
    circuit.reverse();
    lastCircuit = circuit;
    lastSentMessage = message;

    // Send the encrypted message to the entry node
    const entryNode = circuit[0];
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: encryptedMessage }),
    });

    res.sendStatus(200);
  });

  // Start the server
  const server = app.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}
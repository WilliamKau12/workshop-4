import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = {
  nodeId: number;
  pubKey: string;
};

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  // Status endpoint
  app.get("/status", (req: Request, res: Response) => {
    res.status(200).send("live");
  });

  // In-memory storage for registered nodes
  const registeredNodes: Node[] = [];

  // Register a new node
  app.post("/registerNode", async (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body as RegisterNodeBody;

    // Validate request body
    if (nodeId === undefined || pubKey === undefined || pubKey === "") {
      return res.status(400).json({ error: "Missing nodeId or pubKey" });
    }

    // Check if node is already registered
    if (registeredNodes.some((node) => node.nodeId === nodeId)) {
      return res.status(400).json({ error: "Node already registered" });
    }

    // Register the node
    registeredNodes.push({ nodeId, pubKey });
    return res.status(200).json({ success: true });
  });

  // Get the list of registered nodes
  app.get("/getNodeRegistry", (req: Request, res: Response<GetNodeRegistryBody>) => {
    res.status(200).json({ nodes: registeredNodes });
  });

  // Start the server
  const server = app.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
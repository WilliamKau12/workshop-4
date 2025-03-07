import express from "express";
import { BASE_USER_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export type MessageBody = {
  message: string;
};

// Global state to store the last received message
let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json()); // Middleware to parse JSON request bodies

  // Route to check the status of the user
  _user.get("/status", (req, res) => {
    res.send("live");
  });

  // Route to get the last received message
  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

    // Route to get the last received message
  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });


  // Route to receive messages
  _user.post("/message", (req, res) => {
    const { message }: MessageBody = req.body;
    if (!message) {
      return res.status(400).send("Message is required");
    }
    lastReceivedMessage = message;
    return res.send("success");
  });

  // Start the server
  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}
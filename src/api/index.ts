import "dotenv/config";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.send("WebSocket connection has been established");

  // ⚠️ CLIENT SHOULD ALWAYS SEND STRINGIFIED DATA
  // ⚠️ SERVER ALWAYS RECIEVES BUFFER
  // convert BUFFER to STRING using toString()
  // convert STRING to JSON.parse provided you were expecting a JS OBJECT
  socket.on("message", (obj) => {
    const action = JSON.parse(obj.toString());
  });
});

server.listen(process.env.PORT, () =>
  console.log(`HTTP & WS server is ONLINE`)
);

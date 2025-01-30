import "dotenv/config";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.on("open", () => {
    socket.send("WebSocket ONLINE");
  });

  socket.on("close", () => {
    console.log(`socket has been called`);
  });

  // ⚠️ CLIENT SHOULD ALWAYS SEND STRINGIFIED DATA
  // ⚠️ SERVER ALWAYS RECIEVES BUFFER
  // convert BUFFER to STRING using toString()
  // convert STRING to JSON.parse provided you were expecting a JS OBJECT
  // PRE-DEFINED EVENTS : message , error , close , open
  socket.on("message", (obj) => {
    const action = JSON.parse(obj.toString());
    switch (action.type) {
      case "message":
        console.log(action.payload.message);
        break;
      default:
        console.log(`default action has been hit`);
    }
  });
});

server.listen(process.env.PORT, () =>
  console.log(`HTTP & WS server is ONLINE`)
);

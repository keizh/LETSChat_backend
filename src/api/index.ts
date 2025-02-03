import "dotenv/config";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { USER_model } from "../model/modelIndex";
import UserRouter from "../Routes/UserRoutes";
import CharRouter from "../Routes/ChatRoutes";
import db_connect from "../DB/db_connect";
db_connect();
import { objectOfUsersInterface, objectOfRoomsInterface } from "../types";
import {
  UpdateobjectOfRoomsLogin,
  UpdateobjectOfRoomsLogout,
} from "../utils/ExecutionerFn";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(
  cors({
    origin: "*",
    methods: ["PUT", "PATCH", "GET", "POST", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    // credentials:true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());

app.use("/user", UserRouter);
app.use("/chat", CharRouter);

export const objectOfUsers: objectOfUsersInterface = {};
export const objectOfRooms: objectOfRoomsInterface = {};

wss.on("connection", (socket) => {
  // ⚠️ CLIENT SHOULD ALWAYS SEND STRINGIFIED DATA
  // ⚠️ SERVER ALWAYS RECIEVES BUFFER
  // convert BUFFER to STRING using toString()
  // convert STRING to JSON.parse provided you were expecting a JS OBJECT
  // PRE-DEFINED EVENTS : message , error , close , open
  console.log(`websocket connection has been established`);
  socket.on("message", (obj) => {
    // parsing the object recieved from client
    const action = JSON.parse(obj.toString());

    switch (action.type) {
      // ⚠️ HANDLE CLIENT LOGIN
      case "LOGIN":
        const { userId: userIdLogin } = action.payload;
        objectOfUsers[userIdLogin] = {
          IsUserActiveInAnyChat: false,
          ActiveChatRoomId: null,
          socket: socket,
        };
        // console.log(`LINE 46`, objectOfUsers);
        UpdateobjectOfRoomsLogin(userIdLogin, socket);
        break;

      // ⚠️ HANDLE CLIENT LOGOUT
      case "LOGOUT":
        const { userId: userIdLogout } = action.payload;
        delete objectOfUsers[userIdLogout];
        // console.log(`LINE 53`, objectOfUsers);
        UpdateobjectOfRoomsLogout(userIdLogout);
        break;
      default:
        console.log(`default action has been hit`);
    }
  });

  socket.on("close", (code, reason) => {
    console.log(` CLOSING THE CLIENT FOR CODE ${code} & reason : ${reason}`);
  });
});

server.listen(process.env.PORT, () =>
  console.log(`HTTP & WS server is ONLINE`)
);

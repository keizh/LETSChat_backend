import "dotenv/config";
import express from "express";
const cloudinary = require("cloudinary").v2;
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import {
  GROUP_CHAT_model,
  ONE_2_ONE_CHAT_model,
  USER_model,
} from "../model/modelIndex";
import UserRouter from "../Routes/UserRoutes";
import CharRouter from "../Routes/ChatRoutes";
import db_connect from "../DB/db_connect";
import { v4 as uuidv4 } from "uuid";
db_connect();
import { objectOfUsersInterface, objectOfRoomsInterface } from "../types";
import {
  UpdateobjectOfRoomsLogin,
  UpdateobjectOfRoomsLogout,
  SendMessageToAllActiveMembers,
} from "../utils/ExecutionerFn";
import cors from "cors";
import fileRouter from "../Routes/FileRoutes";

cloudinary.config({
  cloud_name: process.env.cloud_name,
  api_key: process.env.api_key,
  api_secret: process.env.api_secret,
});

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
app.use("/file", fileRouter);

export const objectOfUsers: objectOfUsersInterface = {};
export const objectOfRooms: objectOfRoomsInterface = {};

wss.on("connection", (socket) => {
  // ⚠️ CLIENT SHOULD ALWAYS SEND STRINGIFIED DATA
  // ⚠️ SERVER ALWAYS RECIEVES BUFFER
  // convert BUFFER to STRING using toString()
  // convert STRING to JSON.parse provided you were expecting a JS OBJECT
  // PRE-DEFINED EVENTS : message , error , close , open
  console.log(`websocket connection has been established`);
  socket.on("message", async (obj) => {
    // parsing the object recieved from client
    const action: any = JSON.parse(obj.toString());

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
        // async job inside of the below function so the reflection in objectOfRooms will take time
        UpdateobjectOfRoomsLogin(userIdLogin, socket);
        console.log(`objectOfUser at login`, objectOfUsers);
        console.log(`objectOfRoom at login`, objectOfRooms);
        break;

      // ⚠️ HANDLE CLIENT LOGOUT
      case "LOGOUT":
        const { userId: userIdLogout } = action.payload;
        delete objectOfUsers[userIdLogout];
        // console.log(`LINE 53`, objectOfUsers);
        // async job inside of the below function so the reflection in objectOfRooms will take time
        UpdateobjectOfRoomsLogout(userIdLogout);
        console.log(`objectOfUser at logout`, objectOfUsers);
        console.log(`objectOfRoom at logout`, objectOfRooms);
        break;

      case "SEND/MESSAGE":
        const {
          userId: userIdOfSender,
          userName,
          roomId,
          chatId,
          message,
        } = action.payload;
        const mssgDOC = {
          type: "text",
          payload: message,
          mssgId: uuidv4(),
          senderId: userIdOfSender,
          senderName: userName,
          uploadTime: Date.now(),
        };

        if (chatId.includes("PERSONAL")) {
          await ONE_2_ONE_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $addToSet: {
                messages: mssgDOC,
              },
            },
            { new: true }
          );
        } else {
          await GROUP_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $addToSet: {
                messages: mssgDOC,
              },
            },
            { new: true }
          );
        }

        SendMessageToAllActiveMembers(mssgDOC, roomId, userIdOfSender, chatId);
        break;

      case "CLOSE/CHAT":
        const { userId: userIdToSetRoomIdToNull } = action.payload;
        objectOfUsers[userIdToSetRoomIdToNull].ActiveChatRoomId = null;
        console.log(`objectOfUser at closing chat`, objectOfUsers);
        console.log(`objectOfRoom at closing chat`, objectOfRooms);
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

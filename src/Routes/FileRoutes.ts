import express, { Router } from "express";
import AuthorizedRoute from "../utils/AuthorizedRoute";
const cloudinary = require("cloudinary").v2;
const multer = require(`multer`);
import { objectOfRooms, objectOfUsers } from "../api";
import { ONE_2_ONE_CHAT_model, GROUP_CHAT_model } from "../model/modelIndex";
import { v4 as uuidv4 } from "uuid";
import { SendMessageToAllActiveMembers } from "../utils/ExecutionerFn";

const fileRouter = Router();

const upload = multer({
  storage: multer.diskStorage({}),
  //   limiting size of each file , not array of files
  limits: {
    fileSize: 4.2 * 1024 * 1024,
  },
});

//  ["text", "image", "audio", "video", "pdf"]
const assignType = (Filetype: string): string => {
  if (Filetype == "pdf") {
    return "pdf";
  } else if (Filetype == "png" || Filetype == "jpeg") {
    return "image";
  } else if (Filetype == "mpeg") {
    return "audio";
  } else if (Filetype == "mp4") {
    return "video";
  } else {
    return "text";
  }
};

fileRouter.post(
  "/",
  AuthorizedRoute,
  upload.array("fileInput", 10),
  async (req, res) => {
    try {
      const files = req.files;
      //   chatId ~ _id in GROUP/ONE
      const {
        userId,
        userName,
        roomId,
        chatId,
      }: { userId: string; roomId: string; chatId: string; userName: string } =
        req.body;

      const isItGroupChat = chatId.includes("PERSONAL");

      files?.forEach(async (file: any) => {
        const Filetype = file.type.split("/")[1];
        let type = assignType(Filetype);
        const mssgId = uuidv4();
        const uploaded = await cloudinary.uploader.upload(file.path, {
          resource_type: "auto",
        });
        const mssgDOC = {
          type,
          payload: uploaded?.secure_url,
          mssgId,
          senderId: userId,
          senderName: userName,
          uploadTime: Date.now(),
        };

        // for updating in group
        if (isItGroupChat) {
          await GROUP_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $addToSet: {
                messages: mssgDOC,
              },
            },
            { new: true }
          );
        } else {
          // for updating in ONE2ONE CHAT
          await ONE_2_ONE_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $addToSet: {
                messages: mssgDOC,
              },
            },
            { new: true }
          );
        }

        // RESPONSIBLE FOR SENDING MESSAGE IF OTHER PARTICIPANTS ARE ACTIVE IN ROOM OR ELSE SEND THEM ALERT
        SendMessageToAllActiveMembers(mssgDOC, roomId, userId, chatId);
      });

      res.status(200).json({ message: "file uploaded" });
    } catch (err: unknown) {
      const mss = err instanceof Error ? err.message : "";
      res.status(500).json({ message: "Failed to Upload Files" });
    }
  }
);

export default fileRouter;

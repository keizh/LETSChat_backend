import express, { Router } from "express";
import AuthorizedRoute from "../utils/AuthorizedRoute";
const cloudinary = require("cloudinary").v2;
const multer = require(`multer`);
import { objectOfRooms, objectOfUsers } from "../api";
import {
  ONE_2_ONE_CHAT_model,
  GROUP_CHAT_model,
  USER_model,
} from "../model/modelIndex";
import { v4 as uuidv4 } from "uuid";
import {
  SendMessageToAllActiveMembers,
  SendDeleteMessage,
} from "../utils/ExecutionerFn";
import { mssgInterface } from "../types";
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
  upload.array("fileInput", 8),
  async (req, res) => {
    try {
      const files = req.files;

      // console.log(`files =>`, files);
      // console.log(`---------------------->`);
      //   chatId ~ _id in GROUP/ONE
      let messages: any;
      const {
        userId,
        userName,
        roomId,
        chatId,
      }: { userId: string; roomId: string; chatId: string; userName: string } =
        req.body;
      // console.log(`userId =>`, userId);
      // console.log(`userName =>`, userName);
      // console.log(`roomId =>`, roomId);
      // console.log(`chatId =>`, chatId);
      // console.log(`---------------------->`);

      const isItGroupChat = chatId.includes("PERSONAL");
      console.log(isItGroupChat);

      // // settle them , cloudinary can take concurrent uploads
      const arrayOfAllSettled = await Promise.allSettled(
        files?.map(async (file: any) => {
          const Filetype = file.mimetype.split("/")[1];
          let type = assignType(Filetype);
          const mssgId = uuidv4();
          //
          const timestamp = Math.round(Date.now() / 1000);
          const signature = cloudinary.utils.api_sign_request(
            { timestamp },
            cloudinary.config().api_secret
          );
          // console.log(`file path`, file.path);
          const uploaded = await cloudinary.uploader.upload(file.path, {
            resource_type: "auto",
            api_key: cloudinary.config().api_key,
            signature,
            timestamp,
            cloud_name: cloudinary.config().cloud_name,
          });

          const mssgDOC = {
            type,
            payload: uploaded?.secure_url,
            mssgId,
            senderId: userId,
            senderName: userName,
            uploadTime: Date.now(),
          };

          return mssgDOC;
        }) ?? []
      );

      // console.log(`arrayOfAllSettled`, arrayOfAllSettled);
      // console.log(`---------------------->`);
      const allFullfilledPromises = arrayOfAllSettled.filter(
        (ele) => ele.status == "fulfilled"
      );

      // console.log(`All fulfilled promises =>`, allFullfilledPromises);
      // console.log(`---------------------->`);
      if (allFullfilledPromises.length > 0) {
        messages = allFullfilledPromises.map((ele) => ele.value);
        // console.log(`messages from all fulfilled promises =>`, messages);
        // console.log(`---------------------->`);
        // for updating in group
        console.log(`messages`, messages);
        const reverse_messages = messages.reverse();
        console.log(`reversed messages`, reverse_messages);
        if (chatId.includes("PERSONAL") == false) {
          await GROUP_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $push: {
                messages: { $each: reverse_messages, $position: 0 },
              },
            },
            { new: true }
          );
        } else {
          console.log(`128===========>`);
          console.log(`uploadinf files `);
          await ONE_2_ONE_CHAT_model.findByIdAndUpdate(
            chatId,
            {
              $push: {
                messages: { $each: reverse_messages, $position: 0 },
              },
            },
            { new: true }
          );
        }

        // RESPONSIBLE FOR SENDING MESSAGE IF OTHER PARTICIPANTS ARE ACTIVE IN ROOM OR ELSE SEND THEM ALERT
        SendMessageToAllActiveMembers(messages, roomId, userId, chatId);
      }

      res.status(200).json({ message: "file uploaded" });
    } catch (err: unknown) {
      const mss = err instanceof Error ? err.message : "";
      res.status(500).json({ message: "Failed to Upload Files" });
    }
  }
);

fileRouter.post(
  "/updateProfileURL",
  AuthorizedRoute,
  upload.single("profileImage"),
  async (req, res) => {
    const file = req.file;
    console.log(`update eprofile image hit 🌟🌟🌟🌟🌟`);
    try {
      if (file) {
        const uploaded = await cloudinary.uploader.upload(file.path, {
          resource_type: "auto",
        });
        console.log(uploaded);
        const userId = req.userId;

        await USER_model.findByIdAndUpdate(
          userId,
          {
            $set: {
              profileURL: uploaded.secure_url,
            },
          },
          { new: true }
        );

        res.status(200).json({
          message: "ProfileImage was successfully updated",
          data: uploaded.secure_url,
        });
        return;
      }
      res.status(404).json({ message: "Failed to Provide Image" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update Profile Image" });
    }
  }
);

export default fileRouter;

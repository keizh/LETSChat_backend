import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  ONE_2_ONE_CHAT_model,
  USER_model,
  USER_CONVERSATION_MAPPER_MODEL,
} from "../model/modelIndex";
const ChatRouter = Router();
import AuthorizedRoute from "../utils/AuthorizedRoute";
import { v4 as uuidv4 } from "uuid";
import { objectOfRooms, objectOfUsers } from "../api/index";

ChatRouter.get(
  "/contacts",
  AuthorizedRoute,
  async (req: Request, res: Response): Promise<void> => {
    let limit: number = 15;
    let curPage: number;
    let nextPage: number;
    let totalDocuments: number;
    let totalPages: number;
    let hasMore: boolean;

    const { page } = req.query;
    // console.log(`LINE 20`, page);
    curPage = parseInt(page);
    nextPage = parseInt(page) + 1;
    let skip = (curPage - 1) * limit;
    const userId = req.userId;
    // console.log(userId);
    try {
      let AllUsers = await USER_model.find({
        _id: { $nin: [userId] },
      }).lean();
      totalDocuments = AllUsers.length;
      totalPages = Math.ceil(totalDocuments / limit);
      hasMore = totalPages > curPage;
      const data = await USER_model.find({ _id: { $nin: [userId] } })
        .skip(skip)
        .limit(limit);
      // console.log({
      //   totalPages,
      //   totalDocuments,
      //   curPage,
      //   nextPage,
      //   hasMore,
      // });
      res.status(200).json({
        totalPages,
        totalDocuments,
        curPage,
        nextPage,
        hasMore,
        data,
      });
    } catch (err: unknown) {
      res.status(500).json({ message: "Server Error : fetching contacts" });
    }
  }
);

ChatRouter.get(
  "/contacts/search",
  AuthorizedRoute,
  async (req: Request, res: Response): Promise<void> => {
    const { search } = req.query;
    const result = await USER_model.find({ name: new RegExp(search, "i") });
    // console.log(result);

    res.status(200).json({ message: "Search Data fetched", data: result });

    try {
    } catch (err: unknown) {
      res.status(500).json({ message: "Server Error : fetching contacts" });
    }
  }
);

ChatRouter.post(
  "/ONE2ONE",
  AuthorizedRoute,
  async (req, res): Promise<void> => {
    try {
      const { participants } = req.body;
      const userId = req.userId;
      const data = await ONE_2_ONE_CHAT_model.findOne({
        participants,
      });
      console.log(`82`, data);
      if (!data) {
        let roomId = uuidv4();
        let _id = `PERSONAL-${uuidv4()}`;
        let newData = new ONE_2_ONE_CHAT_model({
          participants,
          messages: [],
          roomId,
          _id,
        });
        console.log(`line 92 `, newData);
        let newONE2ONECHAT = await newData.save();
        // START : ADDING TO  USER_CONVERSATION_MAPPER_MODEL OF EACH PARTICIPANT
        await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
          { userId: participants[0] },
          { $addToSet: { ONE2ONEchat: _id } },
          { new: true }
        );
        await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
          { userId: participants[1] },
          { $addToSet: { ONE2ONEchat: _id } },
          { new: true }
        );
        // END  : ADDING TO  USER_CONVERSATION_MAPPER_MODEL OF EACH PARTICIPANT

        // START : ADDED NEW ROOM CREATED TO OBJECT_OF_ROOMS

        // ADDING FOR THE USER FIRST
        // participant[0] --> user
        const websocketInstanceCorrespondingToUser =
          objectOfUsers[userId].socket;
        // before the below statement , no such key existed and array was not the value
        objectOfRooms[`${roomId}`] = [
          { WebSocketInstance: websocketInstanceCorrespondingToUser, userId },
        ];

        // ADDING FOR THE SECOND USER , if he is active/online
        // participant[1] --> opposite user
        const websocketInstanceCorrespondingToOppositeUser = objectOfUsers[
          participants[1]
        ]
          ? objectOfUsers[participants[1]].socket
          : null;
        if (websocketInstanceCorrespondingToOppositeUser) {
          // before the below statement , key~roomId existed and also did the array
          objectOfRooms[`${roomId}`] = [
            ...objectOfRooms[`${roomId}`],
            {
              WebSocketInstance: websocketInstanceCorrespondingToOppositeUser,
              userId: participants[1],
            },
          ];
        }

        console.log(`object of user`, objectOfUsers);
        console.log(`object of rooms`, objectOfRooms);

        // END : ADDED NEW ROOM CREATED TO OBJECT_OF_ROOMS

        res.status(200).json({ data: newONE2ONECHAT });
        console.log(`94`, newONE2ONECHAT);
        return;
      }
      // console.log(data);
      res.status(200).json({ data });
    } catch (err: unknown) {
      console.log(`line 100`, err);
      const mssg = err instanceof Error ? err.message : "";
      res.status(500).json({ message: mssg });
    }
  }
);

export default ChatRouter;

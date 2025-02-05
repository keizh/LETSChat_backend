import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  ONE_2_ONE_CHAT_model,
  USER_model,
  USER_CONVERSATION_MAPPER_MODEL,
  USER_CHAT_LAST_ACCESS_TIME_model,
} from "../model/modelIndex";
const ChatRouter = Router();
import AuthorizedRoute from "../utils/AuthorizedRoute";
import { v4 as uuidv4 } from "uuid";
import { objectOfRooms, objectOfUsers } from "../api/index";
import {
  USER_CONVERSATION_MAPPER_Interface,
  combinedActiveChat,
} from "../types";

// RESPONSIBLE FOR FETCHING FRIENDS
ChatRouter.get(
  "/contacts",
  AuthorizedRoute,
  async (
    req: Request<{}, {}, {}, { page: string }>,
    res: Response
  ): Promise<void> => {
    let limit: number = 15;
    let curPage: number;
    let nextPage: number;
    let totalDocuments: number;
    let totalPages: number;
    let hasMore: boolean;

    // all query string become string from thier original datatype
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

// RESPONSIBLE FOR SEARCING FRIENDS
ChatRouter.get(
  "/contacts/search",
  AuthorizedRoute,
  async (
    req: Request<{}, {}, {}, { search: string }>,
    res: Response
  ): Promise<void> => {
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

// RESPONSIBLE FOR STARTING ONE2ONE conversation if non exist
// RESPONSIBLE FOR FETCHING ONE20NE conversation if exists ,
// RESPONSIBLE FOR MARKING LAST LOGIN TIME
//  a. if conversation exists mark last login
//  b. if conversation does not exist , make and then mark last login
// RESPONSIBLE FOR MARKING ACTIVE ROOM

ChatRouter.post(
  "/ONE2ONE",
  AuthorizedRoute,
  async (req, res): Promise<void> => {
    try {
      const { participants, userIdOfClient, userIdOfOppositeUser } = req.body;
      const userId = req.userId as string;
      const data = await ONE_2_ONE_CHAT_model.findOne({
        participants: participants.sort(),
      }).lean();

      if (data) {
        const { roomId, _id: chatId } = data;
        // RESPONSIBLE FOR MARKING LAST LOGIN TIME
        await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId, "lastAccessTime.roomId": roomId },
          { $set: { "lastAccessTime.$.lastAccessMoment": Date.now() } },
          { new: true }
        );
        // START :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user
        objectOfUsers[userId].ActiveChatRoomId = roomId;
        // END :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user
      }

      console.log(`new document , `, data);
      // console.log(`82`, data);
      // if data does not exist, it means the ONE2ONE HAS YET TO CREATED
      if (!data) {
        let roomId = uuidv4();
        let _id = `PERSONAL-${uuidv4()}`;
        let newData = new ONE_2_ONE_CHAT_model({
          participants,
          messages: [],
          roomId,
          _id,
        });
        // START :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user
        objectOfUsers[userId].ActiveChatRoomId = roomId;
        // END :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user

        // console.log(`line 92 `, newData);
        let newONE2ONECHAT = await newData.save();
        // START : ADDING TO  USER_CONVERSATION_MAPPER_MODEL OF EACH PARTICIPANT
        await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
          { userId: userIdOfClient },
          { $addToSet: { ONE2ONEchat: _id } },
          { new: true }
        );
        await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
          { userId: userIdOfOppositeUser },
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

        // ADDING FOR THE SECOND USER , if he is active/online on the application
        // participant[1] --> opposite user
        const websocketInstanceCorrespondingToOppositeUser = objectOfUsers[
          userIdOfOppositeUser
        ]
          ? objectOfUsers[userIdOfOppositeUser].socket // ~ true
          : null;
        if (websocketInstanceCorrespondingToOppositeUser) {
          // before the below statement , key~roomId existed and also did the array , WITH VALUE = [PARTICIPANT[0].USERID]
          objectOfRooms[`${roomId}`] = [
            ...objectOfRooms[`${roomId}`],
            {
              WebSocketInstance: websocketInstanceCorrespondingToOppositeUser,
              userId: userIdOfOppositeUser,
            },
          ];
        }

        console.log(
          `object of user after creating doc with 0 messages`,
          objectOfUsers
        );
        console.log(
          `object of rooms after creating doc with 0 messages`,
          objectOfRooms
        );
        // END : ADDED NEW ROOM CREATED TO OBJECT_OF_ROOMS

        // START : SETTING ACTIVE_ROOMId_of_user to this roomId , becuase on frontend this room will be active one for the moment
        objectOfUsers[userId].ActiveChatRoomId = roomId;
        // END : SETTING ACTIVE_ROOMId_of_user to this roomId , becuase on frontend this room will be active one for the moment

        // START : ADDING NEW roomId & lastAccessTime TO LAST_ACCESS_USER_TIME_MODEL
        await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId },
          {
            $addToSet: {
              lastAccessTime: { roomId, lastAccessMoment: Date.now() },
            },
          }
        );
        // END : ADDING NEW CHAT TO LAST_ACCESS_USER_TIME_MODEL

        res.status(200).json({ data: newONE2ONECHAT });
        // console.log(`94`, newONE2ONECHAT);
        return;
      }
      // console.log(data);
      res.status(200).json({ data });
    } catch (err: unknown) {
      console.error(`line 100`, err);
      const mssg = err instanceof Error ? err.message : "";
      res.status(500).json({ message: mssg });
    }
  }
);

// RESPONSIBLE FOR FETCHING ACTIVE CHATS
ChatRouter.get(
  "/activeChats",
  AuthorizedRoute,
  async (req, res): Promise<void> => {
    const userId = req.userId;
    try {
      // DOCUMENT SPECIFIC TO USER
      const activeChats = (await USER_CONVERSATION_MAPPER_MODEL.findOne({
        userId,
      })
        .populate("ONE2ONEchat")
        .populate("GROUPchat")
        .lean()) as USER_CONVERSATION_MAPPER_Interface;

      // FILTER documents with zero messages ~ only ONE2ONE
      const one2oneActiveChats_MESSAGESgreaterTHAN_0 =
        activeChats?.ONE2ONEchat.filter((ele) =>
          ele.messages ? ele.messages.length > 0 : false
        );

      // KEEP ONLY THOSE DATA FIELDS THAT ARE REQUIRED
      // without promise.all i will get array of pending promise
      // becoz map is sync it will store promise in pending state after initiating it
      // with promise.all i will get array of resolved promise
      // Promise<combinedCHat>[] -->  combinedCHat[]
      // worst case scenario : one2oneActiveChats_MESSAGESgreaterTHAN_0 ~ undefined
      const ONE2ONE_ONLYfieldsNEEDED = await Promise.all(
        one2oneActiveChats_MESSAGESgreaterTHAN_0?.map(async (ele) => {
          // userId of other participant in one2one Chat
          const userIdOfOtherParticipant = ele?.participants?.filter(
            (ele) => ele != userId
          );

          const otherUserData = await USER_model.findById(
            userIdOfOtherParticipant
          ).select("name profileURL");

          return {
            chatId: ele?._id || "",
            chatName: otherUserData?.name || "",
            roomId: ele.roomId,
            lastUpdated: ele.lastUpdated,
            profileURL: otherUserData?.profileURL || "",
          };
        }) ?? []
      );

      const GROUP_ONLYfieldsNEEDED = activeChats?.GROUPchat?.map(
        (ele): combinedActiveChat => ({
          chatId: ele?._id || "",
          chatName: ele?.groupName || "",
          roomId: ele.roomId,
          lastUpdated: ele.lastUpdated,
          profileURL: ele.profileURL,
        })
      );

      const on2oneArrayToCombine = Array.isArray(ONE2ONE_ONLYfieldsNEEDED)
        ? ONE2ONE_ONLYfieldsNEEDED
        : [];
      const groupArrayToCombine = Array.isArray(GROUP_ONLYfieldsNEEDED)
        ? GROUP_ONLYfieldsNEEDED
        : [];

      const combinedChats: combinedActiveChat[] = [
        ...on2oneArrayToCombine,
        ...groupArrayToCombine,
      ];

      combinedChats.sort((a, b): any => {
        const aDate: number = a?.lastUpdated || 0;
        const bDate: number = b?.lastUpdated || 0;
        return aDate - bDate;
      });

      res
        .status(200)
        .json({ message: "Active Messages Fetched", data: combinedChats });
    } catch (err) {
      const mssg =
        err instanceof Error
          ? "Error occured while fetching Active CHats" + err.message
          : "Error occured while fetching Active CHats";
      res.status(500).json({ message: mssg });
    }
  }
);

export default ChatRouter;

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
import { SendDeleteMessage } from "../utils/ExecutionerFn";

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
      let AllUsers = await USER_model.find().lean();
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
      // console.log(data);
      res.status(200).json({
        totalPages,
        totalDocuments,
        curPage,
        nextPage,
        hasMore,
        data: data.filter((ele) => ele._id != userId),
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
      const {
        participants,
        userIdOfClient,
        userIdOfOppositeUser,
        lastAccessMoment,
        messagesDeleted,
        messagesRecieved,
        PageNumber: page,
        chatId,
      } = req.body;

      const userId = req.userId as string;

      const limit = 25;
      const currPage = page;
      const nextPage = page + 1;

      let data: any;
      // fetching one 2 one chat checking if such a chat exists or not
      if (chatId) {
        data = await ONE_2_ONE_CHAT_model.findById(chatId).lean();
      } else {
        data = await ONE_2_ONE_CHAT_model.findOne({
          participants: participants.sort(),
        }).lean();
      }

      if (data) {
        // data does exist so it can be paginated
        const { roomId, _id: chatId, messages } = data;
        const total_messages =
          data.messages.length - (messagesRecieved - messagesDeleted);
        const total_pages = Math.ceil(total_messages / limit);
        const hasMore: boolean = total_pages > currPage;

        // RESPONSIBLE FOR MARKING LAST LOGIN TIME
        await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId, "lastAccessTime.roomId": roomId },
          { $set: { "lastAccessTime.$.lastAccessMoment": lastAccessMoment } },
          { new: true }
        );
        // START :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user
        objectOfUsers[userId].IsUserActiveInAnyChat = true;
        objectOfUsers[userId].ActiveChatRoomId = roomId;
        // END :RESPONSIBLE FOR MARKING ACTIVE ROOM for the user

        const startIndex =
          limit * (currPage - 1) + (messagesRecieved - messagesDeleted);
        const endIndex = startIndex + limit;

        const slicedMessages = messages.slice(startIndex, endIndex);

        console.log(`slicedMessages`, slicedMessages);
        console.log(`messaeges`, messages);
        console.log(`startIndex`, startIndex);
        console.log(`endIndex`, endIndex);

        // PAGINATED DATA HAS BEEN RETURNED BELOW
        res
          .status(200)
          .json({ data, messages: slicedMessages, hasMore, nextPage });
        return;
      }

      // if data does not exist, it means the ONE2ONE chat HAS YET TO CREATED ~ no need for pagination over here
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
        objectOfUsers[userId].IsUserActiveInAnyChat = true;
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

        // console.log(
        //   `object of user after creating doc with 0 messages`,
        //   objectOfUsers
        // );
        // console.log(
        //   `object of rooms after creating doc with 0 messages`,
        //   objectOfRooms
        // );
        // END : ADDED NEW ROOM CREATED TO OBJECT_OF_ROOMS

        // START : SETTING ACTIVE_ROOMId_of_user to this roomId , becuase on frontend this room will be active one for the moment
        objectOfUsers[userId].ActiveChatRoomId = roomId;
        // END : SETTING ACTIVE_ROOMId_of_user to this roomId , becuase on frontend this room will be active one for the moment

        // START : ADDING NEW roomId & lastAccessTime TO LAST_ACCESS_USER_TIME_MODEL
        // console.log(userIdOfClient, `USER_CHAT_LAST_ACCESS_TIME_model updated`);
        await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId: userIdOfClient },
          {
            $addToSet: {
              lastAccessTime: { roomId, lastAccessMoment: Date.now() },
            },
          }
        );
        // console.log(
        //   userIdOfOppositeUser,
        //   `USER_CHAT_LAST_ACCESS_TIME_model updated`
        // );
        await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId: userIdOfOppositeUser },
          {
            $addToSet: {
              lastAccessTime: { roomId, lastAccessMoment: 0 },
            },
          }
        );
        // END : ADDING NEW CHAT TO LAST_ACCESS_USER_TIME_MODEL

        res.status(200).json({
          data: newONE2ONECHAT,
          messages: [],
          hasMore: false,
          nextPage: 1,
        });
        return;
      }
    } catch (err: unknown) {
      console.error(`line 100`, err);
      const mssg = err instanceof Error ? err.message : "";
      res.status(500).json({ message: mssg });
    }
  }
);

// This Route will only be provided to those that have been reciently added and not been fetched from database
ChatRouter.delete(
  "/DeleteMessage",
  AuthorizedRoute,
  async (req, res): Promise<void> => {
    console.log(`DeleteMessage hit`);
    const { mssgId, chatId, roomId } = req.query;
    const userId = req.userId as string;
    try {
      if (!mssgId || !chatId) {
        res.status(404).json({ message: "failed to provide message id" });
        return;
      }

      const newData = await ONE_2_ONE_CHAT_model.findByIdAndUpdate(
        chatId,
        {
          $pull: {
            messages: { mssgId: mssgId },
          },
        },
        { new: true }
      );

      SendDeleteMessage({ mssgId, chatId, roomId });
      if (newData) {
        res.status(200).json({ message: "Successfully deleted" });
        return;
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete messages" });
    }
  }
);

//  RESPONSIBLE FOR FETCHING ACTIVE CHATS
ChatRouter.get(
  "/activeChats",
  AuthorizedRoute,
  async (req, res): Promise<void> => {
    // userId
    const userId = req.userId;

    try {
      // USER_CHAT_LAST_ACCESS_TIME_model DOCUMENT specific to user with only lastAccessTime dataField
      const lastAccessToAllRoomsDOC =
        await USER_CHAT_LAST_ACCESS_TIME_model.findOne({ userId })
          .select("lastAccessTime")
          .lean();

      // typescript necessity to check if lastAccessToAllRoomsDOC exists for us to use lastAccessTime dataField from it
      const lastAccessToAllRooms = lastAccessToAllRoomsDOC
        ? lastAccessToAllRoomsDOC.lastAccessTime
        : [];

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
      const ONE2ONE_ONLYfieldsNEEDED = await Promise.allSettled(
        one2oneActiveChats_MESSAGESgreaterTHAN_0?.map(async (ele) => {
          // userId of other participant in one2one Chat
          const userIdOfOtherParticipant = ele?.participants?.filter(
            (ele) => ele != userId
          );

          const otherUserData = await USER_model.findById(
            userIdOfOtherParticipant
          ).select("name profileURL _id");

          return {
            chatId: otherUserData?._id || "",
            chatName: otherUserData?.name || "",
            roomId: ele.roomId,
            lastUpdated: ele.lastUpdated,
            profileURL: otherUserData?.profileURL || "",
            lastMessageSender: ele?.lastMessageSender || "",
            lastMessageTime: ele?.lastMessageTime || "",
          };
        }) ?? []
      );

      // filtering to have only fullfilled
      const filteredONE2ONE_ONLYfieldsNEEDED = ONE2ONE_ONLYfieldsNEEDED.filter(
        (ele) => ele.status == "fulfilled"
      ).map((ele) => ele.value);

      const GROUP_ONLYfieldsNEEDED = activeChats?.GROUPchat?.map(
        (ele): any => ({
          chatId: ele?._id || "",
          chatName: ele?.groupName || "",
          roomId: ele.roomId,
          lastUpdated: ele.lastUpdated,
          profileURL: ele.profileURL,
          lastMessageSender: ele?.lastMessageSender || "",
          lastMessageTime: ele?.lastMessageTime || "",
        })
      );

      const on2oneArrayToCombine = Array.isArray(
        filteredONE2ONE_ONLYfieldsNEEDED
      )
        ? filteredONE2ONE_ONLYfieldsNEEDED
        : [];
      const groupArrayToCombine = Array.isArray(GROUP_ONLYfieldsNEEDED)
        ? GROUP_ONLYfieldsNEEDED
        : [];

      let combinedChats: combinedActiveChat[] = [
        ...on2oneArrayToCombine,
        ...groupArrayToCombine,
      ];

      combinedChats.map((ele) => {
        // lastAccessToAllRooms is document
        // lastAccessTime is array within that document which contains { roomId , lastAccessTime }

        const USER_LAST_ACCESS_TIME: {
          roomId: string;
          lastAccessMoment: number;
        }[] = lastAccessToAllRooms.filter((elem) => elem.roomId == ele.roomId);

        ele.USER_LAST_ACCESS_TIME = USER_LAST_ACCESS_TIME[0]
          ? USER_LAST_ACCESS_TIME[0].lastAccessMoment
          : Date.now();
        return ele;
      });

      if (combinedChats.length > 0) {
        combinedChats.sort((a, b): any => {
          const aDate: number = a?.lastUpdated || 0;
          const bDate: number = b?.lastUpdated || 0;
          return aDate - bDate;
        });
      }

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

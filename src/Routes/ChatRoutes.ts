import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
const cloudinary = require("cloudinary").v2;
import { WebSocket } from "ws";
import {
  ONE_2_ONE_CHAT_model,
  USER_model,
  USER_CONVERSATION_MAPPER_MODEL,
  USER_CHAT_LAST_ACCESS_TIME_model,
  GROUP_CHAT_model,
} from "../model/modelIndex";
const ChatRouter = Router();
import AuthorizedRoute from "../utils/AuthorizedRoute";
import { v4 as uuidv4 } from "uuid";
import { objectOfRooms, objectOfUsers } from "../api/index";
import {
  USER_CONVERSATION_MAPPER_Interface,
  combinedActiveChat,
  mssgInterface,
  objectOfRoomsInterface,
} from "../types";
import {
  SendDeleteMessage,
  SendMessageToAllActiveMembers,
} from "../utils/ExecutionerFn";
import multer from "multer";

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
// RESPONSIBLE FOR FETCHING ONE20NE conversation if exists & GROUP conversation fetching
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

      const limit = 100;
      const currPage = page;
      const nextPage = page + 1;

      let data: any;
      // fetching one 2 one chat checking if such a chat exists or not
      if (chatId) {
        console.log(`zone 1`);
        data = chatId.includes("PERSONAL")
          ? await ONE_2_ONE_CHAT_model.findById(chatId).lean()
          : await GROUP_CHAT_model.findById(chatId).lean();
      } else {
        console.log(`zone 2`, chatId, "<-- chatId");
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
      // not needeed for group chat
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

      if (chatId && typeof chatId == "string") {
        var newData = chatId.includes("PERSONAL")
          ? await ONE_2_ONE_CHAT_model.findByIdAndUpdate(
              chatId,
              {
                $pull: {
                  messages: { mssgId: mssgId },
                },
              },
              { new: true }
            )
          : await GROUP_CHAT_model.findByIdAndUpdate(
              chatId,
              {
                $pull: {
                  messages: { mssgId: mssgId },
                },
              },
              { new: true }
            );
      } else {
        res.status(404).json({ message: "Failed to delete" });
        return;
      }

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
            admin: "",
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
          admin: ele.admin,
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

      // to put last access time of each user to the the active chats
      let combinedChats: combinedActiveChat[] = [
        ...on2oneArrayToCombine,
        ...groupArrayToCombine,
      ];

      combinedChats = combinedChats.map((ele) => {
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

const upload = multer({
  storage: multer.diskStorage({}),
  //   limiting size of each file , not array of files
  limits: {
    fileSize: 4.2 * 1024 * 1024,
  },
});

// RESPONSIBLE FOR CREATING GROUP CHAT
// INPUT : CHAT_NAME , CHAT_IMAGE (IF NOT GIVEN USE DEFAULT ONE), PARTICIPANTS , FIRST MESSAGE
ChatRouter.post(
  "/createGroup",
  AuthorizedRoute,
  upload.single("groupChatImage"),
  async (req, res) => {
    try {
      const groupPhoto = req.file;
      const userId = req.userId;
      // uploaded photo
      if (groupPhoto) {
        var uploaded = await cloudinary.uploader.upload(groupPhoto.path, {
          resource_type: "auto",
        });
      }
      //  extract other info
      const {
        groupName,
        participants: par,
        firstMessage,
        senderName,
      } = req.body;
      const participants = JSON.parse(par);
      const chatId = `GROUP-${uuidv4()}`;
      const roomId = uuidv4();
      const messageObject: mssgInterface = {
        type: "text",
        payload: firstMessage,
        mssgId: uuidv4(),
        uploadTime: Date.now(),
        senderName,
        senderId: userId,
      };
      // START : GROUP MAKING
      const groupDOCtoBeMade = new GROUP_CHAT_model({
        _id: chatId,
        groupName,
        participants,
        messages: [messageObject],
        roomId,
        profileURL: uploaded.secure_url,
        lastUpdated: Date.now(),
        lastMessageSender: userId,
        lastMessageTime: Date.now(),
        admin: userId,
      });
      const groupDOCSaved = await groupDOCtoBeMade.save();
      // STOP : GROUP MAKING

      // START : UPDATING ALL PARTICIPANTS USER_CONVERSATION_MAPPER
      const all_promises1 = await Promise.allSettled(
        participants.map(async (ele: string) => {
          const result = await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
            { userId: ele },
            {
              $addToSet: {
                GROUPchat: chatId,
              },
            },
            {
              new: true,
            }
          );
          return result;
        })
      );
      // END : UPDATING ALL PARTICIPANTS USER_CONVERSATION_MAPPER

      // START : UPDATING ALL PARTICIPANTS USER_CHAT_LAST_ACCESS_TIME_model
      const all_promises2 = await Promise.allSettled(
        participants.map(async (ele: string) => {
          const result =
            await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
              { userId: ele },
              {
                $addToSet: {
                  lastAccessTime: { roomId, lastAccessMoment: 0 },
                },
              }
            );
          return result;
        })
      );
      // END : UPDATING ALL PARTICIPANTS USER_CHAT_LAST_ACCESS_TIME_model

      // START : UPDATING objectOfRoomsInterface FOR  all active user's on platform who are part of group
      participants.forEach((ele) => {
        // ele ~ userId
        if (objectOfUsers[ele]) {
          if (objectOfRooms[roomId]) {
            objectOfRooms[roomId] = [
              ...objectOfRooms[roomId],
              {
                userId: ele,
                WebSocketInstance: objectOfUsers[ele].socket,
              },
            ];
          } else {
            objectOfRooms[roomId] = [
              {
                userId: ele,
                WebSocketInstance: objectOfUsers[ele].socket,
              },
            ];
          }
        }
      });
      console.log(`roomId ObjectOfRooms`, objectOfRooms);
      // END : UPDATING objectOfRoomsInterface FOR  all active user's on platform who are part of group

      // send a message to all active user's about this group
      SendMessageToAllActiveMembers([messageObject], roomId, userId, chatId);
      res.status(200).json({ message: "group success created" });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : "Failed to create group",
      });
    }
  }
);

// RESPONSIBLE FOR UPDATING GROUP CHAT
ChatRouter.post(
  "/updateGroup",
  AuthorizedRoute,
  upload.single("image"),
  async (req, res) => {
    try {
      const image: any = req.file;
      const userId = req.userId;
      console.log(`image file -->`, image);
      var updatedData: any;
      // updateImage ~ true if update has been made if no update has been made then it will be false
      // participants ~ if participants is [] meaning no need for change , if participant is not empty means updation is needed
      const {
        updateImage,
        participants: par,
        groupName,
        chatId,
        roomId,
      } = req.body;
      const participants = Array.from(JSON.parse(par));
      const IsImageProvidedForUpdate = Boolean(JSON.parse(updateImage));
      console.log(
        `IsImageProvidedForUpdate`,
        IsImageProvidedForUpdate,
        typeof IsImageProvidedForUpdate
      );
      console.log(`participants`, participants, participants instanceof Array);
      console.log(`groupName`, groupName);
      console.log(`chatId`, chatId);
      console.log(`roomId`, roomId);

      const groupDOC = await GROUP_CHAT_model.findById(chatId).lean();

      // new image secure_url
      console.log(
        `IsImageProvidedForUpdate == true`,
        IsImageProvidedForUpdate == true
      );
      console.log(`image != null`, image != null);
      console.log(` image != undefined`, image != undefined);
      if (
        IsImageProvidedForUpdate == true &&
        image != null &&
        image != undefined
      ) {
        var uploaded = await cloudinary.uploader.upload(image.path, {
          resource_type: "auto",
        });
        console.log(`console has reached inside the image upload block`);
        console.log(uploaded);
      }

      // UPDATING GROUP NAME SUCCESSFULLY DONE
      if (
        IsImageProvidedForUpdate == false &&
        groupDOC &&
        groupDOC.groupName != groupName
      ) {
        console.log(`inside 652 ----------------->@@@@@@@@@`);
        updatedData = await GROUP_CHAT_model.findByIdAndUpdate(
          chatId,
          {
            $set: {
              groupName,
            },
          },
          { new: true }
        );
      }

      // UPDATE GROUP PROFILE IMAGE
      // UPDATE GROUP NAME
      if (IsImageProvidedForUpdate == true) {
        updatedData = await GROUP_CHAT_model.findByIdAndUpdate(
          chatId,
          {
            $set: {
              profileURL: uploaded.secure_url,
              groupName,
            },
          },
          { new: true }
        );
      }
      // update participants
      if (participants.length > 0) {
        updatedData = await GROUP_CHAT_model.findByIdAndUpdate(
          chatId,
          {
            $set: {
              participants,
              groupName,
            },
          },
          { new: true }
        );
        // updating USER_Mapper_Conversation
        // find out users which are not part of new participant list ~ removed from group

        // groupDOC?.participants? ==> a , b , c , d ==> all participants including admin / creator of group
        //           participants  ==> b , d ==> new members +  old members
        console.log(`admin`, userId);
        console.log(`groupDOC?.participants`, groupDOC?.participants);
        console.log(`participansts`, participants);
        // REMOVED USER'S IS WORKING CORRECTLY
        const removedUsers: string[] | null | undefined =
          groupDOC?.participants?.filter((ele) => {
            const userIndex = participants.findIndex((elem) => elem == ele);
            if (userIndex == -1) {
              // if -1 remove that specific elem
              return true;
            }
            // if not -1 , don't remove that specific elem
            return false;
          });
        console.log(`removed Users  ==>`, removedUsers);

        const addedUser: string[] | null | undefined = (
          participants as string[]
        ).filter((ele) => {
          // participants has new users + old members
          // remove old members ~ HOW , if userIndex != -1 , means it exists return true to filter it
          const userIndex = groupDOC?.participants?.findIndex(
            (elem) => elem == ele
          );
          console.log(`ele`, ele);
          console.log(`userIndex`, userIndex);
          if (userIndex == -1) {
            return true;
          } else {
            return false;
          }
        });
        console.log(`addedUser Users ==>`, addedUser);

        if (removedUsers && removedUsers.length > 0) {
          // removing groupId from GROUPchat dataField :  USER_CONVERSATION_MAPPER_MODEL document of user's who have been removed
          const ans = await Promise.allSettled(
            removedUsers?.map(async (ele) => {
              await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
                { userId: ele },
                {
                  $pull: {
                    GROUPchat: chatId,
                  },
                }
              );
            })
          );
          console.log(
            `UPDATED USER_CONVERSATION_MAPPER_MODEL FOR REMOVED USER`,
            ans
          );

          // sending message to all removed users who all are active on the application to remove group chat
          removedUsers.forEach((ele) => {
            if (objectOfUsers[ele]) {
              const { socket } = objectOfUsers[ele];
              socket.send(
                JSON.stringify({
                  type: "REMOVE/GROUP/CHAT",
                  payload: {
                    roomId,
                    chatId,
                  },
                })
              );
            }
          });

          // START : PULLING ROOMiD FROM USER_CHAT_LAST_ACCESS_TIME_MODEL DOCUMENT OF USERS WHO HAVE BEEN REMOVED
          await Promise.allSettled(
            removedUsers.map(async (ele: string) => {
              const result =
                await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
                  { userId: ele },
                  {
                    $pull: {
                      lastAccessTime: { roomId },
                    },
                  }
                );
              return result;
            })
          );
          // END : PULLING ROOMiD FROM USER_CHAT_LAST_ACCESS_TIME_MODEL DOCUMENT OF USERS WHO HAVE BEEN REMOVED
        }

        if (addedUser && addedUser.length > 0) {
          // adding groupId to GROUPchat dataField :  USER_CONVERSATION_MAPPER_MODEL document of user's who have been added
          await Promise.allSettled(
            addedUser?.map(async (ele) => {
              await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
                { userId: ele },
                {
                  $addToSet: {
                    GROUPchat: chatId,
                  },
                }
              );
            })
          );

          // sending message to all added users who are active on the application to add a new group to
          addedUser.forEach((ele) => {
            if (objectOfUsers[ele]) {
              const { socket } = objectOfUsers[ele];
              socket.send(
                JSON.stringify({
                  type: "ADD/GROUP/CHAT",
                  payload: {
                    roomId,
                    chatId,
                    chatName: updatedData?.groupName,
                    lastUpdated: updatedData.lastUpdated,
                    profileURL: updatedData?.profileURL,
                    lastMessageSender: updatedData.lastMessageSender,
                    lastMessageTime: updatedData.lastMessageTime,
                    USER_LAST_ACCESS_TIME: 0,
                    admin: userId,
                  },
                })
              );
            }
          });

          // START : ADDING ROOMID & LASTACCESSMOMENT TO USER_CHAT_LAST_ACCESS_TIME_model document of all the added user's
          await Promise.allSettled(
            addedUser.map(async (ele: string) => {
              const result =
                await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
                  { userId: ele },
                  {
                    $addToSet: {
                      lastAccessTime: { roomId, lastAccessMoment: 0 },
                    },
                  }
                );
              return result;
            })
          );
          // END : ADDING ROOMID & LASTACCESSMOMENT TO USER_CHAT_LAST_ACCESS_TIME_model document of all the added user's
        }

        // sending delete message to remove group from ui ~ done
        // sending add message to add group to ui ~ done
        // updating objectOfRoom ~

        // Since we have added members to group chat and removed members from  group chat
        // We also have to update objectOfRooms[roomId] ~ for that specific room

        // temp to carry the array we will replace objectOfRoom[roomid] with
        var temp: {
          userId: string;
          WebSocketInstance: WebSocket;
        }[] = [];

        (participants as string[]).forEach((ele) => {
          if (objectOfUsers[ele]) {
            temp.push({
              userId: ele,
              WebSocketInstance: objectOfUsers[ele].socket,
            });
          }
        });
        console.log(`---------------------------->`);
        console.log(`old objectOfRooms[roomId]`, objectOfRooms[roomId]);
        objectOfRooms[roomId] = temp;
        console.log(`NEW objectOfRooms[roomId]`, objectOfRooms[roomId]);
        console.log(`---------------------------->`);
      }
      // res.status(200).json({});
      res.status(200).json({
        message: "Successfully Changed",
        participants,
        groupName,
        chatId,
      });
      return;
    } catch (err) {
      res.status(500).json({
        message:
          err instanceof Error ? err.message : "Error in update group editt",
      });
    }
  }
);

// RESPONSIBLE FOR FETCHING FRIENDS
ChatRouter.get(
  "/friends",
  AuthorizedRoute,
  async (req: Request<{}, {}, {}, {}>, res: Response): Promise<void> => {
    const userId = req.userId;
    try {
      let AllUsers = await USER_model.find({ _id: { $nin: [userId] } }).lean();
      res.status(200).json({
        data: AllUsers,
      });
    } catch (err: unknown) {
      res.status(500).json({ message: "Server Error : fetching contacts" });
    }
  }
);

// RESPONSIBLE FOR FETCHING GROUP MEMBERS
ChatRouter.get("/fetchGroupMembers", AuthorizedRoute, async (req, res) => {
  try {
    const { chatId } = req.query;
    const userId = req.userId;
    const data = await GROUP_CHAT_model.findById(chatId)
      .select("participants")
      .lean();
    var allSettledData: any = [];
    var count = 0;

    let defaultValuesForSelect = [];
    // console.log(`###################$$$$$$$$$$%%%%%%%%%%%%`);
    if (data && data.participants && Array.isArray(data.participants)) {
      allSettledData = await Promise.allSettled(
        data.participants.map(async (ele) => {
          console.log(`line 846 -->`, ele);
          const result = await USER_model.findById(ele).select("name");
          return result;
        })
      );
    }
    // console.log(`854`, allSettledData);

    defaultValuesForSelect = allSettledData
      .filter((ele: { status: string }) => ele.status == "fulfilled")
      .map((ele: { status: string; value: { _id: string; name: string } }) => ({
        value: ele.value._id,
        label: ele.value.name,
      }))
      .filter((ele) => ele.value != userId);

    // console.log(`defaultValuesForSelect`, defaultValuesForSelect);
    // console.log(`count`, count);

    if (
      data &&
      data.participants &&
      defaultValuesForSelect.length + 1 != data.participants.length
    ) {
      res.status(400).json({
        message: "failed to fetch group members & defaultValuesForSelect",
      });
      return;
    }

    // console.log(`882`, data);
    // console.log(`883`, defaultValuesForSelect);
    res.status(200).json({
      message: "fetched successfully",
      data: data ? data.participants.filter((ele) => ele != userId) : [],
      defaultValuesForSelect,
    });
    return;
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch group group members" });
  }
});

ChatRouter.delete("/deleteGroup", AuthorizedRoute, async (req, res) => {
  try {
    const { chatId: a, roomId: b } = req.query;
    const chatId: string = a?.toString() as string;
    const roomId: string = b?.toString() as string;
    const groupDOC = await GROUP_CHAT_model.findById(chatId)
      .select("participants")
      .lean();
    const participants = groupDOC ? groupDOC.participants : [];

    // updating USER_CONVERSATION_MAPPER_MODEL
    await Promise.allSettled(
      participants.map(async (ele) => {
        const res = await USER_CONVERSATION_MAPPER_MODEL.findOneAndUpdate(
          { userId: ele },
          {
            $pull: {
              GROUPchat: chatId,
            },
          },
          { new: true }
        );
        return res;
      })
    );

    // updating USER_CHAT_LAST_ACCESS_TIME_model
    await Promise.allSettled(
      participants.map(async (ele) => {
        const res = await USER_CHAT_LAST_ACCESS_TIME_model.findOneAndUpdate(
          { userId: ele },
          {
            $pull: {
              lastAccessTime: { roomId },
            },
          },
          { new: true }
        );
        return res;
      })
    );

    // deleting GROUP_CHAT_model
    await GROUP_CHAT_model.findByIdAndDelete(chatId);

    // sending websocket delete message to all user's who are online at the moment;
    for (const ele of participants) {
      if (objectOfUsers[ele]) {
        objectOfUsers[ele].socket.send(
          JSON.stringify({
            type: "DELETE/GROUP/CHAT",
            payload: {
              roomId,
              chatId,
            },
          })
        );
      }
    }

    // deleting key:roomId fromm objectOfRooms
    delete objectOfRooms[roomId];

    res.status(200).json({ message: "successfully deleted" });
  } catch (err) {
    res.status(500).json({
      message:
        err instanceof Error ? err.message : "Error occured in deleteGroup",
    });
  }
});

export default ChatRouter;

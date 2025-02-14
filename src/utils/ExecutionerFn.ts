import { WebSocket } from "ws";
import {
  GROUP_CHAT_model,
  ONE_2_ONE_CHAT_model,
  USER_CONVERSATION_MAPPER_MODEL,
  USER_model,
} from "../model/modelIndex";
import { objectOfRooms, objectOfUsers } from "../api/index";
import { USER_CONVERSATION_MAPPER_Interface, mssgInterface } from "../types";
import { forEachChild } from "typescript";

export const UpdateobjectOfRoomsLogin = async (userId, socket) => {
  try {
    const userFetched = (await USER_CONVERSATION_MAPPER_MODEL.findOne({
      userId,
    })
      .populate("ONE2ONEchat", "roomId")
      .populate("GROUPchat", "roomId")
      .lean()) as USER_CONVERSATION_MAPPER_Interface;

    userFetched?.ONE2ONEchat?.map((obj) => {
      // retrieving value from objectOfRooms for key= roomId
      let value = objectOfRooms[obj?.roomId];
      if (!value) {
        // if value is falsy value , means there was no key with that roomId
        objectOfRooms[obj?.roomId] = [
          { userId: userId, WebSocketInstance: socket },
        ];
      } else {
        // if value is truthy value , means there was key with this roomId
        objectOfRooms[obj?.roomId].push({
          userId: userId,
          WebSocketInstance: socket,
        });
      }
    });

    userFetched?.GROUPchat?.map((obj) => {
      // retrieving value from objectOfRooms for key= roomId
      let value = objectOfRooms[obj?.roomId];
      if (!value) {
        // if value is falsy value , means there was no key with that roomId
        objectOfRooms[obj?.roomId] = [
          { userId: userId, WebSocketInstance: socket },
        ];
      } else {
        // if value is truthy value , means there was key with this roomId
        objectOfRooms[obj?.roomId].push({
          userId: userId,
          WebSocketInstance: socket,
        });
      }
    });

    // console.log(`objectOfRooms at login ==>`, objectOfRooms);
  } catch (err: unknown) {
    console.error(
      `Error occured in UpdateobjectOfRoomsLogin , Reason : ${
        err instanceof Error ? err.message : "CHECKING USING CONSOLE.LOG"
      }`
    );
  }
};

export const UpdateobjectOfRoomsLogout = async (userId) => {
  try {
    const userFetched = (await USER_CONVERSATION_MAPPER_MODEL.findOne({
      userId,
    })
      .populate("ONE2ONEchat", "roomId")
      .populate("GROUPchat", "roomId")) as USER_CONVERSATION_MAPPER_Interface;

    userFetched?.ONE2ONEchat?.map((obj) => {
      // At login we made sure roomId present inside of obj variable on line 67 become key in function UpdateobjectOfRoomsLogin

      const arrToFilter = [...objectOfRooms[obj?.roomId]];
      // we are assigning new arr to objectOfRooms
      objectOfRooms[obj?.roomId] = [
        ...arrToFilter.filter((ele) => ele.userId != userId),
      ];
    });

    userFetched?.GROUPchat?.map((obj) => {
      // At login we made sure roomId present inside of obj variable on line 77 become key in function UpdateobjectOfRoomsLogin

      const arrToFilter = [...objectOfRooms[obj?.roomId]];
      // we are assigning new arr to objectOfRooms
      objectOfRooms[obj?.roomId] = [
        ...arrToFilter.filter((ele) => ele.userId != userId),
      ];
    });

    // console.log(`objectOfRooms at logout ==>`, objectOfRooms);
  } catch (err: unknown) {
    console.error(
      `Error occured in UpdateobjectOfRoomsLogout , Reason : ${
        err instanceof Error ? err.message : "CHECKING USING CONSOLE.LOG"
      }`
    );
  }
};

export const SendMessageToAllActiveMembers = async (
  mssgDOC: mssgInterface[],
  roomId: string,
  userIdOfSender: string,
  chatId: string
) => {
  // chatDocument could be either one among them , that being : PERSONAL , GROUP
  const chatDocument: any = chatId.includes("PERSONAL")
    ? await ONE_2_ONE_CHAT_model.findById(chatId).lean()
    : await GROUP_CHAT_model.findById(chatId).lean();
  // console.log(
  //   `mssgDOC:${mssgDOC} , roomId:${roomId} , userIdOfSender : ${userIdOfSender} , chatId:${chatId}`
  // );
  const senderUserDocument = await USER_model.findById(userIdOfSender).lean();
  // console.log(` 1 ⚠️ senderUserDocument`, senderUserDocument);
  const messageArrLength = chatDocument ? chatDocument.messages.length : 0;
  // All the user's who are active on the application and are part of the room ( its does not mean they are active in the room )
  const arrayOfUsersActiveonApplication = objectOfRooms[roomId];

  /*
  ⚠️ The below condition is only true when 
  1. when you click on contact_tab a ONE_2_ONE doc get created with empty chat , same wont happen when you are creating a group , the purpose field of the the group will gets registered as first message to all participants
  2. So when getting active chats for active chat tab , only those docs are extracted where in messages.length > 0 , but docs with messages.length = 0  are still part of USER_conversation_mapper
  3. the below condition will add the document with empty message to client side active history chats why so ?
     a. we are adding message to document messages array , so it wont be empty anymore
     b. if it is not empty anymore , we should make sure it is part of active message tab in frontend
     c. ONLY WHEN OPPOSITE USER IS ACTIVE ( only meant for ONE_2_ONE)
  */
  if (chatDocument && messageArrLength == 1 && chatId.includes("PERSONAL")) {
    const otherParticipant: { userId: string; WebSocketInstance: WebSocket } =
      arrayOfUsersActiveonApplication.filter(
        (participant) => participant.userId != userIdOfSender
      )[0];

    // if the below condidition is true it implies
    // otherParticipant is indeed active on the application
    // console.log(`line 137`, otherParticipant);
    if (otherParticipant) {
      // IF the other particant is indeed active on the applation , so now just push it to active chat
      // the below forloop will take care of wheather to send an alert or direct message
      const otherApplicantData = await USER_model.findById(
        otherParticipant.userId
      ).lean();
      // console.log(` 2 ⚠️ senderUserDocument`, senderUserDocument);
      otherParticipant.WebSocketInstance.send(
        JSON.stringify({
          type: "ACTIVE/CHAT/ACTIVATION",
          payload: {
            chatId: userIdOfSender,
            chatName: senderUserDocument?.name,
            roomId: chatDocument.roomId,
            lastUpdated: chatDocument.lastUpdated,
            profileURL: senderUserDocument?.profileURL,
            lastMessageSender: chatDocument.lastMessageSender,
            lastMessageTime: chatDocument.lastMessageTime,
            USER_LAST_ACCESS_TIME: 0,
            // why 0 beacuse user has yet to visit it
          },
        })
      );
    }
  }

  // sending group activation message to all active user's
  if (chatDocument && messageArrLength == 1 && chatId.includes("GROUP")) {
    // step 1 : List of Users part of
    if (arrayOfUsersActiveonApplication.length > 0) {
      arrayOfUsersActiveonApplication.forEach((ele) => {
        const { userId, WebSocketInstance } = ele;
        WebSocketInstance.send(
          JSON.stringify({
            type: "ACTIVE/CHAT/ACTIVATION",
            payload: {
              chatId,
              chatName: chatDocument.groupName,
              roomId,
              lastUpdated: chatDocument.lastUpdated,
              profileURL: chatDocument?.profileURL,
              lastMessageSender: chatDocument.lastMessageSender,
              lastMessageTime: chatDocument.lastMessageTime,
              USER_LAST_ACCESS_TIME: 0,
              admin: userIdOfSender,
              // why 0 beacuse user has yet to visit it
            },
          })
        );
      });
    }
  }

  // SEND MESSAGE TO ALL ACTIVE USERS
  arrayOfUsersActiveonApplication.forEach((userActiveOnApplication) => {
    // console.log(`line 154`, userActiveOnApplication);
    // userId & WebSocketInstance of user active on application
    const { userId, WebSocketInstance } = userActiveOnApplication;
    // checking if user who is active on application , is he active in same chat room
    const isUserActiveInRoomChat = objectOfUsers[userId].IsUserActiveInAnyChat
      ? roomId == objectOfUsers[userId].ActiveChatRoomId
      : false;

    // console.log(`162 objectOfUsers`, objectOfUsers);
    // console.log(`162`, objectOfUsers[userId].IsUserActiveInAnyChat); // expected : true
    // console.log(`163`, roomId == objectOfUsers[userId].ActiveChatRoomId); // expected : true
    // console.log(`164`, isUserActiveInRoomChat); // true
    // if user is active in chatroom send her message
    if (isUserActiveInRoomChat) {
      // console.log(`line 159`);
      // console.log(` WebSocketInstance ====>`, WebSocketInstance);
      console.log(`----------------------------------------------------------`);
      console.log(` ⚠️ message has been sent ====>`, mssgDOC);
      WebSocketInstance.send(
        JSON.stringify({
          type: "RECEIVE/MESSAGE",
          payload: {
            mssgData: mssgDOC,
            roomId: roomId,
          },
        })
      );
    } else {
      // if user is not active in chatroom send her alert
      // ON FRONTEND CHECK ON WHICH TAB TO INCREASE ALERT COUNT USING ROOMID PROVIDED IN PAYLOAD
      console.log(`line 172 sending  Message/ALERT`);
      WebSocketInstance.send(
        JSON.stringify({
          type: "Message/ALERT",
          payload: {
            roomId: roomId,
            lastUpdated: chatDocument?.lastUpdated,
            lastMessageSender: chatDocument?.lastMessageSender,
            lastMessageTime: chatDocument?.lastMessageTime,
          },
        })
      );
    }
  });
};

export const SendDeleteMessage = async ({ mssgId, chatId, roomId }) => {
  const arrOfPeopleActiveInRoom = objectOfRooms[roomId];
  arrOfPeopleActiveInRoom.forEach((ele) => {
    const { WebSocketInstance } = ele;
    WebSocketInstance.send(
      JSON.stringify({
        type: "DELETE/MESSAGE",
        payload: {
          mssgId,
          chatId,
        },
      })
    );
  });
};

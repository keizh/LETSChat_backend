import USER_CONVERSATION_MAPPER_MODEL from "../model/USER_CONVERSATION_MAPPER_model";
import { objectOfRooms } from "../api/index";
import { USER_CONVERSATION_MAPPER_Interface } from "../types";

export const UpdateobjectOfRoomsLogin = async (userId, socket) => {
  try {
    const userFetched = (await USER_CONVERSATION_MAPPER_MODEL.findOne({
      userId,
    })
      .populate("ONE2ONEchat", "roomId")
      .populate("GROUPchat", "roomId")
      .lean()) as USER_CONVERSATION_MAPPER_Interface;

    userFetched?.ONE2ONEchat.map((obj) => {
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

    userFetched?.GROUPchat.map((obj) => {
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

    console.log(`objectOfRooms at login ==>`, objectOfRooms);
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

    userFetched?.ONE2ONEchat.map((obj) => {
      // At login we made sure roomId present inside of obj variable on line 67 become key in function UpdateobjectOfRoomsLogin

      const arrToFilter = [...objectOfRooms[obj?.roomId]];
      // we are assigning new arr to objectOfRooms
      objectOfRooms[obj?.roomId] = [
        ...arrToFilter.filter((ele) => ele.userId != userId),
      ];
    });

    userFetched?.GROUPchat.map((obj) => {
      // At login we made sure roomId present inside of obj variable on line 77 become key in function UpdateobjectOfRoomsLogin

      const arrToFilter = [...objectOfRooms[obj?.roomId]];
      // we are assigning new arr to objectOfRooms
      objectOfRooms[obj?.roomId] = [
        ...arrToFilter.filter((ele) => ele.userId != userId),
      ];
    });

    console.log(`objectOfRooms at logout ==>`, objectOfRooms);
  } catch (err: unknown) {
    console.error(
      `Error occured in UpdateobjectOfRoomsLogout , Reason : ${
        err instanceof Error ? err.message : "CHECKING USING CONSOLE.LOG"
      }`
    );
  }
};

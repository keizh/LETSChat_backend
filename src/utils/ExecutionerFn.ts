import mongoose from "mongoose";
import USER_CONVERSATION_MAPPER_MODEL from "../model/USER_CONVERSATION_MAPPER_model";
import { objectOfUsers, objectOfRooms } from "../api/index";

export const UpdateobjectOfRoomsLogin = async (userId) => {
  try {
    const userFetched = await USER_CONVERSATION_MAPPER_MODEL.findOne({
      userId,
    })
      .populate("ONE2ONEchat", "roomId")
      .populate("GROUPchat", "roomId");

    // userFetched?.ONE2ONEchat?.forEach((obj) => {
    //   if (objectOfRooms[obj?.roomId ?? "random"]) {
    //   }

    // UPDATE THE OBJECT HERE

    console.log(`UpdateobjectOfRoomsLogin -->`, userFetched);
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
    const userFetched = await USER_CONVERSATION_MAPPER_MODEL.findOne({
      userId,
    })
      .populate("ONE2ONEchat", "roomId")
      .populate("GROUPchat", "roomId");

    // userFetched?.ONE2ONEchat?.forEach((obj) => {
    //   if (objectOfRooms[obj?.roomId ?? "random"]) {
    //   }

    // UPDATE THE OBJECT HERE

    console.log(`UpdateobjectOfRoomsLogout -->`, userFetched);
  } catch (err: unknown) {
    console.error(
      `Error occured in UpdateobjectOfRoomsLogout , Reason : ${
        err instanceof Error ? err.message : "CHECKING USING CONSOLE.LOG"
      }`
    );
  }
};

import { WebSocket } from "ws";
import ONE_2_ONE_CHAT_model from "./model/ONE_2_ONE_CHAT_model";

export interface objectOfUsersInterface {
  [userId: string]: {
    IsUserActiveInAnyChat: boolean;
    ActiveChatRoomId: null | string;
    socket: WebSocket;
  };
}

export interface objectOfRoomsInterface {
  [roomId: string]: {
    userId: string;
    WebSocketInstance: WebSocket;
  }[];
}

interface ONE2ONE_Interface {
  roomId: string;
}

interface GROUP_Interface {
  roomId: string;
}

export interface USER_CONVERSATION_MAPPER_Int {
  userId: string;
  ONE2ONEchat: ONE2ONE_Interface[] | [];
  GROUPchat: GROUP_Interface[] | [];
}

export type USER_CONVERSATION_MAPPER_Interface =
  USER_CONVERSATION_MAPPER_Int | null;

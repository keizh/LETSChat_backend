import { WebSocket } from "ws";
import ONE_2_ONE_CHAT_model from "./model/ONE_2_ONE_CHAT_model";
import { Document, HydratedDocument } from "mongoose";

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

export interface mssgInterface {
  type: "text" | "image" | "audio" | "video" | "pdf";
  payload: string;
  mssgId: string;
  uploadTime: number;
  senderId: string;
  senderName: string;
}

interface ONE2ONE_Interface {
  _id: string;
  roomId: string;
  participants: string[];
  messages: mssgInterface[];
  lastUpdated: number;
  lastMessageSender: String;
  lastMessageTime: number;
}
interface GROUP_Interface {
  _id: string;
  roomId: string;
  participants: string[];
  messages: mssgInterface[];
  groupName: string;
  profileURL: string;
  lastUpdated: number;
  lastMessageSender: String;
  lastMessageTime: number;
}

export interface USER_CONVERSATION_MAPPER_Int {
  userId: string;
  ONE2ONEchat: ONE2ONE_Interface[] | [];
  GROUPchat: GROUP_Interface[] | [];
}

export type USER_CONVERSATION_MAPPER_Interface =
  USER_CONVERSATION_MAPPER_Int | null;

export interface USER_CHAT_LAST_ACCESS_TIME_INTERFACE {
  userId: string;
  lastAccessTime: { roomId: string; lastAccessMoment: number }[];
}

export interface combinedActiveChat {
  // in case of personal chat chatId is opposite user's userId
  // in case of group chat chatId is id of chat document
  chatId: string;
  chatName: string;
  roomId: string;
  lastUpdated: number;
  profileURL: string;
  lastMessageSender: string;
  lastMessageTime: number;
  USER_LAST_ACCESS_TIME?: number;
  admin: string;
}

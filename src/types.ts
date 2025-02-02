import { WebSocket } from "ws";

export interface objectOfUsersInterface {
  [userId: string]: {
    IsUserActiveInAnyChat: boolean;
    ActiveChatRoomId: null | string;
  };
}

export interface objectOfRoomsInterface {
  [roomId: string]: [
    {
      userId: string;
      WebSocketInstance: WebSocket;
    }
  ];
}

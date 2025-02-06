import mongoose from "mongoose";

const GROUP_CHAT = new mongoose.Schema(
  {
    // chatID ~ _id - "GROUP-UUID"
    _id: {
      type: String,
      required: true,
      unique: true,
    },
    groupName: {
      type: String,
      required: true,
      unique: true,
    },
    participants: [
      {
        type: String,
        ref: "USER",
      },
    ],
    messages: [
      {
        type: {
          type: String,
          enum: ["text", "image", "audio", "video", "pdf"],
        },
        payload: {
          type: String,
          required: true,
        },
        mssgId: {
          type: String,
          required: true,
        },
        uploadTime: {
          type: Number,
          default: Date.now,
        },
      },
    ],
    roomId: {
      required: true,
      type: String,
    },
    profileURL: {
      type: String,
      default:
        "https://images.stockcake.com/public/5/d/9/5d96090c-be82-4b6e-b8a7-9945b06fc214_large/joyful-friends-together-stockcake.jpg",
    },
    lastUpdated: Number,
    lastMessageSender: String,
    lastMessageTime: Number,
  },
  { timestamps: true, _id: false }
);

GROUP_CHAT.index(
  { "messages.mssgId": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "messages.mssgId": { $exists: true },
    },
  }
);

const GROUP_CHAT_model = mongoose.model("GROUP_CHAT", GROUP_CHAT);

export default GROUP_CHAT_model;

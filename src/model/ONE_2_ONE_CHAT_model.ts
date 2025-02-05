import mongoose from "mongoose";

const ONE_2_ONE_CHAT_Schema = new mongoose.Schema(
  {
    // chatID - "PERSONAL-UUID"
    _id: {
      type: String,
      required: true,
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
        senderId: String,
        senderName: String,
      },
    ],
    roomId: {
      required: true,
      type: String,
    },
    lastUpdated: Number,
  },
  { timestamps: true, _id: false }
);

ONE_2_ONE_CHAT_Schema.index(
  {
    "messages.mssgId": 1,
  },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "messages.mssgId": { $exists: true },
    },
  }
);

const ONE_2_ONE_CHAT_model = mongoose.model(
  "ONE_2_ONE_CHAT",
  ONE_2_ONE_CHAT_Schema
);

export default ONE_2_ONE_CHAT_model;

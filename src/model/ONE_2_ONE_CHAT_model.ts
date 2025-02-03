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
        },
        mssgId: {
          type: String,
        },
        uploadTime: {
          type: String,
        },
      },
    ],
    roomId: {
      required: true,
      type: String,
    },
  },
  { timestamps: true, _id: false }
);

const ONE_2_ONE_CHAT_model = mongoose.model(
  "ONE_2_ONE_CHAT",
  ONE_2_ONE_CHAT_Schema
);

export default ONE_2_ONE_CHAT_model;

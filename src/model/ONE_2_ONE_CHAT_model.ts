import mongoose from "mongoose";

const ONE_2_ONE_CHAT = new mongoose.Schema(
  {
    // chatID - "PERSONAL-UUID"
    _id: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
          index: true,
          unique: true,
        },
        uploadTime: {
          type: String,
          default: Date.now,
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

const ONE_2_ONE_CHAT_model = mongoose.model("ONE_2_ONE_CHAT", ONE_2_ONE_CHAT);

export default ONE_2_ONE_CHAT_model;

import mongoose from "mongoose";

const GROUP_CHAT = new mongoose.Schema(
  {
    // chatID ~ _id - "GROUP-UUID"
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

const GROUP_CHAT_model = mongoose.model("GROUP_CHAT", GROUP_CHAT);

export default GROUP_CHAT_model;

import mongoose from "mongoose";

const USER_CHAT_LAST_ACCESS_TIME = new mongoose.Schema(
  {
    // we will use userId to find document
    // userId == _id in USER_model
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastAccessTime: [
      {
        roomId: {
          type: String,
          unique: true,
          required: true,
        },
        lastAccessTime: {
          type: Number,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const USER_CHAT_LAST_ACCESS_TIME_model = mongoose.model(
  "USER_CHAT_LAST_ACCESS_TIME",
  USER_CHAT_LAST_ACCESS_TIME
);

export default USER_CHAT_LAST_ACCESS_TIME_model;

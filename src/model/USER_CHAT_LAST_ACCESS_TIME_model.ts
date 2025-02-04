import mongoose from "mongoose";

const USER_CHAT_LAST_ACCESS_TIME = new mongoose.Schema(
  {
    // we will use userId to find document
    // userId == _id in USER_model
    userId: {
      type: String,
      required: true,
    },
    lastAccessTime: [
      {
        roomId: {
          type: String,
          required: true,
        },
        lastAccessMoment: {
          type: Number,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

USER_CHAT_LAST_ACCESS_TIME.index(
  {
    "lastAccessTime.roomId": 1,
  },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "lastAccessTime.roomId": { $exists: true },
    },
  }
);

const USER_CHAT_LAST_ACCESS_TIME_model = mongoose.model(
  "USER_CHAT_LAST_ACCESS_TIME",
  USER_CHAT_LAST_ACCESS_TIME
);

export default USER_CHAT_LAST_ACCESS_TIME_model;

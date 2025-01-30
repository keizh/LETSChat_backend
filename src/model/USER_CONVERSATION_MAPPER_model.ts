import mongoose from "mongoose";

const USER_CONVERSATION_MAPPER = new mongoose.Schema(
  {
    // userId of the user to whom this document belongs
    // userId == _id in USER_model
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ONE2ONEchat: [
      {
        type: String,
        unique: true,
        ref: "ONE_2_ONE_CHAT",
      },
    ],
    GROUPchat: [
      {
        type: String,
        unique: true,
        ref: "GROUP_CHAT",
      },
    ],
  },
  { timestamps: true }
);

const USER_CONVERSATION_MAPPER_MODEL = mongoose.model(
  "USER_CONVERSATION_MAPPER",
  USER_CONVERSATION_MAPPER
);

export default USER_CONVERSATION_MAPPER_MODEL;

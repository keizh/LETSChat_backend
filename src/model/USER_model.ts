import mongoose from "mongoose";

const USERSchema = new mongoose.Schema(
  {
    // created using UUID
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    profileURL: {
      type: String,
      default:
        "https://newprofilepic.photo-cdn.net//assets/images/article/profile.jpg?90af0c8",
    },
    lastOnline: {
      type: Number,
      default: Date.now,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true, _id: false }
);

const USER_model = mongoose.model("USER", USERSchema);

export default USER_model;

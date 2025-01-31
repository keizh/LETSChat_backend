import mongoose from "mongoose";

export default async function db_connect() {
  try {
    const url = process.env.MONGODB || "";
    await mongoose.connect(url);
    console.log(`MONGODB connection has been established`);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : "");
  }
}

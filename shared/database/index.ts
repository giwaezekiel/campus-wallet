import mongoose from "mongoose";
export const registerEVent = () => {
  // listen for error
  mongoose.connection.on("error", (err) => {
    throw new Error(`MongoDB connection error ${err}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB has been disconnected");
  });
};

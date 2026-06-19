import nodemailer from "nodemailer";
import { config } from "../config/config";

export const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.EMAIL_NAME,
    pass: config.EMAIL_PASS,
  },
});

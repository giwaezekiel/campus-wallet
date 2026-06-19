import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT: process.env.PORT ?? "5000",
  DB_URI: process.env.DB_URI as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  EMAIL_NAME: process.env.EMAIL_NAME,
  EMAIL_PASS: process.env.EMAIL_PASS,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY as string,
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:3000",
};

import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../model/user.model";
import { Wallet } from "../model/wallet.model";
import { config } from "../../shared/config/config";
import { sendWelcomeEmail } from "../../shared/email/notification";

function signToken(id: string) {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, school } = req.body;
    if (!name || !email || !password || !school) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }
    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    const user = await User.create({ name, email, password, school });
    await Wallet.create({ user: user._id });

    sendWelcomeEmail({ email, name }).catch(() => {});

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        school: user.school,
      },
    });
  } catch (err: any) {
    console.error("[register]", err);
    const message =
      err?.name === "ValidationError"
        ? Object.values(err.errors)
            .map((e: any) => e.message)
            .join(", ")
        : "Registration failed";
    res.status(err?.name === "ValidationError" ? 400 : 500).json({ message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        school: user.school,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ message: "Login failed" });
  }
}

export async function me(req: Request & { userId?: string }, res: Response) {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

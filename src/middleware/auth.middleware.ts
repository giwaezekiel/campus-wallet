import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../shared/config/config";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { id: string };
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

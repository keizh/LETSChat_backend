import Express, { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      files?: Express.Multer.File[];
    }
  }
}

interface CustomJwtPayload extends JwtPayload {
  id: string;
  name: string;
  profileURL: string;
  lastOnline: number;
  email: string;
}

export default function AuthorizedRoute(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    var token = req?.headers?.authorization;
    // console.log(req?.headers);
    // console.log(req?.headers?.authorization);
    if (!token) {
      res.status(404).json({ message: `JWT ABSENT` });
      return;
    }

    var decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || ""
    ) as CustomJwtPayload;

    req.userId = decoded?.id;
    next();
  } catch (err: unknown) {
    const mssg = err instanceof Error ? err.message : "";
    res.status(404).json({ message: `JWT ISSUE` });
    return;
  }
}

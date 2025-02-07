import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { USER_model } from "../model/modelIndex";
const UserRouter = Router();

import {
  USER_CONVERSATION_MAPPER_MODEL,
  USER_CHAT_LAST_ACCESS_TIME_model,
} from "../model/modelIndex";
import AuthorizedRoute from "../utils/AuthorizedRoute";

// TEST ON BOTH FRONTEND & BACKEND ~ WORKING
UserRouter.get("/google/oath", (req: Request, res: Response): void => {
  const googleOAuthURL: string = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_BACKEND_REDIRECT_URI}&response_type=code&scope=profile email`;
  res.redirect(googleOAuthURL);
});

UserRouter.get(
  "/google/oauth/redirect",
  async (
    req: Request<{}, {}, {}, { code: string }>,
    res: Response
  ): Promise<void> => {
    const { code } = req.query;
    // console.log(`LINE 19`, code);
    const bodyData: {
      client_id: string | undefined;
      client_secret: string | undefined;
      code: string | undefined;
      redirect_uri: string | undefined;
      grant_type: string;
    } = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GOOGLE_BACKEND_REDIRECT_URI,
      grant_type: "authorization_code",
    };

    try {
      const googleOAuthAccessTokenRes = await fetch(
        `https://oauth2.googleapis.com/token`,
        {
          method: "POST",
          body: new URLSearchParams(bodyData as any).toString(),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const { access_token }: { access_token: string } =
        await googleOAuthAccessTokenRes.json();
      // console.log(`LINE 47`, access_token);
      const userEmail = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      const {
        email,
        id,
        name,
        picture,
      }: { email: string; name: string; picture: string; id: string } =
        await userEmail.json();
      // console.log(`LINE 65`, email, id, name, picture);
      // FETCHING EMAIL , ID FROM GOOGLE API
      // google id will be used to make new USER with _id

      // check if a user wuth such an id already exist or not
      const userExists = await USER_model.findById(id);
      var jwtTOKEN: string | undefined;
      if (userExists) {
        jwtTOKEN = jwt.sign(
          {
            id: userExists?._id,
            name: userExists?.name,
            profileURL: userExists?.profileURL,
            lastOnline: userExists?.lastOnline,
            email: userExists?.email,
          },
          process.env.JWT_SECRET_KEY || "",
          { expiresIn: "12h" }
        );
      } else {
        // creating new user
        // console.log(`CREATING NEW USER ------------->`);
        const newUser = new USER_model({
          _id: id,
          name: name,
          profileURL: picture,
          email: email,
        });
        const newUserSaved = await newUser.save();

        jwtTOKEN = jwt.sign(
          {
            id: newUserSaved?._id,
            name: newUserSaved?.name,
            profileURL: newUserSaved?.profileURL,
            lastOnline: newUserSaved?.lastOnline,
            email: newUserSaved?.email,
          },
          process.env.JWT_SECRET_KEY || "",
          { expiresIn: "12h" }
        );
        // creating a userDOcument for USER_CHAT_LAST_ACCESS_TIME
        // console.log(`108`, newUserSaved._id);
        const newDocToSave1 = new USER_CHAT_LAST_ACCESS_TIME_model({
          userId: newUserSaved._id,
          lastAccessTime: [],
        });
        const d1 = await newDocToSave1.save();
        // console.log(`d1`, d1);
        // creating a userDOcument for USER_CONVERSATION_MAPPER
        const newDocToSave2 = new USER_CONVERSATION_MAPPER_MODEL({
          userId: newUserSaved._id,
          ONE2ONEchat: [],
          GROUPchat: [],
        });
        const d2 = await newDocToSave2.save();
        // console.log(`d2`, d2);
      }
      res.redirect(
        `${process.env.LOCAL_FRONTEND_URL}/user/auth?jwt=${jwtTOKEN}`
      );
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "");
    }
  }
);

UserRouter.get("/LastActive", AuthorizedRoute, async (req, res) => {
  try {
    const userId = req.userId;
    const data = await USER_CHAT_LAST_ACCESS_TIME_model.findById(userId)
      .select("lastAccessTime")
      .lean();
    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ message: "Error fetching last access time" });
  }
});

export default UserRouter;

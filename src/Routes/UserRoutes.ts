import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import USER_model from "../model/USER_model";
const UserRouter = Router();

UserRouter.get("google/oath", (req: Request, res: Response): void => {
  const googleOAuthURL: string = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_BACKEND_REDIRECT_URI}&response_type=code&scope=profile email`;
  res.reconnect(googleOAuthURL);
});

UserRouter.post(
  "/google/oauth/redirect",
  async (
    req: Request<{}, {}, {}, { code: string }>,
    res: Response
  ): Promise<void> => {
    const { code } = req.query;

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

      const userEmail = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": `Bearer ${access_token}`,
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
      console.log({
        email,
        id,
        name,
        picture,
      });
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
          process.env.JWT_SECRET_KEY,
          { expiresIn: "12h" }
        );
      } else {
        const newUser = new USER_model({
          _id: id,
          name: name,
          profileURL: picture,
          email: email,
        });
        const newUserSaved = await newUser.save();
        console.log(newUserSaved);
        jwtTOKEN = jwt.sign(
          {
            id: newUserSaved?._id,
            name: newUserSaved?.name,
            profileURL: newUserSaved?.profileURL,
            lastOnline: newUserSaved?.lastOnline,
            email: newUserSaved?.email,
          },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "12h" }
        );
      }
      res.redirect(
        `${process.env.local_frontend_url}/auth/user/home?jwt=${jwtTOKEN}`
      );
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "");
    }
  }
);

export default UserRouter;

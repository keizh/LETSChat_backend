import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { USER_model } from "../model/modelIndex";
const CharRouter = Router();
import AuthorizedRoute from "../utils/AuthorizedRoute";

CharRouter.get(
  "/contacts",
  AuthorizedRoute,
  async (req: Request, res: Response): Promise<void> => {
    let limit: number = 15;
    let curPage: number;
    let nextPage: number;
    let totalDocuments: number;
    let totalPages: number;
    let hasMore: boolean;

    const { page } = req.query;
    console.log(`LINE 20`, page);
    curPage = parseInt(page);
    nextPage = parseInt(page) + 1;
    let skip = (curPage - 1) * limit;
    const userId = req.userId;
    console.log(userId);
    try {
      let AllUsers = await USER_model.find({
        _id: { $nin: [userId] },
      }).lean();
      totalDocuments = AllUsers.length;
      totalPages = Math.ceil(totalDocuments / limit);
      hasMore = totalPages > curPage;
      const data = await USER_model.find({ _id: { $nin: [userId] } })
        .skip(skip)
        .limit(limit);
      console.log({
        totalPages,
        totalDocuments,
        curPage,
        nextPage,
        hasMore,
      });
      res.status(200).json({
        totalPages,
        totalDocuments,
        curPage,
        nextPage,
        hasMore,
        data,
      });
    } catch (err: unknown) {
      res.status(500).json({ message: "Server Error : fetching contacts" });
    }
  }
);

// CharRouter.get(
//   "/contacts",
//   AuthorizedRoute,
//   async (req: Request, res: Response): Promise<void> => {
//     const {} = req.body;
//     try {
//     } catch (err: unknown) {
//       res.status(500).json({ message: "Server Error : fetching contacts" });
//     }
//   }
// );

export default CharRouter;

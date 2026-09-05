import { Request, Response, NextFunction } from "express";

const paginate = (allowedSorts: string[] = ["created_at"]) => (req: any, res: Response, next: NextFunction) => {
  const page  = Math.max(1, parseInt(req.query.page as string)  || 1);
  const limit = req.query.all === "true"
    ? Math.max(1, parseInt(req.query.limit as string) || 10000)
    : Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const sort  = allowedSorts.includes(req.query.sort as string) ? (req.query.sort as string) : allowedSorts[0];
  const order = req.query.order === "asc" ? "asc" : "desc";
  req.pagination = { offset: (page - 1) * limit, limit, sort, order, page };
  next();
};

export default paginate;
module.exports = paginate;

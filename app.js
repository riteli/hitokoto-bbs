require("dotenv").config({ quiet: true });
const express = require("express");
const cookiParser = require("cookie-parser");
const basicAuth = require("express-basic-auth");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
app.set("view engine", "pug");
app.use(express.urlencoded({ extended: false }));
app.use(cookiParser());

// トラッキングIDをCookieで発行
app.use((req, res, next) => {
  let id = req.cookies.tracking_id;
  if (!id) {
    id = crypto.randomUUID();
    res.cookie("tracking_id", id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
    });
  }
  req.trackingId = id;
  next();
});

const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASS },
  challenge: true,
});

const findPosts = () =>
  prisma.post.findMany({ orderBy: { createdAt: "desc" } });

app.get("/", async (req, res) => {
  res.render("index", {
    posts: await findPosts(),
    trackingId: req.trackingId,
    isAdmin: false,
  });
});

app.post("/posts", async (req, res) => {
  const content = (req.body.content || "").trim();
  if (content.length === 0 || content.length > 280) {
    return res.status(400).send("本文は1～280文字で入力してください");
  }
  await prisma.post.create({ data: { content, postedBy: req.trackingId } });
  res.redirect("/");
});

// 本人削除 postedBy が一致する行だけ消える
app.post("/posts/:id/delete", async (req, res) => {
  await prisma.post.deleteMany({
    where: { id: Number(req.params.id), postedBy: req.trackingId },
  });
  res.redirect("/");
});

app.get("/admin", adminAuth, async (req, res) => {
  res.render("index", {
    posts: await findPosts(),
    trackingId: req.trackingId,
    isAdmin: true,
  });
});

app.post("/admin/posts/:id/delete", adminAuth, async (req, res) => {
  await prisma.post.deleteMany({ where: { id: Number(req.params.id) } });
  res.redirect("/admin");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));

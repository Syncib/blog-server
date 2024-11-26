const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dnur3z7la",
  api_key: "317233934249263",
  api_secret: "RA4obr8RwK-mKD2n2UtBQvXfsrY",
});

// Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Cloudinary folder
    allowed_formats: ["jpg", "png", "jpeg", "gif", "webp"], // Allowed file types
  },
});
const uploadMiddleware = multer({ storage });

const salt = bcrypt.genSaltSync(10);
const secret = "mingiyapapale";

app.use(
  cors({
    credentials: true,
    origin: "https://mern-blog-sandy-eight.vercel.app",
  })
);
app.use(express.json());
app.use(cookieParser());

mongoose
  .connect(
    "mongodb+srv://saqib:saqib12@cluster0.kuoxsy9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("Server is running");
  })
  .catch((error) => {
    console.log(error);
  });

// User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("wrong credentials");
  }
});

// Get User Profile
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

// User Logout
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

// Create Post with Cloudinary Upload
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ error: "Token is missing. Please log in." });
  }

  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    const { title, summary, content } = req.body;

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: req.file.path,
      author: info.id,
    });

    res.json(postDoc);
  });
});

// Update Post with Optional File Upload
app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);

    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("You are not the author");
    }

    let cover = postDoc.cover; // Keep the existing cover by default
    if (req.file) {
      cover = req.file.path; // Update cover if a new file is uploaded
    }

    await postDoc.update({
      title,
      summary,
      content,
      cover,
    });

    res.json(postDoc);
  });
});

// Get All Posts
app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

// Get Single Post
app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

module.exports = app;

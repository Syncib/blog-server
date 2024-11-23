const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dnur3z7la",
  api_key: "317233934249263",
  api_secret: "RA4obr8RwK-mKD2n2UtBQvXfsrY",
});

const salt = bcrypt.genSaltSync(10);
const secret = "asdfe45we45w345wegw345werjktjwertkj";

const app = express();

app.use(cors({ credentials: true, origin: "https://mern-blog-sandy-eight.vercel.app" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

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
    console.error(e);
    res.status(400).json(e);
  }
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
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

// User Profile
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      console.error("JWT Verification Error:", err);
      return res.status(500).json({ error: "Token verification failed" });
    }
    res.json(info);
  });
});

// User Logout
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

// Create Post with Image Upload (Cloudinary)
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { file } = req;
  const { token } = req.cookies;

  if (!file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  // Upload file to Cloudinary
  cloudinary.uploader.upload(file.path, async (error, result) => {
    if (error) {
      console.error("Cloudinary Upload Error:", error);
      return res.status(500).json({ error: "Failed to upload image" });
    }

    // Extract the URL of the uploaded image
    const imageUrl = result.secure_url;

    // Remove the file after uploading to Cloudinary
    fs.unlinkSync(file.path);

    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) {
        console.error("JWT Verification Error:", err);
        return res.status(500).json({ error: "Token verification failed" });
      }

      const { title, summary, content } = req.body;
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: imageUrl, // Store the Cloudinary image URL
        author: info.id,
      });

      res.json(postDoc);
    });
  });
});

// Get All Posts
app.get("/post", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (e) {
    console.error("Error fetching posts:", e);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get Post by ID
app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate("author", ["username"]);
    res.json(postDoc);
  } catch (e) {
    console.error("Error fetching post by ID:", e);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// MongoDB Connection
mongoose
  .connect("mongodb+srv://saqib:saqib12@cluster0.kuoxsy9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => {
    console.log("Connected to MongoDB, server is running...");
  });

// Start Express Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

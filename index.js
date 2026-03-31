const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/concat", async (req, res) => {
  const { intro_url, main_url, outro_url } = req.body;

  try {
    const download = async (url, path) => {
      const response = await axios({ url, method: "GET", responseType: "stream" });
      const writer = fs.createWriteStream(path);
      response.data.pipe(writer);
      return new Promise((resolve) => writer.on("finish", resolve));
    };

console.log("Downloading intro...");
await download(intro_url, "intro.mp4");

console.log("Downloading main...");
await download(main_url, "main.mp4");

console.log("Downloading outro...");
await download(outro_url, "outro.mp4");

console.log("Files downloaded:");
console.log("intro:", fs.existsSync("intro.mp4"));
console.log("main:", fs.existsSync("main.mp4"));
console.log("outro:", fs.existsSync("outro.mp4"));

    fs.writeFileSync("files.txt", "file 'intro.mp4'\nfile 'main.mp4'\nfile 'outro.mp4'");

    exec("/usr/bin/ffmpeg -f concat -safe 0 -i files.txt -c copy output.mp4", (err) => {
      if (err) return res.status(500).send("Error processing video");

      res.sendFile(__dirname + "/output.mp4");
    });

  } catch (e) {
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running"));

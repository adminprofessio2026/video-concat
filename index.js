const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const jobs = {};

app.post("/concat", async (req, res) => {
  const { intro_url, main_url, outro_url } = req.body;

  const jobId = Date.now().toString();
  jobs[jobId] = { status: "processing", file: null };

  processVideos(intro_url, main_url, outro_url, jobId);

  res.json({ job_id: jobId });
});

async function processVideos(intro_url, main_url, outro_url, jobId) {
  try {
    const download = async (url, path) => {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });

      const writer = fs.createWriteStream(path);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    const introPath = `intro_${jobId}.mp4`;
    const mainPath = `main_${jobId}.mp4`;
    const outroPath = `outro_${jobId}.mp4`;
    const outputPath = `output_${jobId}.mp4`;

    console.log("Downloading intro...");
    await download(intro_url, introPath);

    console.log("Downloading main...");
    await download(main_url, mainPath);

    console.log("Downloading outro...");
    await download(outro_url, outroPath);

    console.log("Files downloaded:");
    console.log("intro:", fs.existsSync(introPath));
    console.log("main:", fs.existsSync(mainPath));
    console.log("outro:", fs.existsSync(outroPath));

    const ffmpegCmd = [
      "/usr/bin/ffmpeg",
      "-y",
      `-i "${introPath}"`,
      `-i "${mainPath}"`,
      `-i "${outroPath}"`,
      '-filter_complex "[0:v:0][0:a:0][1:v:0][1:a:0][2:v:0][2:a:0]concat=n=3:v=1:a=1[outv][outa]"',
      '-map "[outv]"',
      '-map "[outa]"',
      "-c:v libx264",
      "-c:a aac",
      `"${outputPath}"`
    ].join(" ");

    exec(ffmpegCmd, (err, stdout, stderr) => {
      console.log("FFmpeg stdout:", stdout);
      console.log("FFmpeg stderr:", stderr);

      if (err) {
        jobs[jobId] = { status: "error" };
        console.error("FFmpeg error:", err);
        return;
      }

      jobs[jobId] = {
        status: "done",
        file: outputPath,
      };

      console.log("Job completed:", jobId);
    });
  } catch (e) {
    jobs[jobId] = { status: "error" };
    console.error("Processing error:", e);
  }
}

app.get("/download", (req, res) => {
  const { job_id } = req.query;
  const job = jobs[job_id];

  if (!job) {
    return res.status(404).send("Job not found");
  }

  if (job.status !== "done") {
    return res.status(202).send("Processing");
  }

  res.sendFile(__dirname + "/" + job.file);
});

app.listen(3000, () => console.log("Server running"));

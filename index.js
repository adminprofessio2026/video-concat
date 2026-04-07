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

    console.log("Downloading intro...");
    await download(intro_url, `intro_${jobId}.mp4`);

    console.log("Downloading main...");
    await download(main_url, `main_${jobId}.mp4`);

    console.log("Downloading outro...");
    await download(outro_url, `outro_${jobId}.mp4`);

    console.log("Files downloaded:");
    console.log("intro:", fs.existsSync(`intro_${jobId}.mp4`));
    console.log("main:", fs.existsSync(`main_${jobId}.mp4`));
    console.log("outro:", fs.existsSync(`outro_${jobId}.mp4`));

    fs.writeFileSync(
      `files_${jobId}.txt`,
      `file 'intro_${jobId}.mp4'\nfile 'main_${jobId}.mp4'\nfile 'outro_${jobId}.mp4'`
    );

    exec(
      `/usr/bin/ffmpeg -f concat -safe 0 -i files_${jobId}.txt -c:v libx264 -c:a aac output_${jobId}.mp4`,
      (err, stdout, stderr) => {
        console.log("FFmpeg stdout:", stdout);
        console.log("FFmpeg stderr:", stderr);

        if (err) {
          jobs[jobId] = { status: "error" };
          console.error("FFmpeg error:", err);
          return;
        }

        jobs[jobId] = {
          status: "done",
          file: `output_${jobId}.mp4`,
        };

        console.log("Job completed:", jobId);
      }
    );
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

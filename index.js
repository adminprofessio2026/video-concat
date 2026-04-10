const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const jobs = {};

// ✅ POST: start job
app.post("/concat", async (req, res) => {
  const { intro_url, main_url, outro_url } = req.body;

  const jobId = Date.now().toString();
  jobs[jobId] = { status: "processing", file: null };

  res.json({ job_id: jobId });

// run AFTER response
setImmediate(() => {
  processVideos(intro_url, main_url, outro_url, jobId);
});
});

// ✅ MAIN PROCESS FUNCTION
async function processVideos(intro_url, main_url, outro_url, jobId) {
  try {
    // ---------------- DOWNLOAD FUNCTION ----------------
    const download = async (url, path) => {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        maxRedirects: 5,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      console.log("Downloading from:", url);
      console.log("Content-Type:", response.headers["content-type"]);

      const writer = fs.createWriteStream(path);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    // ---------------- FILE PATHS ----------------
    const introPath = `intro_${jobId}.mp4`;
    const mainPath = `main_${jobId}.mp4`;
    const outroPath = `outro_${jobId}.mp4`;
    const outputPath = `output_${jobId}.mp4`;

    const normIntro = `norm_intro_${jobId}.mp4`;
    const normMain = `norm_main_${jobId}.mp4`;
    const normOutro = `norm_outro_${jobId}.mp4`;

    // ---------------- DOWNLOAD ----------------
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

    // ---------------- NORMALIZE FUNCTION ----------------
    const normalize = (input, output) =>
      `/usr/bin/ffmpeg -y -i "${input}" \
      -vf "scale=1280:720,fps=30,format=yuv420p" \
      -c:v libx264 -preset veryfast \
      -c:a aac -ar 44100 -ac 2 \
      -movflags +faststart \
      "${output}"`;

    // ---------------- NORMALIZE + CONCAT ----------------
    console.log("▶️ Starting FFmpeg normalize intro");
    exec(normalize(introPath, normIntro), (err) => {
      if (err) {
        console.error("Intro normalize error:", err);
        jobs[jobId] = { status: "error" };
        return;
      }

      console.log("▶️ Starting FFmpeg normalize main");
      exec(normalize(mainPath, normMain), (err) => {
        if (err) {
          console.error("Main normalize error:", err);
          jobs[jobId] = { status: "error" };
          return;
        }

        console.log("▶️ Starting FFmpeg normalize outro");
        exec(normalize(outroPath, normOutro), (err) => {
          if (err) {
            console.error("Outro normalize error:", err);
            jobs[jobId] = { status: "error" };
            return;
          }

          // ✅ CONCAT AFTER NORMALIZATION
          fs.writeFileSync(
            `files_${jobId}.txt`,
            `file '${normIntro}'\nfile '${normMain}'\nfile '${normOutro}'`
          );

          const concatCmd = `/usr/bin/ffmpeg -y \
          -f concat -safe 0 \
          -i files_${jobId}.txt \
          -c copy \
          "${outputPath}"`;

          console.log("▶️ Starting FFmpeg concat");  // ✅ ADDED LOG

          exec(concatCmd, (err, stdout, stderr) => {
            console.log("Concat stdout:", stdout);
            console.log("Concat stderr:", stderr);

            if (err) {
              console.error("Concat error:", err);
              jobs[jobId] = { status: "error" };
              return;
            }

            jobs[jobId] = {
              status: "done",
              file: outputPath,
            };

            console.log("✅ Job completed:", jobId);
          });
        });
      });
    });

  } catch (e) {
    console.error("Processing error:", e);
    jobs[jobId] = { status: "error" };
  }
}

// ✅ GET: download result
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

// ✅ START SERVER
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
